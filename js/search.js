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
      location: 'all',
      sort: 'best',
    };

    // Results are capped to the top 30 best matches overall; "Load more"
    // reveals them 10 at a time until that cap is reached.
    this.pageSize = 10;
    this.maxResults = 30;
    this.visibleCount = this.pageSize;

    // Live API plumbing: typing a search auto-fetches matching live spots
    // from OpenStreetMap and merges them straight into the same pool.
    // lastPlace caches the last geocoded city so a Type filter change can
    // re-query Overpass at the same coordinates without geocoding again.
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
  /* Panel construction (type / location / interest lists are derived  */
  /* from the actual data, not hand-typed, so they can't drift out of  */
  /* sync with it).                                                    */
  /* ---------------------------------------------------------------- */

  buildPanelOptions() {
    this.refreshChipOptions('typeChips', 'type', [...new Set(this.spots.flatMap((s) => s.categories))], (t) => t.charAt(0).toUpperCase() + t.slice(1));
    this.refreshSelectOptions('locationSelect', [...new Set(this.spots.map((s) => s.country))].sort());

    const interestChips = document.getElementById('interestChips');
    if (interestChips) {
      const freq = {};
      this.spots.forEach((s) => s.tags.forEach((t) => { freq[t] = (freq[t] || 0) + 1; }));
      const topTags = Object.keys(freq).sort((a, b) => freq[b] - freq[a]).slice(0, 10);
      const existing = new Set([...interestChips.querySelectorAll('.chip')].map((c) => c.dataset.value));
      topTags.filter((t) => !existing.has(t)).forEach((t) => {
        const chip = document.createElement('button');
        chip.className = 'chip';
        chip.type = 'button';
        chip.dataset.role = 'interest';
        chip.dataset.value = t;
        chip.textContent = t.replace('-', ' ');
        interestChips.appendChild(chip);
      });
    }
  }

  /** Appends only the chips not already present, so an in-progress multi-selection survives re-runs (e.g. after live spots are merged in). */
  refreshChipOptions(containerId, role, values, labelFor) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const existing = new Set([...container.querySelectorAll('.chip')].map((c) => c.dataset.value));
    values.filter((v) => !existing.has(v)).forEach((v) => {
      const chip = document.createElement('button');
      chip.className = 'chip';
      chip.type = 'button';
      chip.dataset.role = role;
      chip.dataset.value = v;
      chip.textContent = labelFor(v);
      container.appendChild(chip);
    });
  }

  /** Appends only the options not already present, so an in-progress selection survives re-runs (e.g. after live spots are merged in). */
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

  /* ---------------------------------------------------------------- */
  /* Primary row: search, region toggle, sort — always visible.        */
  /* ---------------------------------------------------------------- */

  bindPrimary() {
    const searchInput = document.getElementById('browseSearch');
    if (searchInput) {
      let filterDebounce;
      let liveDebounce;

      const applyFilterNow = () => {
        this.state.query = searchInput.value.trim().toLowerCase();
        this.resetAndRender();
      };
      const triggerLiveFetchNow = () => this.maybeFetchLiveSpots(searchInput.value.trim());

      searchInput.addEventListener('input', () => {
        // Local filtering over curated + already-fetched spots: near-instant.
        clearTimeout(filterDebounce);
        filterDebounce = setTimeout(applyFilterNow, 180);

        // Live API call: longer debounce so we don't hit Nominatim/Overpass
        // on every keystroke — only once typing actually pauses.
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
        this.visibleCount = Math.min(this.visibleCount + this.pageSize, this.maxResults);
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

    // Type is multi-select chips, same interaction as Interests — and,
    // unlike every other facet, it also re-queries the live API: changing
    // which types are selected changes which OSM node filters Overpass is
    // asked for, not just how results already on screen are sorted.
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

    const locationSelect = document.getElementById('locationSelect');
    if (locationSelect) {
      locationSelect.addEventListener('change', () => {
        this.state.location = locationSelect.value || 'all';
        this.resetAndRender();
      });
    }

    this.bindChipGroup('serenityChips', (value) => { this.state.serenity = value; });
    this.bindChipGroup('atmosphereChips', (value) => { this.state.atmosphere = value; });

    const ratingSlider = document.getElementById('ratingSlider');
    const ratingValueEl = document.getElementById('ratingValue');
    if (ratingSlider) {
      let ratingDebounce;
      ratingSlider.addEventListener('input', () => {
        const value = parseFloat(ratingSlider.value);
        if (ratingValueEl) ratingValueEl.textContent = value <= 0 ? 'Any' : `${value.toFixed(1)}+`;
        clearTimeout(ratingDebounce);
        ratingDebounce = setTimeout(() => {
          this.state.minRating = value;
          this.resetAndRender();
        }, 120);
      });
    }

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
        this.resetAndRender();
        this.refineLiveForFilters();
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
    this.state.location = 'all';
    this.state.priceMin = null;
    this.state.priceMax = null;
    this.state.minRating = 0;
    this.state.serenity = 'any';
    this.state.atmosphere = 'any';

    document.querySelectorAll('#typeChips .chip').forEach((c) => c.classList.remove('is-active'));
    const locationSelect = document.getElementById('locationSelect');
    if (locationSelect) locationSelect.value = '';
    document.querySelectorAll('#interestChips .chip').forEach((c) => c.classList.remove('is-active'));
    ['serenityChips', 'atmosphereChips'].forEach((id) => {
      const group = document.getElementById(id);
      if (!group) return;
      group.querySelectorAll('.chip').forEach((c, i) => c.classList.toggle('is-active', i === 0));
    });
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

  /* ---------------------------------------------------------------- */
  /* Filtering (hard) + scoring (soft) + sorting                       */
  /* ---------------------------------------------------------------- */

  get activeFilterCount() {
    let n = this.state.types.size + this.state.interests.size;
    if (this.state.location !== 'all') n += 1;
    if (this.state.priceMin !== null || this.state.priceMax !== null) n += 1;
    if (this.state.minRating > 0) n += 1;
    if (this.state.serenity !== 'any') n += 1;
    if (this.state.atmosphere !== 'any') n += 1;
    return n;
  }

  /**
   * Hard filters. Region and free-text search were always exclusionary;
   * type/price/rating/serenity/atmosphere/interests/location now are too —
   * checking "Wedding" should mean you only see weddings, not just see
   * weddings nudged higher while everything else stays visible.
   * Facets are AND'ed together; multi-select facets (type/interests) are
   * OR'd internally (matching any one selected value is enough).
   */
  passesFilters(spot) {
    const s = this.state;

    if (s.region !== 'all' && spot.region !== s.region) return false;
    if (!spot.matchesQuery(s.query)) return false;

    if (s.types.size && !spot.categories.some((c) => s.types.has(c))) return false;
    if (s.location !== 'all' && spot.country !== s.location) return false;

    if (s.priceMin !== null || s.priceMax !== null) {
      if (spot.price == null) return false; // unknown price (live spots) can't be verified in-range
      const min = s.priceMin ?? 0;
      const max = s.priceMax ?? Infinity;
      if (spot.price < min || spot.price > max) return false;
    }

    if (s.minRating > 0 && (spot.rating == null || spot.rating < s.minRating)) return false;
    if (s.serenity !== 'any' && spot.serenity !== s.serenity) return false;
    if (s.atmosphere !== 'any' && spot.atmosphere !== s.atmosphere) return false;
    if (s.interests.size && !spot.tags.some((t) => s.interests.has(t))) return false;

    return true;
  }

  /**
   * "Best match" ranking among spots that already passed passesFilters.
   * Since the facets above are now hard filters, this mostly just breaks
   * ties: more interest overlap and a small live-result nudge float a spot
   * a bit higher when several remaining spots are otherwise similar.
   */
  scoreSpot(spot) {
    const s = this.state;
    let score = spot.rating ?? 0;

    if (spot.isLive) score += 0.5;
    if (s.interests.size) score += spot.tags.filter((t) => s.interests.has(t)).length * 1.5;
    if (s.types.size) score += spot.categories.filter((c) => s.types.has(c)).length * 0.5;

    return score;
  }

  get processedList() {
    const s = this.state;
    const list = this.spots.filter((spot) => this.passesFilters(spot));

    // Unknown values (live spots don't have a set price/rating) always sort
    // to the end, regardless of direction — never silently jump to the top.
    if (s.sort === 'price-asc') return list.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    if (s.sort === 'price-desc') return list.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity));
    if (s.sort === 'rating-desc') return list.sort((a, b) => (b.rating ?? -Infinity) - (a.rating ?? -Infinity));
    if (s.sort === 'name-asc') return list.sort((a, b) => a.name.localeCompare(b.name));

    // 'best' — relevance score, tie-broken by name for a stable order.
    return list
      .map((spot) => ({ spot, score: this.scoreSpot(spot) }))
      .sort((a, b) => b.score - a.score || a.spot.name.localeCompare(b.spot.name))
      .map((entry) => entry.spot);
  }

  resetAndRender() {
    this.visibleCount = this.pageSize;
    this.render();
  }

  /**
   * Merges live API results directly into the same pool the grid draws
   * from — no separate section, no separate pagination. Dedupes by
   * name+country so searching the same city twice doesn't double up.
   * Returns the number of genuinely new spots added.
   */
  addLiveSpots(newSpots) {
    const existingKeys = new Set(this.spots.map((s) => `${s.name}|${s.country}`.toLowerCase()));
    const fresh = newSpots.filter((s) => !existingKeys.has(`${s.name}|${s.country}`.toLowerCase()));
    if (!fresh.length) return 0;

    this.spots.push(...fresh);
    this.buildPanelOptions(); // pick up any new type/location/interest values, without disturbing existing selections
    // Reveal newly-added spots immediately (no extra "Load more" click needed),
    // but never past the 30-result ceiling.
    this.visibleCount = Math.min(this.visibleCount + fresh.length, this.maxResults);
    this.render();
    return fresh.length;
  }

  setLiveStatus(html) {
    const el = document.getElementById('liveStatus');
    if (el) el.innerHTML = html;
  }

  /**
   * Automatically called whenever the person searches. Treats the search
   * text as a place name, geocodes it, and merges in matching live spots
   * from OpenStreetMap — no separate "Add live spots" step required.
   * Each distinct query is only fetched once per page load, and very short
   * queries are skipped so we don't hammer Nominatim/Overpass on noise.
   */
  async maybeFetchLiveSpots(query) {
    const key = query.trim().toLowerCase();
    if (key.length < 3 || this.liveQueriesFetched.has(key)) return;
    this.liveQueriesFetched.add(key);

    this.setLiveStatus(`<div class="spinner spinner--inline"></div> Looking for live spots in "${query}"…`);

    try {
      const { spots, cityLabel, countryLabel, sample, lat, lon, region } = await this.liveClient.fetchLiveSpots(query, `live-${this.liveCounter++}`, this.state.types);

      if (lat != null && lon != null) {
        this.lastPlace = { lat, lon, cityLabel, countryLabel, region };
      }

      if (!spots.length) {
        this.setLiveStatus('');
        return;
      }

      const added = this.addLiveSpots(spots);
      if (!added) {
        this.setLiveStatus('');
        return;
      }
      const place = countryLabel ? `${cityLabel}, ${countryLabel}` : cityLabel;
      const sampleNote = sample ? ' (sample data — live network calls are blocked in this preview)' : '';
      this.setLiveStatus(`<i class="bi bi-broadcast"></i> Added ${added} live spot${added === 1 ? '' : 's'} for ${place}${sampleNote}.`);
    } catch (err) {
      // Fail quietly — curated results are already on screen either way.
      this.setLiveStatus('');
    }
  }

  /**
   * The actual "connected with the API beyond location search" piece:
   * whenever Type filters change, if a place has already been searched,
   * re-query Overpass at those same coordinates with the newly-selected
   * category set and merge in whatever's new. Debounced so rapidly
   * toggling several type chips only fires one request.
   */
  refineLiveForFilters() {
    clearTimeout(this.refineDebounce);
    this.refineDebounce = setTimeout(async () => {
      if (!this.lastPlace) return;
      const { lat, lon, cityLabel, countryLabel, region } = this.lastPlace;

      this.setLiveStatus(`<div class="spinner spinner--inline"></div> Refining live spots for "${cityLabel}"…`);
      try {
        const spots = await this.liveClient.spotsFromPOIs(lat, lon, countryLabel, region, `live-${this.liveCounter++}`, this.state.types);
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

  static SERENITY_LABELS = { high: 'Quiet & serene', medium: 'Balanced', low: 'Lively & social' };
  static ATMOSPHERE_LABELS = { historical: 'Historical', rustic: 'Rustic', modern: 'Modern', luxury: 'Luxury', cozy: 'Cozy' };

  renderActiveFilters() {
    const bar = document.getElementById('activeFiltersBar');
    if (!bar) return;
    const s = this.state;
    const pills = [];

    s.types.forEach((t) => pills.push({
      label: t.charAt(0).toUpperCase() + t.slice(1),
      remove: () => {
        s.types.delete(t);
        document.querySelector(`#typeChips .chip[data-value="${t}"]`)?.classList.remove('is-active');
        this.onTypesChanged();
      },
    }));

    s.interests.forEach((t) => pills.push({
      label: t.replace('-', ' '),
      remove: () => {
        s.interests.delete(t);
        document.querySelector(`#interestChips .chip[data-value="${t}"]`)?.classList.remove('is-active');
        this.resetAndRender();
      },
    }));

    if (s.location !== 'all') pills.push({
      label: s.location,
      remove: () => {
        s.location = 'all';
        const sel = document.getElementById('locationSelect');
        if (sel) sel.value = '';
        this.resetAndRender();
      },
    });

    if (s.minRating > 0) pills.push({
      label: `${s.minRating.toFixed(1)}+ ★`,
      remove: () => {
        s.minRating = 0;
        const slider = document.getElementById('ratingSlider');
        const label = document.getElementById('ratingValue');
        if (slider) slider.value = '0';
        if (label) label.textContent = 'Any';
        this.resetAndRender();
      },
    });

    if (s.serenity !== 'any') pills.push({
      label: SpotBrowser.SERENITY_LABELS[s.serenity] || s.serenity,
      remove: () => {
        s.serenity = 'any';
        document.querySelectorAll('#serenityChips .chip').forEach((c, i) => c.classList.toggle('is-active', i === 0));
        this.resetAndRender();
      },
    });

    if (s.atmosphere !== 'any') pills.push({
      label: SpotBrowser.ATMOSPHERE_LABELS[s.atmosphere] || s.atmosphere,
      remove: () => {
        s.atmosphere = 'any';
        document.querySelectorAll('#atmosphereChips .chip').forEach((c, i) => c.classList.toggle('is-active', i === 0));
        this.resetAndRender();
      },
    });

    if (s.priceMin !== null || s.priceMax !== null) pills.push({
      label: `$${s.priceMin ?? 0}–${s.priceMax ?? '∞'}`,
      remove: () => {
        s.priceMin = null;
        s.priceMax = null;
        const min = document.getElementById('priceMin');
        const max = document.getElementById('priceMax');
        if (min) min.value = '';
        if (max) max.value = '';
        this.resetAndRender();
      },
    });

    if (!pills.length) {
      bar.innerHTML = '';
      bar.hidden = true;
      return;
    }
    bar.hidden = false;
    bar.innerHTML = pills.map((p, i) => `<button class="active-filter-pill" type="button" data-i="${i}">${p.label} <i class="bi bi-x"></i></button>`).join('');
    bar.querySelectorAll('.active-filter-pill').forEach((btn, i) => {
      btn.addEventListener('click', () => pills[i].remove());
    });
  }

  render() {
    this.renderActiveFilters();

    // Cap the working result set to the top 30 best matches; Load More only
    // ever reveals more of *this* pool, 10 at a time.
    const results = this.processedList.slice(0, this.maxResults);
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