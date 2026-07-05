/**
 * LiveSpotClient
 * Talks to Nominatim (geocoding) and Overpass (POIs), and turns the
 * results into LiveSpot instances (see js/destinations.js) — the search
 * page never touches raw OSM JSON directly.
 */
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

class LiveSpotClient {
  async geocodeCity(name) {
    const url = `${NOMINATIM_URL}?q=${encodeURIComponent(name)}&format=json&limit=1&addressdetails=1`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('The geocoding service is unavailable right now. Please try again shortly.');
    const data = await res.json();
    return data[0] || null;
  }

  /**
   * Maps our Type vocabulary (wedding/vacation/honeymoon/couples/
   * adventure/camping/family) onto which OSM node filters are worth
   * asking Overpass for — this is the actual API integration point:
   * picking a Type in the UI changes what gets requested from Overpass,
   * not just how already-fetched results get sorted afterward.
   */
  static wantedOsmFilters(types) {
    const t = types && types.size ? types : null;
    const want = {
      attraction: !t || t.has('adventure') || t.has('vacation'),
      historic: !t || t.has('wedding') || t.has('vacation'),
      park: !t || t.has('camping') || t.has('family') || t.has('vacation'),
      beach: !t || t.has('honeymoon') || t.has('couples') || t.has('vacation'),
    };
    if (!want.attraction && !want.historic && !want.park && !want.beach) {
      return { attraction: true, historic: true, park: true, beach: true };
    }
    return want;
  }

  buildOverpassQuery(latitude, longitude, types, radius) {
    const want = LiveSpotClient.wantedOsmFilters(types);
    const clauses = [];
    if (want.attraction) clauses.push(`node["tourism"~"attraction|museum|viewpoint"](around:${radius},${latitude},${longitude});`);
    if (want.historic) clauses.push(`node["historic"](around:${radius},${latitude},${longitude});`);
    if (want.park) clauses.push(`node["leisure"~"park|beach_resort"](around:${radius},${latitude},${longitude});`);
    if (want.beach) clauses.push(`node["natural"="beach"](around:${radius},${latitude},${longitude});`);
    return `[out:json][timeout:25];(${clauses.join('\n')});out body 20;`;
  }

  /**
   * A fixed "search nearby" radius makes sense for a city, but Nominatim
   * happily geocodes a whole country or state to a single centroid point
   * too — searching a rural 3km circle around India's geometric center
   * finds nothing tagged in OSM and looks like a broken search. Scale the
   * radius to the geocoded place's actual bounding box instead, clamped
   * to something Overpass can still answer quickly.
   */
  static radiusFromBoundingBox(boundingbox) {
    if (!Array.isArray(boundingbox) || boundingbox.length !== 4) return 3000;
    const [south, north, west, east] = boundingbox.map(Number);
    if ([south, north, west, east].some(Number.isNaN)) return 3000;

    const midLat = (south + north) / 2;
    const latKm = Math.abs(north - south) * 111;
    const lonKm = Math.abs(east - west) * 111 * Math.cos((midLat * Math.PI) / 180);
    const halfDiagonalKm = Math.max(latKm, lonKm) / 2;

    return Math.round(Math.min(Math.max(halfDiagonalKm * 1000, 3000), 25000));
  }

  async fetchPOIs(lat, lon, types, radius = 3000) {
    // Nominatim returns lat/lon as strings, occasionally with formatting
    // quirks. Overpass QL is strict about the (around:radius,lat,lon)
    // block, so coerce to real numbers and fail loudly instead of ever
    // sending "NaN,NaN" (a guaranteed 400).
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      throw new Error(`Invalid coordinates passed to fetchPOIs: lat=${lat}, lon=${lon}`);
    }

    const query = this.buildOverpassQuery(latitude, longitude, types, radius);
    const res = await fetch(OVERPASS_URL, { method: 'POST', body: query });
    if (!res.ok) throw new Error('The live map data service is unavailable right now. Please try again shortly.');
    const data = await res.json();
    return (data.elements || []).filter((el) => el.tags?.name);
  }

  classify(tags) {
    if (tags.historic) return 'historic';
    if (tags.tourism === 'museum') return 'museum';
    if (tags.tourism === 'attraction' || tags.tourism === 'viewpoint') return 'attraction';
    if (tags.leisure === 'park') return 'park';
    if (tags.leisure === 'beach_resort' || tags.natural === 'beach') return 'beach';
    return null;
  }

  toLiveSpot(poi, country, region, id, lat, lon, city) {
    return new LiveSpot({
      id,
      name: poi.name,
      country,
      city,
      region,
      osmCategory: poi.category,
      seed: `live-${poi.name}`.replace(/\s+/g, '-').toLowerCase(),
      lat,
      lon,
    });
  }

  /** Reusable on its own (no geocoding) so a Type-filter change can re-query the *same* coordinates with a narrower/broader tag set. */
  async spotsFromPOIs(lat, lon, countryLabel, region, idPrefix, types, cityLabel, radius) {
    const elements = await this.fetchPOIs(lat, lon, types, radius);
    return elements
      .map((el, i) => {
        const category = this.classify(el.tags);
        if (!category) return null;
        return this.toLiveSpot({ name: el.tags.name, category }, countryLabel, region, `${idPrefix}-${i}`, lat, lon, cityLabel);
      })
      .filter(Boolean);
  }

  /**
   * Returns { spots, cityLabel, countryLabel, sample, lat, lon, region } or
   * throws with a human-readable message the UI can show directly.
   * Always attempts real Nominatim + Overpass first; only falls back to
   * labeled sample data (a handful of cities) if that genuinely fails.
   */
  async fetchLiveSpots(cityName, idPrefix, types) {
    try {
      const place = await this.geocodeCity(cityName);
      if (!place) return { spots: [], cityLabel: cityName, countryLabel: '', sample: false, lat: null, lon: null, region: null };

      const countryLabel = place.address?.country || '';
      const region = place.address?.country_code === 'lb' ? 'local' : 'global';
      const lat = parseFloat(place.lat);
      const lon = parseFloat(place.lon);
      const cityLabel = place.display_name?.split(',')[0] || cityName;
      const radius = LiveSpotClient.radiusFromBoundingBox(place.boundingbox);
      const spots = await this.spotsFromPOIs(lat, lon, countryLabel, region, idPrefix, types, cityLabel, radius);

      return { spots, cityLabel, countryLabel, sample: false, lat, lon, region };
    } catch (err) {
      const sample = LiveSpotClient.sampleData(cityName);
      if (!sample) {
        throw new Error('Couldn\u2019t reach the live map service right now. Try again shortly, or search Beirut, Santorini, Kyoto, or Marrakech.');
      }
      return {
        spots: sample.pois.map((poi, i) => this.toLiveSpot(poi, sample.country, sample.region, `${idPrefix}-${i}`, null, null, sample.cityLabel)),
        cityLabel: sample.cityLabel,
        countryLabel: sample.country,
        sample: true,
        lat: null,
        lon: null,
        region: sample.region,
      };
    }
  }

  static sampleData(query) {
    const byCity = {
      beirut: {
        cityLabel: 'Beirut', country: 'Lebanon', region: 'local',
        pois: [
          { name: 'Raouche Rocks', category: 'attraction' },
          { name: 'National Museum of Beirut', category: 'museum' },
          { name: 'Sanayeh Public Garden', category: 'park' },
        ],
      },
      santorini: {
        cityLabel: 'Santorini', country: 'Greece', region: 'global',
        pois: [
          { name: 'Oia Castle Viewpoint', category: 'attraction' },
          { name: 'Akrotiri Archaeological Site', category: 'historic' },
          { name: 'Perissa Beach', category: 'beach' },
        ],
      },
      kyoto: {
        cityLabel: 'Kyoto', country: 'Japan', region: 'global',
        pois: [
          { name: 'Fushimi Inari Shrine', category: 'historic' },
          { name: 'Maruyama Park', category: 'park' },
        ],
      },
      marrakech: {
        cityLabel: 'Marrakech', country: 'Morocco', region: 'global',
        pois: [
          { name: 'Bahia Palace', category: 'historic' },
          { name: 'Jemaa el-Fnaa', category: 'attraction' },
        ],
      },
    };

    const key = Object.keys(byCity).find((c) => c.includes(query.toLowerCase()) || query.toLowerCase().includes(c));
    return key ? byCity[key] : null;
  }
}