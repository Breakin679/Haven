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

  async fetchPOIs(lat, lon) {
    const query = `
      [out:json][timeout:25];
      (
        node["tourism"~"attraction|museum|viewpoint"](around:3000,${lat},${lon});
        node["historic"](around:3000,${lat},${lon});
        node["leisure"~"park|beach_resort"](around:3000,${lat},${lon});
        node["natural"="beach"](around:3000,${lat},${lon});
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
   * Returns { spots, cityLabel, countryLabel, sample } or throws with a
   * human-readable message the UI can show directly.
   *
   * Always attempts the real Nominatim + Overpass calls first. Only if
   * that genuinely fails (offline, blocked, service down, rate-limited)
   * does it fall back to labeled sample data — and only for the handful
   * of cities that sample data covers; anything else surfaces a real
   * error instead of silently pretending to work.
   */
  async fetchLiveSpots(cityName, idPrefix) {
    try {
      const place = await this.geocodeCity(cityName);
      if (!place) return { spots: [], cityLabel: cityName, countryLabel: '', sample: false };

      const elements = await this.fetchPOIs(place.lat, place.lon);
      const countryLabel = place.address?.country || '';
      const region = place.address?.country_code === 'lb' ? 'local' : 'global';

      const spots = elements
        .map((el, i) => {
          const category = this.classify(el.tags);
          if (!category) return null;
          return this.toLiveSpot(
            { name: el.tags.name, category, tags: Object.keys(el.tags).slice(0, 3) },
            countryLabel,
            region,
            `${idPrefix}-${i}`
          );
        })
        .filter(Boolean);

      return { spots, cityLabel: place.display_name?.split(',')[0] || cityName, countryLabel, sample: false };
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
      tags: poi.tags || [],
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

/**
 * LiveSearchWidget
 * Wires the compact "Add live spots" control to LiveSpotClient and merges
 * the results straight into the SpotBrowser's grid — same filters, same
 * sort, same pagination as the curated spots.
 */
class LiveSearchWidget {
  constructor({ formSelector, inputSelector, statusSelector, spotBrowser }) {
    this.form = document.querySelector(formSelector);
    if (!this.form || !spotBrowser) return;

    this.input = document.querySelector(inputSelector);
    this.status = document.querySelector(statusSelector);
    this.browser = spotBrowser;
    this.client = new LiveSpotClient();
    this.counter = 0;

    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      const query = this.input.value.trim();
      if (query) this.run(query);
    });
  }

  setStatus(html) { if (this.status) this.status.innerHTML = html; }

  async run(query) {
    this.setStatus(`<div class="spinner spinner--inline"></div> Fetching live spots for "${query}"…`);

    try {
      const { spots, cityLabel, countryLabel, sample } = await this.client.fetchLiveSpots(query, `live-${this.counter++}`);

      if (!spots.length) {
        this.setStatus(`<i class="bi bi-search"></i> No live spots found for "${query}" — try a bigger nearby city.`);
        return;
      }

      const added = this.browser.addLiveSpots(spots);
      const place = countryLabel ? `${cityLabel}, ${countryLabel}` : cityLabel;
      const sampleNote = sample ? ' (sample data — live network calls are blocked in this preview)' : '';
      this.setStatus(`<i class="bi bi-check-circle"></i> Added ${added} live spot${added === 1 ? '' : 's'} for ${place}${sampleNote}.`);
      this.input.value = '';
    } catch (err) {
      this.setStatus(`<i class="bi bi-exclamation-triangle"></i> ${err.message || 'Something went wrong reaching the live data service.'}`);
    }
  }
}