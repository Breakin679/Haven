/**
 * SpotBrowser
 * Drives the Discovery Engine.
 *
 * Design choices worth noting:
 *  - Region (Local/Global) and the free-text search are HARD filters —
 *    both are unambiguous, so it's correct to exclude non-matches.
 *  - Everything else (type, price, rating, serenity, atmosphere,
 *    interests, location) is used to SCORE each spot instead of
 *    excluding it. Nothing here has "wrong" answers, and hard-filtering
 *    seven independent facets would constantly dead-end on zero results.
 *    Scoring means the best matches simply float to the top.
 *  - Results are paginated client-side ("Load more") so a long list
 *    never dumps onto the screen at once.
 */
class SpotBrowser {
  constructor({ gridSelector, countSelector }) {
    this.grid = document.querySelector(gridSelector);
    if (!this.grid) return;

    this.countEl = document.querySelector(countSelector);
    this.spots = DestinationCatalog.buildData();

    this.state = {
      region: 'all',
      query: '',
      types: new Set(),
      priceMin: null,
      priceMax: null,
      minRating: 0,
      serenity: 'any',
      atmosphere: 'any',
      interests: new Set(),
      locations: new Set(),
      sort: 'best',
    };

    this.pageSize = 9;
    this.visibleCount = this.pageSize;

    this.buildPanelOptions();
    this.bindPrimary();
    this.bindPanel();
    this.render();
  }

  /* ---------------------------------------------------------------- */
  /* Panel construction (type / location / interest lists are derived  */
  /* from the actual data, not hand-typed, so they can't drift out of  */
  /* sync with it).                                                    */
  /* ---------------------------------------------------------------- */

  buildPanelOptions() {
    const typeList = document.getElementById('typeChecklist');
    if (typeList) {
      const allTypes = [...new Set(this.spots.flatMap((s) => s.categories))];
      typeList.innerHTML = allTypes.map((t) => `
        <label><input type="checkbox" value="${t}" data-role="type"> ${t.charAt(0).toUpperCase() + t.slice(1)}</label>
      `).join('');
    }

    const locationList = document.getElementById('locationChecklist');
    if (locationList) {
      const allCountries = [...new Set(this.spots.map((s) => s.country))].sort();
      locationList.innerHTML = allCountries.map((c) => `
        <label><input type="checkbox" value="${c}" data-role="location"> ${c}</label>
      `).join('');
    }

    const interestChips = document.getElementById('interestChips');
    if (interestChips) {
      const freq = {};
      this.spots.forEach((s) => s.tags.forEach((t) => { freq[t] = (freq[t] || 0) + 1; }));
      const topTags = Object.keys(freq).sort((a, b) => freq[b] - freq[a]).slice(0, 8);
      interestChips.innerHTML = topTags.map((t) => `
        <button class="chip" type="button" data-role="interest" data-value="${t}">${t.replace('-', ' ')}</button>
      `).join('');
    }
  }

  /* ---------------------------------------------------------------- */
  /* Primary row: search, region toggle, sort — always visible.        */
  /* ---------------------------------------------------------------- */

  bindPrimary() {
    const searchInput = document.getElementById('browseSearch');
    if (searchInput) {
      let debounce;
      searchInput.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          this.state.query = searchInput.value.trim().toLowerCase();
          this.resetAndRender();
        }, 180);
      });
    }

    const regionToggle = document.getElementById('browseRegionToggle');
    if (regionToggle) {
      regionToggle.querySelectorAll('.toggle-group__btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          regionToggle.querySelectorAll('.toggle-group__btn').forEach((b) => b.classList.remove('is-active'));
          btn.classList.add('is-active');
          this.state.region = btn.dataset.filter;
          this.resetAndRender();
        });
      });
    }

    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        this.state.sort = sortSelect.value;
        this.resetAndRender();
      });
    }

    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => {
        this.visibleCount += this.pageSize;
        this.render();
      });
    }
  }

  /* ---------------------------------------------------------------- */
  /* Advanced panel: toggle open/close + every control inside it.      */
  /* ---------------------------------------------------------------- */

  bindPanel() {
    const toggleBtn = document.getElementById('filtersToggle');
    const panel = document.getElementById('filtersPanel');
    if (toggleBtn && panel) {
      toggleBtn.addEventListener('click', () => {
        const open = panel.classList.toggle('is-open');
        toggleBtn.classList.toggle('is-open', open);
        toggleBtn.setAttribute('aria-expanded', String(open));
      });
    }

    document.querySelectorAll('input[data-role="type"]').forEach((cb) => {
      cb.addEventListener('change', () => {
        cb.checked ? this.state.types.add(cb.value) : this.state.types.delete(cb.value);
        this.resetAndRender();
      });
    });

    document.querySelectorAll('input[data-role="location"]').forEach((cb) => {
      cb.addEventListener('change', () => {
        cb.checked ? this.state.locations.add(cb.value) : this.state.locations.delete(cb.value);
        this.resetAndRender();
      });
    });

    this.bindChipGroup('ratingChips', (value) => { this.state.minRating = parseFloat(value); });
    this.bindChipGroup('serenityChips', (value) => { this.state.serenity = value; });
    this.bindChipGroup('atmosphereChips', (value) => { this.state.atmosphere = value; });

    // Interests are multi-select chips (toggle on/off), unlike the single-select ones above.
    const interestChips = document.getElementById('interestChips');
    if (interestChips) {
      interestChips.addEventListener('click', (e) => {
        const chip = e.target.closest('.chip');
        if (!chip) return;
        chip.classList.toggle('is-active');
        chip.classList.contains('is-active') ? this.state.interests.add(chip.dataset.value) : this.state.interests.delete(chip.dataset.value);
        this.resetAndRender();
      });
    }

    const priceMin = document.getElementById('priceMin');
    const priceMax = document.getElementById('priceMax');
    [priceMin, priceMax].forEach((input) => {
      if (!input) return;
      let debounce;
      input.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          this.state.priceMin = priceMin.value ? Number(priceMin.value) : null;
          this.state.priceMax = priceMax.value ? Number(priceMax.value) : null;
          this.resetAndRender();
        }, 250);
      });
    });

    const clearBtn = document.getElementById('clearFilters');
    if (clearBtn) clearBtn.addEventListener('click', () => this.clearFilters());

    const applyBtn = document.getElementById('applyFilters');
    if (applyBtn && document.getElementById('filtersPanel')) {
      applyBtn.addEventListener('click', () => {
        document.getElementById('filtersPanel').classList.remove('is-open');
        document.getElementById('filtersToggle')?.classList.remove('is-open');
      });
    }
  }

  bindChipGroup(containerId, onSelect) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      container.querySelectorAll('.chip').forEach((c) => c.classList.remove('is-active'));
      chip.classList.add('is-active');
      onSelect(chip.dataset.value);
      this.resetAndRender();
    });
  }

  clearFilters() {
    this.state.types.clear();
    this.state.interests.clear();
    this.state.locations.clear();
    this.state.priceMin = null;
    this.state.priceMax = null;
    this.state.minRating = 0;
    this.state.serenity = 'any';
    this.state.atmosphere = 'any';

    document.querySelectorAll('input[data-role="type"], input[data-role="location"]').forEach((cb) => { cb.checked = false; });
    document.querySelectorAll('#interestChips .chip').forEach((c) => c.classList.remove('is-active'));
    ['ratingChips', 'serenityChips', 'atmosphereChips'].forEach((id) => {
      const group = document.getElementById(id);
      if (!group) return;
      group.querySelectorAll('.chip').forEach((c, i) => c.classList.toggle('is-active', i === 0));
    });
    const priceMin = document.getElementById('priceMin');
    const priceMax = document.getElementById('priceMax');
    if (priceMin) priceMin.value = '';
    if (priceMax) priceMax.value = '';

    this.resetAndRender();
  }

  /* ---------------------------------------------------------------- */
  /* Filtering (hard) + scoring (soft) + sorting                       */
  /* ---------------------------------------------------------------- */

  get activeFilterCount() {
    let n = this.state.types.size + this.state.interests.size + this.state.locations.size;
    if (this.state.priceMin !== null || this.state.priceMax !== null) n += 1;
    if (this.state.minRating > 0) n += 1;
    if (this.state.serenity !== 'any') n += 1;
    if (this.state.atmosphere !== 'any') n += 1;
    return n;
  }

  scoreSpot(spot) {
    const s = this.state;
    let score = 0;

    if (s.types.size) {
      const overlap = spot.categories.filter((c) => s.types.has(c)).length;
      score += overlap * 3;
    }

    if (s.priceMin !== null || s.priceMax !== null) {
      const min = s.priceMin ?? 0;
      const max = s.priceMax ?? Infinity;
      if (spot.price >= min && spot.price <= max) score += 3;
    }

    if (s.minRating > 0) {
      score += spot.rating >= s.minRating ? 2 : (spot.rating / s.minRating) * 0.5;
    }

    if (s.serenity !== 'any') score += spot.serenity === s.serenity ? 2 : 0;
    if (s.atmosphere !== 'any') score += spot.atmosphere === s.atmosphere ? 2 : 0;

    if (s.interests.size) {
      const overlap = spot.tags.filter((t) => s.interests.has(t)).length;
      score += overlap * 1.5;
    }

    if (s.locations.size) score += s.locations.has(spot.country) ? 3 : 0;

    return score;
  }

  get processedList() {
    const s = this.state;

    let list = this.spots.filter((spot) => {
      if (s.region !== 'all' && spot.region !== s.region) return false;
      if (!spot.matchesQuery(s.query)) return false;
      return true;
    });

    if (s.sort === 'price-asc') return list.sort((a, b) => a.price - b.price);
    if (s.sort === 'price-desc') return list.sort((a, b) => b.price - a.price);
    if (s.sort === 'rating-desc') return list.sort((a, b) => b.rating - a.rating);
    if (s.sort === 'name-asc') return list.sort((a, b) => a.name.localeCompare(b.name));

    // 'best' — relevance score, tie-broken by rating so the default view still feels curated.
    return list
      .map((spot) => ({ spot, score: this.scoreSpot(spot) }))
      .sort((a, b) => b.score - a.score || b.spot.rating - a.spot.rating)
      .map((entry) => entry.spot);
  }

  resetAndRender() {
    this.visibleCount = this.pageSize;
    this.render();
  }

  render() {
    const results = this.processedList;
    const visible = results.slice(0, this.visibleCount);

    if (this.countEl) {
      this.countEl.textContent = `${results.length} spot${results.length === 1 ? '' : 's'} found`;
    }

    this.grid.innerHTML = visible.length
      ? visible.map((spot) => spot.toGridHTML()).join('')
      : `
        <div class="state-message">
          <i class="bi bi-compass"></i>
          No spots match those filters yet — try widening your search.
        </div>
      `;

    const badge = document.getElementById('filtersBadge');
    if (badge) {
      const n = this.activeFilterCount;
      badge.hidden = n === 0;
      badge.textContent = String(n);
    }

    const loadMoreWrap = document.querySelector('.load-more-wrap');
    if (loadMoreWrap) loadMoreWrap.style.display = this.visibleCount < results.length ? 'flex' : 'none';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new SpotBrowser({
    gridSelector: '#browseGrid',
    countSelector: '#browseCount',
  });
});