/**
 * SearchUI
 * Every DOM read/write for the search page lives here. It knows nothing
 * about filtering logic or where results come from — it just renders
 * whatever it's given and reports user interactions back through the
 * callbacks passed into bind().
 */
class SearchUI {
  constructor() {
    this.searchInput = document.getElementById('searchInput');
    this.quickChips = document.getElementById('quickChips');
    this.sortSelect = document.getElementById('sortSelect');
    this.regionToggle = document.getElementById('searchRegionToggle');
    this.filtersToggle = document.getElementById('filtersToggle');
    this.filtersPanel = document.getElementById('filtersPanel');
    this.filtersBadge = document.getElementById('filtersBadge');
    this.priceChips = document.getElementById('priceChips');
    this.ratingStars = document.getElementById('ratingStars');
    this.clearBtn = document.getElementById('clearFilters');
    this.applyBtn = document.getElementById('applyFilters');
    this.countEl = document.getElementById('resultsCount');
    this.grid = document.getElementById('resultsGrid');
    this.sentinel = document.getElementById('resultsSentinel');
    this.liveStatus = document.getElementById('liveStatus');
  }

  bind({ onSearch, onChipToggle, onPriceTier, onRating, onSort, onRegion, onClear, onApply, onLoadMore }) {
    if (this.searchInput) {
      let debounce;
      const fire = () => onSearch(this.searchInput.value.trim());
      this.searchInput.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(fire, 400);
      });
      this.searchInput.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        clearTimeout(debounce);
        fire();
      });
    }

    if (this.quickChips) {
      this.quickChips.addEventListener('click', (e) => {
        const chip = e.target.closest('.chip');
        if (!chip) return;
        chip.classList.toggle('is-active');
        onChipToggle(chip.dataset.value, chip.classList.contains('is-active'));
      });
    }

    if (this.priceChips) {
      this.priceChips.addEventListener('click', (e) => {
        const chip = e.target.closest('.chip');
        if (!chip) return;
        this.priceChips.querySelectorAll('.chip').forEach((c) => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        onPriceTier(chip.dataset.value || null);
      });
    }

    if (this.ratingStars) {
      this.ratingStars.addEventListener('click', (e) => {
        const star = e.target.closest('.rating-star');
        if (!star) return;
        const value = Number(star.dataset.value);
        const current = Number(this.ratingStars.dataset.value || 0);
        const next = current === value ? 0 : value; // clicking the active star resets to "Any"
        this.setRatingStars(next);
        onRating(next);
      });
    }

    if (this.sortSelect) {
      this.sortSelect.addEventListener('change', () => onSort(this.sortSelect.value));
    }

    if (this.regionToggle) {
      this.regionToggle.querySelectorAll('.toggle-group__btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.regionToggle.querySelectorAll('.toggle-group__btn').forEach((b) => b.classList.remove('is-active'));
          btn.classList.add('is-active');
          onRegion(btn.dataset.filter);
        });
      });
    }

    if (this.filtersToggle && this.filtersPanel) {
      this.filtersToggle.addEventListener('click', () => {
        const open = this.filtersPanel.classList.toggle('is-open');
        this.filtersToggle.classList.toggle('is-open', open);
        this.filtersToggle.setAttribute('aria-expanded', String(open));
      });
    }

    if (this.clearBtn) this.clearBtn.addEventListener('click', () => onClear());

    if (this.applyBtn) {
      this.applyBtn.addEventListener('click', () => {
        onApply();
        this.filtersPanel?.classList.remove('is-open');
        this.filtersToggle?.classList.remove('is-open');
      });
    }

    if (this.sentinel && onLoadMore) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => { if (entry.isIntersecting) onLoadMore(); });
      }, { rootMargin: '400px' });
      observer.observe(this.sentinel);
    }
  }

  /** Quick filter chips, generated from data — appends only what's missing so an in-progress selection survives a refresh. */
  renderQuickChips(values, activeSet) {
    if (!this.quickChips) return;
    const existing = new Set([...this.quickChips.querySelectorAll('.chip')].map((c) => c.dataset.value));
    values.filter((v) => !existing.has(v)).forEach((v) => {
      const chip = document.createElement('button');
      chip.className = 'chip';
      chip.type = 'button';
      chip.dataset.value = v;
      chip.textContent = v.replace('-', ' ');
      if (activeSet.has(v)) chip.classList.add('is-active');
      this.quickChips.appendChild(chip);
    });
  }

  setRatingStars(value) {
    if (!this.ratingStars) return;
    this.ratingStars.dataset.value = String(value);
    this.ratingStars.querySelectorAll('.rating-star').forEach((star) => {
      star.classList.toggle('is-active', Number(star.dataset.value) <= value);
    });
    const label = document.getElementById('ratingLabel');
    if (label) label.textContent = value > 0 ? `${value}+ stars` : 'Any rating';
  }

  setPriceTier(tier) {
    if (!this.priceChips) return;
    this.priceChips.querySelectorAll('.chip').forEach((c) => {
      c.classList.toggle('is-active', (c.dataset.value || null) === tier);
    });
  }

  setBadge(n) {
    if (!this.filtersBadge) return;
    this.filtersBadge.hidden = n === 0;
    this.filtersBadge.textContent = String(n);
  }

  setLiveStatus(html) {
    if (this.liveStatus) this.liveStatus.innerHTML = html;
  }

  setCount(n) {
    if (this.countEl) this.countEl.textContent = `${n} destination${n === 1 ? '' : 's'} found`;
  }

  /** Renders the full visible slice. `append` adds a batch to the bottom (infinite scroll) instead of replacing everything. */
  renderResults(spots, { append = false } = {}) {
    if (!this.grid) return;
    if (!spots.length && !append) {
      this.grid.innerHTML = `
        <div class="state-message">
          <i class="bi bi-compass"></i>
          No spots match those filters yet — try widening your search.
        </div>
      `;
      return;
    }
    const html = spots.map((spot) => spot.toGridHTML()).join('');
    if (append) this.grid.insertAdjacentHTML('beforeend', html);
    else this.grid.innerHTML = html;
  }

  setSentinelVisible(visible) {
    if (this.sentinel) this.sentinel.style.display = visible ? 'block' : 'none';
  }
}