/**
 * LiveSpotClient
 * Pulls real points of interest from OpenStreetMap:
 *   1. Nominatim geocodes the typed city name into coordinates.
 *   2. Overpass fetches nearby tourism/historic/leisure/natural nodes.
 *   3. Each result becomes a LiveSpot (see destinations.js) so it can be
 *      merged directly into the same grid, filters, and sort as our own
 *      curated spots.
 *
 * Both APIs are free and keyless — no registration, no OAuth, no
 * expiring tokens. (This sandbox's network allowlist blocks external
 * calls during development, so the sample fallback below keeps the UI
 * demonstrable here; a normal browser with internet access can reach
 * both endpoints directly, as they're public CORS-enabled services.)
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
   * Maps our own Type vocabulary (wedding/vacation/honeymoon/couples/
   * adventure/camping/family) onto which OSM node filters are worth
   * asking Overpass for. This is the actual API integration point: picking
   * a Type in the UI changes what gets requested from Overpass, not just
   * how already-fetched results get sorted afterward.
   * "vacation" is deliberately broad (matches almost everything), so
   * selecting it — or selecting nothing — asks for all four categories.
   */
  static wantedOsmFilters(types) {
    const t = types && types.size ? types : null;
    const want = {
      attraction: !t || t.has('adventure') || t.has('vacation'),
      historic: !t || t.has('wedding') || t.has('vacation'),
      park: !t || t.has('camping') || t.has('family') || t.has('vacation'),
      beach: !t || t.has('honeymoon') || t.has('couples') || t.has('vacation'),
    };
    // Safety net: an unusual combination that maps to nothing should still
    // return real results rather than an empty query.
    if (!want.attraction && !want.historic && !want.park && !want.beach) {
      return { attraction: true, historic: true, park: true, beach: true };
    }
    return want;
  }

  buildOverpassQuery(latitude, longitude, types) {
    const want = LiveSpotClient.wantedOsmFilters(types);
    const clauses = [];
    if (want.attraction) clauses.push(`node["tourism"~"attraction|museum|viewpoint"](around:3000,${latitude},${longitude});`);
    if (want.historic) clauses.push(`node["historic"](around:3000,${latitude},${longitude});`);
    if (want.park) clauses.push(`node["leisure"~"park|beach_resort"](around:3000,${latitude},${longitude});`);
    if (want.beach) clauses.push(`node["natural"="beach"](around:3000,${latitude},${longitude});`);
    return `[out:json][timeout:25];(${clauses.join('\n')});out body 20;`;
  }

  async fetchPOIs(lat, lon, types) {
    // Nominatim returns lat/lon as strings, occasionally with formatting
    // quirks. Overpass QL is strict about the (around:radius,lat,lon)
    // block, so coerce to real numbers and fail loudly instead of ever
    // sending "NaN,NaN" (a guaranteed 400).
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      throw new Error(`Invalid coordinates passed to fetchPOIs: lat=${lat}, lon=${lon}`);
    }

    const query = this.buildOverpassQuery(latitude, longitude, types);
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

  /** Turns raw Overpass elements into LiveSpots. Reusable on its own (no
   * geocoding) so a Type-filter change can re-query the *same* coordinates
   * with a narrower/broader tag set instead of asking the person to search again. */
  async spotsFromPOIs(lat, lon, countryLabel, region, idPrefix, types) {
    const elements = await this.fetchPOIs(lat, lon, types);
    return elements
      .map((el, i) => {
        const category = this.classify(el.tags);
        if (!category) return null;
        return this.toLiveSpot({ name: el.tags.name, category }, countryLabel, region, `${idPrefix}-${i}`);
      })
      .filter(Boolean);
  }

  /**
   * Returns { spots, cityLabel, countryLabel, sample, lat, lon, region } or
   * throws with a human-readable message the UI can show directly. `lat`/
   * `lon` are returned (when real, non-sample data) so the caller can cache
   * them and re-query Overpass later as Type filters change.
   *
   * Always attempts the real Nominatim + Overpass calls first. Only if
   * that genuinely fails (offline, blocked, service down, rate-limited)
   * does it fall back to labeled sample data — and only for the handful
   * of cities that sample data covers; anything else surfaces a real
   * error instead of silently pretending to work.
   */
  async fetchLiveSpots(cityName, idPrefix, types) {
    try {
      const place = await this.geocodeCity(cityName);
      if (!place) return { spots: [], cityLabel: cityName, countryLabel: '', sample: false, lat: null, lon: null, region: null };

      const countryLabel = place.address?.country || '';
      const region = place.address?.country_code === 'lb' ? 'local' : 'global';
      const spots = await this.spotsFromPOIs(place.lat, place.lon, countryLabel, region, idPrefix, types);

      return {
        spots,
        cityLabel: place.display_name?.split(',')[0] || cityName,
        countryLabel,
        sample: false,
        lat: parseFloat(place.lat),
        lon: parseFloat(place.lon),
        region,
      };
    } catch (err) {
      const sample = LiveSpotClient.sampleData(cityName);
      if (!sample) {
        throw new Error('Couldn\u2019t reach the live map service right now. Try again shortly, or search Beirut, Santorini, Kyoto, or Marrakech.');
      }
      return {
        spots: sample.pois.map((poi, i) => this.toLiveSpot(poi, sample.country, sample.region, `${idPrefix}-${i}`)),
        cityLabel: sample.cityLabel,
        countryLabel: sample.country,
        sample: true,
        lat: null,
        lon: null,
        region: sample.region,
      };
    }
  }

  toLiveSpot(poi, country, region, id) {
    return new LiveSpot({
      id,
      name: poi.name,
      country,
      region,
      osmCategory: poi.category,
      seed: `live-${poi.name}`.replace(/\s+/g, '-').toLowerCase(),
    });
  }

  static sampleData(query) {
    const byCity = {
      beirut: {
        cityLabel: 'Beirut', country: 'Lebanon', region: 'local',
        pois: [
          { name: 'Raouche Rocks', category: 'attraction', tags: ['tourism', 'landmark'] },
          { name: 'National Museum of Beirut', category: 'museum', tags: ['museum', 'heritage'] },
          { name: 'Sanayeh Public Garden', category: 'park', tags: ['leisure', 'garden'] },
        ],
      },
      santorini: {
        cityLabel: 'Santorini', country: 'Greece', region: 'global',
        pois: [
          { name: 'Oia Castle Viewpoint', category: 'attraction', tags: ['tourism', 'sunset'] },
          { name: 'Akrotiri Archaeological Site', category: 'historic', tags: ['historic', 'ruins'] },
          { name: 'Perissa Beach', category: 'beach', tags: ['natural', 'beach'] },
        ],
      },
      kyoto: {
        cityLabel: 'Kyoto', country: 'Japan', region: 'global',
        pois: [
          { name: 'Fushimi Inari Shrine', category: 'historic', tags: ['historic', 'shrine'] },
          { name: 'Maruyama Park', category: 'park', tags: ['leisure', 'park'] },
        ],
      },
      marrakech: {
        cityLabel: 'Marrakech', country: 'Morocco', region: 'global',
        pois: [
          { name: 'Bahia Palace', category: 'historic', tags: ['historic', 'palace'] },
          { name: 'Jemaa el-Fnaa', category: 'attraction', tags: ['tourism', 'square'] },
        ],
      },
    };

    const key = Object.keys(byCity).find((c) => c.includes(query.toLowerCase()) || query.toLowerCase().includes(c));
    return key ? byCity[key] : null;
  }
}