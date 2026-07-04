/**
 * AmadeusExplorer
 * Live "Points of Interest" lookup via the Amadeus Self-Service API.
 *
 * Why Amadeus over a plain city-stats API: its POI categories — SIGHTS,
 * HISTORICAL, NIGHTLIFE, BEACH_PARK, RESTAURANT, SHOPPING — map directly
 * onto the same Type/Atmosphere language the rest of this page filters by,
 * instead of returning population figures that have nothing to do with
 * "finding a spot."
 *
 * Flow: city name -> OAuth2 token -> geocode the city -> fetch nearby POIs
 * -> filter by category (chips) + paginate on the client.
 *
 * NOTE FOR SUBMISSION: register a free Self-Service key at
 * https://developers.amadeus.com, then paste your Client ID/Secret below.
 * Until then this panel runs on labeled sample data so the UI can still be
 * reviewed offline (this sandbox also can't reach api.amadeus.com to test
 * the live calls directly).
 */
const AMADEUS_CLIENT_ID = 'YOUR_AMADEUS_CLIENT_ID';         // <-- replace with your own
const AMADEUS_CLIENT_SECRET = 'YOUR_AMADEUS_CLIENT_SECRET'; // <-- replace with your own
const AMADEUS_BASE = 'https://test.api.amadeus.com';

class AmadeusExplorer {
  constructor({ formSelector, inputSelector, resultsSelector, paginationSelector, hintSelector, chipsSelector }) {
    this.form = document.querySelector(formSelector);
    if (!this.form) return;

    this.input = document.querySelector(inputSelector);
    this.results = document.querySelector(resultsSelector);
    this.pagination = document.querySelector(paginationSelector);
    this.hint = document.querySelector(hintSelector);
    this.chipsBar = document.querySelector(chipsSelector);

    this.pageSize = 4;
    this.page = 0;
    this.pois = [];
    this.activeCategory = 'all';
    this.token = null;
    this.tokenExpiry = 0;

    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      const query = this.input.value.trim();
      if (query) this.search(query);
    });

    this.renderIdle();
  }

  hasCredentials() {
    return AMADEUS_CLIENT_ID !== 'YOUR_AMADEUS_CLIENT_ID' && AMADEUS_CLIENT_SECRET !== 'YOUR_AMADEUS_CLIENT_SECRET';
  }

  /* ---------------------------------------------------------------- */
  /* State renders                                                     */
  /* ---------------------------------------------------------------- */

  renderIdle() {
    this.results.innerHTML = `
      <div class="state-message">
        <i class="bi bi-globe-americas"></i>
        Search a city above to pull nearby points of interest — sights, nightlife, beaches, and more.
      </div>
    `;
    this.pagination.innerHTML = '';
    if (this.chipsBar) this.chipsBar.innerHTML = '';
  }

  renderLoading() {
    this.results.innerHTML = `
      <div class="state-message">
        <div class="spinner"></div>
        Fetching live points of interest…
      </div>
    `;
    this.pagination.innerHTML = '';
    if (this.chipsBar) this.chipsBar.innerHTML = '';
  }

  renderError(message) {
    this.results.innerHTML = `
      <div class="state-message">
        <i class="bi bi-exclamation-triangle"></i>
        ${message}
      </div>
    `;
    this.pagination.innerHTML = '';
  }

  renderEmpty(query) {
    this.results.innerHTML = `
      <div class="state-message">
        <i class="bi bi-search"></i>
        No points of interest found for "${query}" — try a bigger nearby city.
      </div>
    `;
    this.pagination.innerHTML = '';
  }

  /* ---------------------------------------------------------------- */
  /* Amadeus calls                                                     */
  /* ---------------------------------------------------------------- */

  async getToken() {
    if (this.token && Date.now() < this.tokenExpiry) return this.token;

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: AMADEUS_CLIENT_ID,
      client_secret: AMADEUS_CLIENT_SECRET,
    });

    const res = await fetch(`${AMADEUS_BASE}/v1/security/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!res.ok) throw new Error('That Amadeus key was rejected — double-check it in js/api.js.');

    const data = await res.json();
    this.token = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in - 30) * 1000;
    return this.token;
  }

  async geocodeCity(name) {
    const token = await this.getToken();
    const url = `${AMADEUS_BASE}/v1/reference-data/locations?keyword=${encodeURIComponent(name)}&subType=CITY`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error('The live data service is unavailable right now. Please try again shortly.');
    const data = await res.json();
    return data.data?.[0] || null;
  }

  async fetchPOIs(latitude, longitude) {
    const token = await this.getToken();
    const url = `${AMADEUS_BASE}/v1/reference-data/locations/pois?latitude=${latitude}&longitude=${longitude}&radius=20`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error('The live data service is unavailable right now. Please try again shortly.');
    const data = await res.json();
    return data.data || [];
  }

  /* ---------------------------------------------------------------- */
  /* Orchestration                                                     */
  /* ---------------------------------------------------------------- */

  async search(query) {
    this.renderLoading();

    if (!this.hasCredentials()) {
      await this.wait(500);
      this.pois = AmadeusExplorer.sampleData(query);
      if (this.hint) this.hint.textContent = 'Showing sample data — add your Amadeus keys in js/api.js for live results.';
      this.page = 0;
      this.activeCategory = 'all';
      this.pois.length ? this.finishLoad() : this.renderEmpty(query);
      return;
    }

    try {
      const city = await this.geocodeCity(query);
      if (!city) return this.renderEmpty(query);

      const pois = await this.fetchPOIs(city.geoCode.latitude, city.geoCode.longitude);
      this.pois = pois;
      this.page = 0;
      this.activeCategory = 'all';
      pois.length ? this.finishLoad() : this.renderEmpty(query);
    } catch (err) {
      this.renderError(err.message || 'Something went wrong reaching the live data service.');
    }
  }

  finishLoad() {
    this.renderCategoryChips();
    this.renderPage();
  }

  renderCategoryChips() {
    if (!this.chipsBar) return;
    const categories = ['all', ...new Set(this.pois.map((p) => p.category).filter(Boolean))];
    this.chipsBar.innerHTML = categories.map((cat) => `
      <button class="chip${cat === this.activeCategory ? ' is-active' : ''}" type="button" data-category="${cat}">
        ${cat === 'all' ? 'All' : cat.replace('_', ' ')}
      </button>
    `).join('');

    this.chipsBar.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        this.activeCategory = chip.dataset.category;
        this.page = 0;
        this.chipsBar.querySelectorAll('.chip').forEach((c) => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        this.renderPage();
      });
    });
  }

  get filteredPOIs() {
    return this.activeCategory === 'all' ? this.pois : this.pois.filter((p) => p.category === this.activeCategory);
  }

  renderPage() {
    const filtered = this.filteredPOIs;
    const start = this.page * this.pageSize;
    const pageItems = filtered.slice(start, start + this.pageSize);

    this.results.innerHTML = pageItems.length
      ? pageItems.map((p) => `
        <div class="poi-card">
          <span class="poi-card__category">${(p.category || 'spot').replace('_', ' ')}</span>
          <h4 class="poi-card__name">${p.name}</h4>
          <div class="poi-card__meta">${p.tags?.slice(0, 3).join(' · ') || 'Nearby point of interest'}</div>
        </div>
      `).join('')
      : `<div class="state-message"><i class="bi bi-filter"></i>No results in this category — try "All".</div>`;

    this.renderPagination(filtered.length);
  }

  renderPagination(total) {
    const totalPages = Math.ceil(total / this.pageSize);
    if (totalPages <= 1) { this.pagination.innerHTML = ''; return; }

    this.pagination.innerHTML = `
      <button type="button" id="apiPrevPage" ${this.page === 0 ? 'disabled' : ''} aria-label="Previous page"><i class="bi bi-chevron-left"></i></button>
      <span>Page ${this.page + 1} of ${totalPages}</span>
      <button type="button" id="apiNextPage" ${this.page >= totalPages - 1 ? 'disabled' : ''} aria-label="Next page"><i class="bi bi-chevron-right"></i></button>
    `;

    this.pagination.querySelector('#apiPrevPage')?.addEventListener('click', () => { this.page -= 1; this.renderPage(); });
    this.pagination.querySelector('#apiNextPage')?.addEventListener('click', () => { this.page += 1; this.renderPage(); });
  }

  wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

  /** Small labeled sample set so the panel is demonstrable without live keys. */
  static sampleData(query) {
    const byCity = {
      beirut: [
        { name: 'Raouche Rocks', category: 'SIGHTS', tags: ['landmark', 'coastline'] },
        { name: 'Gemmayze Nightlife Strip', category: 'NIGHTLIFE', tags: ['bars', 'live music'] },
        { name: 'National Museum of Beirut', category: 'HISTORICAL', tags: ['museum', 'heritage'] },
        { name: 'Zaitunay Bay', category: 'RESTAURANT', tags: ['seafront dining'] },
      ],
      santorini: [
        { name: 'Oia Sunset Point', category: 'SIGHTS', tags: ['caldera', 'sunset'] },
        { name: 'Perissa Black Sand Beach', category: 'BEACH_PARK', tags: ['beach', 'swimming'] },
        { name: 'Akrotiri Archaeological Site', category: 'HISTORICAL', tags: ['ruins', 'bronze age'] },
      ],
      kyoto: [
        { name: 'Fushimi Inari Shrine', category: 'HISTORICAL', tags: ['shrine', 'heritage'] },
        { name: 'Gion Nightlife District', category: 'NIGHTLIFE', tags: ['geisha district'] },
        { name: 'Nishiki Market', category: 'SHOPPING', tags: ['street food', 'market'] },
      ],
      marrakech: [
        { name: 'Jemaa el-Fnaa', category: 'SIGHTS', tags: ['square', 'street performers'] },
        { name: 'Bahia Palace', category: 'HISTORICAL', tags: ['palace', 'architecture'] },
        { name: 'Souk Semmarine', category: 'SHOPPING', tags: ['market', 'crafts'] },
      ],
    };

    const key = Object.keys(byCity).find((c) => c.includes(query.toLowerCase()) || query.toLowerCase().includes(c));
    return key ? byCity[key] : [];
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new AmadeusExplorer({
    formSelector: '#apiForm',
    inputSelector: '#apiInput',
    resultsSelector: '#apiResults',
    paginationSelector: '#apiPagination',
    hintSelector: '#apiHint',
    chipsSelector: '#apiChips',
  });
});