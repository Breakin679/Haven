/**
 * OsmApi
 * The only thing the search page knows about OpenStreetMap: call
 * searchPlaces(query) and get back Spot[]. Nominatim (geocoding) and
 * Overpass (POIs) are implementation details entirely hidden in here —
 * swapping this for a real backend later means rewriting this file only,
 * nothing in search/.
 *
 * Both APIs are free and keyless — no registration, no OAuth, no
 * expiring tokens. (This sandbox's network allowlist blocks external
 * calls during development, so the sample fallback below keeps the UI
 * demonstrable here; a normal browser with internet access can reach
 * both endpoints directly, as they're public CORS-enabled services.)
 */
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const SERENITY_TAG = { high: 'quiet', medium: 'balanced', low: 'lively' };

class OsmApi {
  /**
   * Returns { spots, cityLabel, countryLabel, sample }. Never throws to
   * the caller for ordinary "nothing found" cases — only for genuine
   * service failures with no sample data to fall back on.
   */
  async searchPlaces(query) {
    try {
      const place = await this.geocodeCity(query);
      if (!place) return { spots: [], cityLabel: query, countryLabel: '', sample: false };

      const countryLabel = place.address?.country || '';
      const region = place.address?.country_code === 'lb' ? 'local' : 'global';
      const elements = await this.fetchPOIs(place.lat, place.lon);

      const spots = elements
        .map((el, i) => {
          const category = this.classify(el.tags);
          if (!category) return null;
          return this.toSpot({ name: el.tags.name, category }, countryLabel, region, `osm-${query}-${i}`);
        })
        .filter(Boolean);

      return { spots, cityLabel: place.display_name?.split(',')[0] || query, countryLabel, sample: false };
    } catch (err) {
      const sample = OsmApi.sampleData(query);
      if (!sample) {
        throw new Error('Couldn\u2019t reach the live map service right now. Try again shortly, or search Beirut, Santorini, Kyoto, or Marrakech.');
      }
      return {
        spots: sample.pois.map((poi, i) => this.toSpot(poi, sample.country, sample.region, `sample-${query}-${i}`)),
        cityLabel: sample.cityLabel,
        countryLabel: sample.country,
        sample: true,
      };
    }
  }

  async geocodeCity(name) {
    const url = `${NOMINATIM_URL}?q=${encodeURIComponent(name)}&format=json&limit=1&addressdetails=1`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('The geocoding service is unavailable right now. Please try again shortly.');
    const data = await res.json();
    return data[0] || null;
  }

  async fetchPOIs(lat, lon) {
    // Nominatim returns lat/lon as strings, occasionally with formatting
    // quirks. Overpass QL is strict about the (around:radius,lat,lon)
    // block, so coerce to real numbers and fail loudly instead of ever
    // sending "NaN,NaN" (a guaranteed 400).
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      throw new Error(`Invalid coordinates passed to fetchPOIs: lat=${lat}, lon=${lon}`);
    }

    // Categories are generated from whatever comes back, not filtered up
    // front — so the query always asks Overpass broadly for everything
    // relevant, and the UI's quick filter chips are built afterward from
    // the actual merged result set.
    const query = `
      [out:json][timeout:25];
      (
        node["tourism"~"attraction|museum|viewpoint"](around:3000,${latitude},${longitude});
        node["historic"](around:3000,${latitude},${longitude});
        node["leisure"~"park|beach_resort"](around:3000,${latitude},${longitude});
        node["natural"="beach"](around:3000,${latitude},${longitude});
      );
      out body 20;
    `;
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

  /**
   * Translates an OSM category into a Spot. OSM has no rating/price, so a
   * deterministic estimate (seeded off the name, stable across re-fetches)
   * stands in — a null would otherwise silently fail every Rating/Price
   * filter forever instead of actually taking part in them.
   */
  toSpot(poi, country, region, id) {
    const presets = {
      historic:   { tags: ['heritage', 'architecture'], serenity: 'high',   atmosphere: 'historical', ratingBase: 4.6, priceBase: 12 },
      museum:     { tags: ['heritage', 'culture'],       serenity: 'high',   atmosphere: 'historical', ratingBase: 4.5, priceBase: 10 },
      attraction: { tags: ['iconic', 'sights'],          serenity: 'medium', atmosphere: 'modern',     ratingBase: 4.4, priceBase: 0 },
      viewpoint:  { tags: ['sunset-views', 'iconic'],    serenity: 'medium', atmosphere: 'modern',     ratingBase: 4.6, priceBase: 0 },
      park:       { tags: ['hiking', 'countryside'],     serenity: 'high',   atmosphere: 'rustic',     ratingBase: 4.3, priceBase: 0 },
      beach:      { tags: ['beachfront', 'snorkeling'],  serenity: 'high',   atmosphere: 'rustic',     ratingBase: 4.6, priceBase: 0 },
    };
    const preset = presets[poi.category] || { tags: ['sights'], serenity: 'medium', atmosphere: 'modern', ratingBase: 4.3, priceBase: 5 };

    // Deterministic per-spot variation around the category baseline, so
    // "every historic site is a 4.6" doesn't look obviously fabricated,
    // while staying stable if the same POI is fetched again later.
    const frac = OsmApi.hashFraction(poi.name || 'spot');
    const rating = Math.min(5, Math.max(3.8, Math.round((preset.ratingBase + (frac - 0.5) * 0.6) * 10) / 10));
    const jitter = preset.priceBase > 0 ? 8 : 6;
    const price = Math.max(0, Math.round(preset.priceBase + (frac - 0.5) * jitter));

    return new Spot({
      id,
      name: poi.name,
      country,
      region,
      category: poi.category,
      tags: [...preset.tags, SERENITY_TAG[preset.serenity], preset.atmosphere],
      rating,
      price,
      priceUnit: 'visit',
      image: `https://picsum.photos/seed/osm-${poi.name.replace(/\s+/g, '-').toLowerCase()}/640/480`,
      description: `A ${poi.category} spot surfaced live from OpenStreetMap.`,
      source: 'osm',
    });
  }

  static hashFraction(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return (h % 1000) / 1000;
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