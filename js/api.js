/**
 * CityExplorer
 * Talks to the API Ninjas "City" endpoint (the same X-Api-Key pattern
 * covered in class) so people can pull up live facts — population,
 * coordinates, capital status — for literally any city on earth, not just
 * our curated list. Handles loading / error / empty states, and paginates
 * the returned matches on the client (API Ninjas can return several cities
 * for an ambiguous name, e.g. "Paris" -> France, Texas, Kentucky...).
 *
 * NOTE FOR SUBMISSION: register a free key at https://api-ninjas.com and
 * paste it below. Until then the panel runs on labeled sample data so the
 * UI can still be reviewed offline.
 */
const API_NINJAS_KEY = 'YOUR_API_NINJAS_KEY'; // <-- replace with your own key

class CityExplorer {
  constructor({ formSelector, inputSelector, resultsSelector, paginationSelector, hintSelector }) {
    this.form = document.querySelector(formSelector);
    if (!this.form) return;

    this.input = document.querySelector(inputSelector);
    this.results = document.querySelector(resultsSelector);
    this.pagination = document.querySelector(paginationSelector);
    this.hint = document.querySelector(hintSelector);

    this.pageSize = 3;
    this.page = 0;
    this.cities = [];

    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      const query = this.input.value.trim();
      if (query) this.search(query);
    });

    this.renderIdle();
  }

  renderIdle() {
    this.results.innerHTML = `
      <div class="state-message">
        <i class="bi bi-globe-americas"></i>
        Search a city above to pull its live population, coordinates, and capital status.
      </div>
    `;
    this.pagination.innerHTML = '';
  }

  renderLoading() {
    this.results.innerHTML = `
      <div class="state-message">
        <div class="spinner"></div>
        Fetching live data…
      </div>
    `;
    this.pagination.innerHTML = '';
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
        No cities matched "${query}" — check the spelling and try again.
      </div>
    `;
    this.pagination.innerHTML = '';
  }

  async search(query) {
    this.renderLoading();

    if (API_NINJAS_KEY === 'YOUR_API_NINJAS_KEY') {
      // No key configured yet — fall back to clearly-labeled sample data.
      await this.wait(500);
      this.cities = CityExplorer.sampleData(query);
      if (this.hint) this.hint.textContent = 'Showing sample data — add your API Ninjas key in js/api.js for live results.';
      this.page = 0;
      this.cities.length ? this.renderPage() : this.renderEmpty(query);
      return;
    }

    try {
      const response = await fetch(`https://api.api-ninjas.com/v1/city?name=${encodeURIComponent(query)}`, {
        headers: { 'X-Api-Key': API_NINJAS_KEY },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('That API key was rejected — double-check it in js/api.js.');
        }
        if (response.status === 429) {
          throw new Error('Rate limit reached — wait a moment and try again.');
        }
        throw new Error('The live data service is unavailable right now. Please try again shortly.');
      }

      const data = await response.json();
      this.cities = data;
      this.page = 0;
      data.length ? this.renderPage() : this.renderEmpty(query);
    } catch (err) {
      this.renderError(err.message || 'Something went wrong reaching the live data service.');
    }
  }

  renderPage() {
    const start = this.page * this.pageSize;
    const pageItems = this.cities.slice(start, start + this.pageSize);

    this.results.innerHTML = pageItems.map((c) => `
      <div class="city-card">
        ${c.is_capital ? '<span class="city-card__capital">Capital</span>' : ''}
        <h4 class="city-card__name">${c.name}</h4>
        <div class="city-card__country">${c.country ? c.country.toUpperCase() : ''}</div>
        <div class="city-card__stats">
          <span>Population: ${c.population ? c.population.toLocaleString() : 'n/a'}</span>
          <span>Lat / Lng: ${c.latitude?.toFixed(2)}, ${c.longitude?.toFixed(2)}</span>
        </div>
      </div>
    `).join('');

    this.renderPagination();
  }

  renderPagination() {
    const totalPages = Math.ceil(this.cities.length / this.pageSize);
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

  /** Small labeled sample set so the panel is demonstrable without a live key. */
  static sampleData(query) {
    const all = [
      { name: 'Beirut', country: 'lb', population: 2424425, latitude: 33.8938, longitude: 35.5018, is_capital: true },
      { name: 'Santorini', country: 'gr', population: 15550, latitude: 36.3932, longitude: 25.4615, is_capital: false },
      { name: 'Paris', country: 'fr', population: 2140526, latitude: 48.8566, longitude: 2.3522, is_capital: true },
      { name: 'Paris', country: 'us', population: 25171, latitude: 33.6609, longitude: -95.5555, is_capital: false },
      { name: 'Kyoto', country: 'jp', population: 1475183, latitude: 35.0116, longitude: 135.7681, is_capital: false },
      { name: 'Marrakech', country: 'ma', population: 928850, latitude: 31.6295, longitude: -7.9811, is_capital: false },
      { name: 'Ubud', country: 'id', population: 74800, latitude: -8.5069, longitude: 115.2625, is_capital: false },
    ];
    const q = query.toLowerCase();
    return all.filter((c) => c.name.toLowerCase().includes(q));
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new CityExplorer({
    formSelector: '#apiForm',
    inputSelector: '#apiInput',
    resultsSelector: '#apiResults',
    paginationSelector: '#apiPagination',
    hintSelector: '#apiHint',
  });
});