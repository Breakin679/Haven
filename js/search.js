/**
 * SpotBrowser
 * Drives the Discovery Engine page: curated data + live API results in one
 * pool, one set of hard filters, one ranked "best match" sort.
 */
class SpotBrowser {
  constructor({ gridSelector, countSelector }) {
    this.grid = document.querySelector(gridSelector);
    this.countEl = document.querySelector(countSelector);
    if (!this.grid) return;

    this.spots = DestinationCatalog.buildData();
    DestinationCatalog.persist(this.spots); // so details.html can look up curated spots even if home was never visited

    this.state = {
      query: '',
      types: new Set(),
      priceMin: null,
      priceMax: null,
      minRating: 0,
      interests: new Set(),
      location: 'all',
      sort: 'best',
    };

    // Results are capped to the top 30 best matches overall; "Load more"
    // reveals them 10 at a time until that cap.
    this.pageSize = 10;
    this.maxResults = 30;
    this.visibleCount = this.pageSize;

    // Live API plumbing: typing a search auto-fetches matching live spots
    // from OpenStreetMap and merges them into the same pool. lastPlace
    // caches the last geocoded city so a Type filter change can re-query
    // Overpass at the same coordinates without geocoding again.
    this.liveClient = new LiveSpotClient();
    this.liveQueriesFetched = new Set();
    this.liveCounter = 0;
    this.lastPlace = null;
    this.refineDebounce = null;

    this.buildPanelOptions();
    this.bindPrimary();
    this.bindPanel();
    this.render();
  }

  /* ---------------------------------------------------------------- */
  /* Setup                                                              */
  /* ---------------------------------------------------------------- */

  buildPanelOptions() {
    this.refreshChipOptions('typeChips', [...new Set(this.spots.flatMap((s) => s.categories))], (t) => t.charAt(0).toUpperCase() + t.slice(1));
    this.refreshSelectOptions('locationSelect', [...new Set(this.spots.map((s) => s.country))].sort());

    const interestChips = document.getElementById('interestChips');
    if (interestChips) {
      const freq = {};
      this.spots.forEach((s) => SpotBrowser.interestPool(s).forEach((t) => { freq[t] = (freq[t] || 0) + 1; }));
      const topTags = Object.keys(freq).sort((a, b) => freq[b] - freq[a]).slice(0, 12);
      const existing = new Set([...interestChips.querySelectorAll('.chip')].map((c) => c.dataset.value));
      topTags.filter((t) => !existing.has(t)).forEach((t) => {
        const chip = document.createElement('button');
        chip.className = 'chip';
        chip.type = 'button';
        chip.dataset.role = 'interest';
        chip.dataset.value = t;
        chip.textContent = SpotBrowser.interestLabel(t);
        interestChips.appendChild(chip);
      });
    }
  }

  /**
   * Serenity and atmosphere used to be their own filter groups, but they
   * overlapped heavily with "Interests" (both are really just vibe
   * descriptors). They now live in the same tag pool so a single
   * Interests chip set covers "quiet", "luxury", "beachfront", etc.
   * without three separate near-duplicate controls.
   */
  static interestPool(spot) { return [...spot.tags, spot.atmosphere, spot.serenity].filter(Boolean); }

  static interestLabel(value) {
    return SpotBrowser.SERENITY_LABELS[value] || SpotBrowser.ATMOSPHERE_LABELS[value] || value.replace(/-/g, ' ');
  }

  refreshChipOptions(containerId, values, labelFor) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const existing = new Set([...container.querySelectorAll('.chip')].map((c) => c.dataset.value));
    values.filter((v) => !existing.has(v)).forEach((v) => {
      const chip = document.createElement('button');
      chip.className = 'chip';
      chip.type = 'button';
      chip.dataset.value = v;
      chip.textContent = labelFor(v);
      container.appendChild(chip);
    });
  }

  refreshSelectOptions(selectId, values) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const existing = new Set([...select.options].map((o) => o.value));
    values.filter((v) => !existing.has(v)).forEach((v) => {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      select.appendChild(opt);
    });
  }

  bindPrimary() {
    const searchInput = document.getElementById('browseSearch');
    if (searchInput) {
      let filterDebounce;
      let liveDebounce;
      const applyFilterNow = () => { this.state.query = searchInput.value.trim().toLowerCase(); this.resetAndRender(); };
      const triggerLiveFetchNow = () => this.maybeFetchLiveSpots(searchInput.value.trim());

      searchInput.addEventListener('input', () => {
        clearTimeout(filterDebounce);
        filterDebounce = setTimeout(applyFilterNow, 180);
        clearTimeout(liveDebounce);
        liveDebounce = setTimeout(triggerLiveFetchNow, 600);
      });
      searchInput.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        clearTimeout(filterDebounce);
        clearTimeout(liveDebounce);
        applyFilterNow();
        triggerLiveFetchNow();
      });
    }

    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) sortSelect.addEventListener('change', () => { this.state.sort = sortSelect.value; this.render(); });

    const filtersToggle = document.getElementById('filtersToggle');
    const filtersPanel = document.getElementById('filtersPanel');
    if (filtersToggle && filtersPanel) {
      filtersToggle.addEventListener('click', () => {
        const open = filtersPanel.classList.toggle('is-open');
        filtersToggle.classList.toggle('is-open', open);
        filtersToggle.setAttribute('aria-expanded', String(open));
      });
    }

    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => {
        this.visibleCount = Math.min(this.visibleCount + this.pageSize, this.maxResults);
        this.render();
        this.fetchLiveForCurrentQuery();
      });
    }
  }

  bindPanel() {
    const typeChips = document.getElementById('typeChips');
    if (typeChips) {
      typeChips.addEventListener('click', (e) => {
        const chip = e.target.closest('.chip');
        if (!chip) return;
        chip.classList.toggle('is-active');
        chip.classList.contains('is-active') ? this.state.types.add(chip.dataset.value) : this.state.types.delete(chip.dataset.value);
        this.onTypesChanged();
      });
    }

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

    const locationSelect = document.getElementById('locationSelect');
    if (locationSelect) {
      locationSelect.addEventListener('change', () => {
        this.state.location = locationSelect.value || 'all';
        this.resetAndRender();
      });
    }

    const ratingSlider = document.getElementById('ratingSlider');
    const ratingValueEl = document.getElementById('ratingValue');
    if (ratingSlider) {
      let ratingDebounce;
      ratingSlider.addEventListener('input', () => {
        const value = parseFloat(ratingSlider.value);
        if (ratingValueEl) ratingValueEl.textContent = value <= 0 ? 'Any' : `${value.toFixed(1)}+`;
        clearTimeout(ratingDebounce);
        ratingDebounce = setTimeout(() => { this.state.minRating = value; this.resetAndRender(); }, 120);
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
          this.state.priceMin = priceMin?.value ? Number(priceMin.value) : null;
          this.state.priceMax = priceMax?.value ? Number(priceMax.value) : null;
          this.resetAndRender();
        }, 250);
      });
    });

    const clearBtn = document.getElementById('clearFilters');
    if (clearBtn) clearBtn.addEventListener('click', () => this.clearFilters());

    const applyBtn = document.getElementById('applyFilters');
    if (applyBtn && document.getElementById('filtersPanel')) {
      applyBtn.addEventListener('click', () => {
        this.resetAndRender();
        this.refineLiveForFilters();
        document.getElementById('filtersPanel').classList.remove('is-open');
        document.getElementById('filtersToggle')?.classList.remove('is-open');
      });
    }
  }

  /* ---------------------------------------------------------------- */
  /* Filtering, ranking, sorting                                        */
  /* ---------------------------------------------------------------- */

  static SERENITY_LABELS = { high: 'Quiet & serene', medium: 'Balanced', low: 'Lively & social' };
  static ATMOSPHERE_LABELS = { historical: 'Historical', rustic: 'Rustic', modern: 'Modern', luxury: 'Luxury', cozy: 'Cozy' };

  get activeFilterCount() {
    let n = this.state.types.size + this.state.interests.size;
    if (this.state.location !== 'all') n += 1;
    if (this.state.priceMin !== null || this.state.priceMax !== null) n += 1;
    if (this.state.minRating > 0) n += 1;
    return n;
  }

  /**
   * Hard filters — checking "Wedding" means you only see weddings, not
   * just weddings nudged higher while everything else stays visible.
   * Facets are AND'ed together; multi-select facets (type/interests) are
   * OR'd internally (matching any one selected value is enough).
   */
  passesFilters(spot) {
    const s = this.state;
    if (!spot.matchesQuery(s.query)) return false;
    if (s.types.size && !spot.categories.some((c) => s.types.has(c))) return false;
    if (s.location !== 'all' && spot.country !== s.location) return false;

    if (s.priceMin !== null || s.priceMax !== null) {
      if (spot.price == null) return false;
      const min = s.priceMin ?? 0;
      const max = s.priceMax ?? Infinity;
      if (spot.price < min || spot.price > max) return false;
    }

    if (s.minRating > 0 && (spot.rating == null || spot.rating < s.minRating)) return false;
    if (s.interests.size && !SpotBrowser.interestPool(spot).some((t) => s.interests.has(t))) return false;

    return true;
  }

  scoreSpot(spot) {
    const s = this.state;
    let score = spot.rating ?? 0;
    if (spot.isLive) score += 0.5;
    if (s.interests.size) score += SpotBrowser.interestPool(spot).filter((t) => s.interests.has(t)).length * 1.5;
    if (s.types.size) score += spot.categories.filter((c) => s.types.has(c)).length * 0.5;
    return score;
  }

  get processedList() {
    const s = this.state;
    const list = this.spots.filter((spot) => this.passesFilters(spot));

    if (s.sort === 'price-asc') return list.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    if (s.sort === 'price-desc') return list.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity));
    if (s.sort === 'rating-desc') return list.sort((a, b) => (b.rating ?? -Infinity) - (a.rating ?? -Infinity));
    if (s.sort === 'name-asc') return list.sort((a, b) => a.name.localeCompare(b.name));

    return list
      .map((spot) => ({ spot, score: this.scoreSpot(spot) }))
      .sort((a, b) => b.score - a.score || a.spot.name.localeCompare(b.spot.name))
      .map((entry) => entry.spot);
  }

  /* ---------------------------------------------------------------- */
  /* Live API integration                                               */
  /* ---------------------------------------------------------------- */

  addLiveSpots(newSpots) {
    const existingKeys = new Set(this.spots.map((s) => `${s.name}|${s.country}`.toLowerCase()));
    const fresh = newSpots.filter((s) => !existingKeys.has(`${s.name}|${s.country}`.toLowerCase()));
    if (!fresh.length) return 0;

    this.spots.push(...fresh);
    DestinationCatalog.persist(this.spots); // so clicking into a live spot's details page works
    this.buildPanelOptions();
    this.visibleCount = Math.min(this.visibleCount + fresh.length, this.maxResults);
    this.render();
    return fresh.length;
  }

  setLiveStatus(html) {
    const el = document.getElementById('liveStatus');
    if (el) el.innerHTML = html;
  }

  async maybeFetchLiveSpots(query) {
    const key = query.trim().toLowerCase();
    if (key.length < 3 || this.liveQueriesFetched.has(key)) return;
    this.liveQueriesFetched.add(key);

    this.setLiveStatus(`<div class="spinner spinner--inline"></div> Looking for live spots in "${query}"…`);

    try {
      const { spots, cityLabel, countryLabel, sample, lat, lon, region } = await this.liveClient.fetchLiveSpots(query, `live-${this.liveCounter++}`, this.state.types);

      if (lat != null && lon != null) this.lastPlace = { lat, lon, cityLabel, countryLabel, region };

      if (!spots.length) { this.setLiveStatus(''); return; }

      const added = this.addLiveSpots(spots);
      if (!added) { this.setLiveStatus(''); return; }
      const place = countryLabel ? `${cityLabel}, ${countryLabel}` : cityLabel;
      const sampleNote = sample ? ' (sample data — live network calls are blocked in this preview)' : '';
      this.setLiveStatus(`<i class="bi bi-broadcast"></i> Added ${added} live spot${added === 1 ? '' : 's'} for ${place}${sampleNote}.`);
    } catch (err) {
      this.setLiveStatus('');
    }
  }

  refineLiveForFilters() {
    clearTimeout(this.refineDebounce);
    this.refineDebounce = setTimeout(async () => {
      if (!this.lastPlace) return;
      const { lat, lon, cityLabel, countryLabel, region } = this.lastPlace;
      this.setLiveStatus(`<div class="spinner spinner--inline"></div> Refining live spots for "${cityLabel}"…`);
      try {
        const spots = await this.liveClient.spotsFromPOIs(lat, lon, countryLabel, region, `live-${this.liveCounter++}`, this.state.types, cityLabel);
        const added = spots.length ? this.addLiveSpots(spots) : 0;
        const place = countryLabel ? `${cityLabel}, ${countryLabel}` : cityLabel;
        this.setLiveStatus(added
          ? `<i class="bi bi-broadcast"></i> ${added} new live match${added === 1 ? '' : 'es'} for ${place} with these filters.`
          : `<i class="bi bi-broadcast"></i> Live spots for ${place} already reflect these filters.`);
      } catch (err) {
        this.setLiveStatus('');
      }
    }, 400);
  }

  onTypesChanged() {
    this.resetAndRender();
    this.refineLiveForFilters();
  }

  /* ---------------------------------------------------------------- */
  /* Rendering                                                          */
  /* ---------------------------------------------------------------- */

  resetAndRender() {
    this.visibleCount = this.pageSize;
    this.render();
    this.fetchLiveForCurrentQuery();
  }

  /**
   * Any filter/sort change, "Show Results", or "Load More" should surface
   * live API results too — not just the debounced search-box typing. This
   * reuses maybeFetchLiveSpots' own dedup cache, so calling it repeatedly
   * (once per filter change) never re-fetches the same city twice.
   */
  fetchLiveForCurrentQuery() {
    const searchInput = document.getElementById('browseSearch');
    const query = searchInput ? searchInput.value.trim() : '';
    if (query) this.maybeFetchLiveSpots(query);
  }

  clearFilters() {
    this.state.types.clear();
    this.state.interests.clear();
    this.state.location = 'all';
    this.state.priceMin = null;
    this.state.priceMax = null;
    this.state.minRating = 0;

    document.querySelectorAll('#typeChips .chip').forEach((c) => c.classList.remove('is-active'));
    const locationSelect = document.getElementById('locationSelect');
    if (locationSelect) locationSelect.value = '';
    document.querySelectorAll('#interestChips .chip').forEach((c) => c.classList.remove('is-active'));
    const ratingSlider = document.getElementById('ratingSlider');
    const ratingValueEl = document.getElementById('ratingValue');
    if (ratingSlider) ratingSlider.value = '0';
    if (ratingValueEl) ratingValueEl.textContent = 'Any';
    const priceMin = document.getElementById('priceMin');
    const priceMax = document.getElementById('priceMax');
    if (priceMin) priceMin.value = '';
    if (priceMax) priceMax.value = '';

    this.resetAndRender();
    this.refineLiveForFilters();
  }

  renderActiveFilters() {
    const bar = document.getElementById('activeFiltersBar');
    if (!bar) return;
    const s = this.state;
    const pills = [];

    s.types.forEach((t) => pills.push({
      label: t.charAt(0).toUpperCase() + t.slice(1),
      remove: () => { s.types.delete(t); document.querySelector(`#typeChips .chip[data-value="${t}"]`)?.classList.remove('is-active'); this.onTypesChanged(); },
    }));
    s.interests.forEach((t) => pills.push({
      label: SpotBrowser.interestLabel(t),
      remove: () => { s.interests.delete(t); document.querySelector(`#interestChips .chip[data-value="${t}"]`)?.classList.remove('is-active'); this.resetAndRender(); },
    }));
    if (s.location !== 'all') pills.push({
      label: s.location,
      remove: () => { s.location = 'all'; const sel = document.getElementById('locationSelect'); if (sel) sel.value = ''; this.resetAndRender(); },
    });
    if (s.minRating > 0) pills.push({
      label: `${s.minRating.toFixed(1)}+ ★`,
      remove: () => {
        s.minRating = 0;
        const slider = document.getElementById('ratingSlider'); const label = document.getElementById('ratingValue');
        if (slider) slider.value = '0'; if (label) label.textContent = 'Any';
        this.resetAndRender();
      },
    });
    if (s.priceMin !== null || s.priceMax !== null) pills.push({
      label: `$${s.priceMin ?? 0}–${s.priceMax ?? '∞'}`,
      remove: () => {
        s.priceMin = null; s.priceMax = null;
        const min = document.getElementById('priceMin'); const max = document.getElementById('priceMax');
        if (min) min.value = ''; if (max) max.value = '';
        this.resetAndRender();
      },
    });

    if (!pills.length) { bar.innerHTML = ''; bar.hidden = true; return; }
    bar.hidden = false;
    bar.innerHTML = pills.map((p, i) => `<button class="active-filter-pill" type="button" data-i="${i}">${p.label} <i class="bi bi-x"></i></button>`).join('');
    bar.querySelectorAll('.active-filter-pill').forEach((btn, i) => btn.addEventListener('click', () => pills[i].remove()));
  }

  render() {
    this.renderActiveFilters();

    const results = this.processedList.slice(0, this.maxResults);
    const visible = results.slice(0, this.visibleCount);

    if (this.countEl) this.countEl.textContent = `${results.length} spot${results.length === 1 ? '' : 's'} found`;

    this.grid.innerHTML = visible.length
      ? visible.map((spot) => spot.toGridHTML()).join('')
      : `<div class="state-message"><i class="bi bi-compass"></i> No spots match those filters yet — try widening your search.</div>`;

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