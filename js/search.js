/**
 * SpotBrowser
 * Drives the Discovery Engine's plain results grid: combines the
 * Local/Global toggle, the Wedding/Vacation and Budget dropdowns, and a
 * free-text search box into one filtered view over our own curated data
 * (the same Destination list used on the home page carousel).
 */
class SpotBrowser {
  constructor({ gridSelector, toggleSelector, categorySelector, budgetSelector, searchSelector, countSelector }) {
    this.grid = document.querySelector(gridSelector);
    if (!this.grid) return;

    this.toggleGroup = document.querySelector(toggleSelector);
    this.categorySelect = document.querySelector(categorySelector);
    this.budgetSelect = document.querySelector(budgetSelector);
    this.searchInput = document.querySelector(searchSelector);
    this.countEl = document.querySelector(countSelector);

    this.spots = DestinationCatalog.buildData();
    this.state = { region: 'all', category: 'all', budget: 'all', query: '' };

    this.bindEvents();
    this.render();
  }

  bindEvents() {
    if (this.toggleGroup) {
      this.toggleGroup.querySelectorAll('.toggle-group__btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.toggleGroup.querySelectorAll('.toggle-group__btn').forEach((b) => b.classList.remove('is-active'));
          btn.classList.add('is-active');
          this.state.region = btn.dataset.filter;
          this.render();
        });
      });
    }

    if (this.categorySelect) {
      this.categorySelect.addEventListener('change', () => {
        this.state.category = this.categorySelect.value;
        this.render();
      });
    }

    if (this.budgetSelect) {
      this.budgetSelect.addEventListener('change', () => {
        this.state.budget = this.budgetSelect.value;
        this.render();
      });
    }

    if (this.searchInput) {
      let debounce;
      this.searchInput.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          this.state.query = this.searchInput.value.trim().toLowerCase();
          this.render();
        }, 180);
      });
    }
  }

  get filtered() {
    const { region, category, budget, query } = this.state;
    return this.spots.filter((spot) => {
      if (region !== 'all' && spot.region !== region) return false;
      if (category !== 'all' && !spot.categories.includes(category)) return false;
      if (budget !== 'all' && spot.priceTier !== budget) return false;
      if (query && !`${spot.name} ${spot.country}`.toLowerCase().includes(query)) return false;
      return true;
    });
  }

  render() {
    const results = this.filtered;

    if (this.countEl) {
      this.countEl.textContent = `${results.length} spot${results.length === 1 ? '' : 's'} found`;
    }

    this.grid.innerHTML = results.length
      ? results.map((spot) => spot.toGridHTML()).join('')
      : `
        <div class="state-message">
          <i class="bi bi-compass"></i>
          No spots match those filters yet — try widening your search.
        </div>
      `;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new SpotBrowser({
    gridSelector: '#browseGrid',
    toggleSelector: '#browseRegionToggle',
    categorySelector: '#categoryFilter',
    budgetSelector: '#budgetFilter',
    searchSelector: '#browseSearch',
    countSelector: '#browseCount',
  });
});