/**
 * Entry point. Wires SearchService (data) + FilterManager (filter/sort)
 * + SearchUI (DOM) together. No filtering logic and no DOM lookups live
 * here — this file only coordinates the three.
 *
 *   type → debounce → local results render instantly → API results
 *   merge in → re-render, exactly like the redesign calls for.
 */
document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('resultsGrid');
  if (!grid) return; // not on this page

  const searchService = new SearchService(LocalSpots.build());
  const filters = new FilterManager();
  const ui = new SearchUI();

  const PAGE_SIZE = 12;
  let query = '';
  let visibleCount = PAGE_SIZE;

  function currentResults() {
    const textMatched = searchService.localResults(query);
    return filters.apply(textMatched, query);
  }

  function refreshChips() {
    ui.renderQuickChips(FilterManager.topChipValues(searchService.allSpots), filters.state.chips);
  }

  function render({ resetPage = true } = {}) {
    if (resetPage) visibleCount = PAGE_SIZE;
    const results = currentResults();
    ui.setCount(results.length);
    ui.renderResults(results.slice(0, visibleCount));
    ui.setSentinelVisible(visibleCount < results.length);
    ui.setBadge(filters.activeFilterCount);
    refreshChips();
  }

  function loadMore() {
    const results = currentResults();
    if (visibleCount >= results.length) return;
    const next = results.slice(visibleCount, visibleCount + PAGE_SIZE);
    visibleCount += PAGE_SIZE;
    ui.renderResults(next, { append: true });
    ui.setSentinelVisible(visibleCount < results.length);
  }

  async function runSearch(text) {
    query = text;
    render(); // local results, instant

    if (query.length < 3) return;
    ui.setLiveStatus(`<div class="spinner spinner--inline"></div> Searching live spots for "${query}"…`);
    try {
      const { added, cityLabel, countryLabel, sample } = await searchService.apiSearch(query);
      if (!added) { ui.setLiveStatus(''); return; }
      const place = countryLabel ? `${cityLabel}, ${countryLabel}` : cityLabel;
      const sampleNote = sample ? ' (sample data — live network calls are blocked in this preview)' : '';
      ui.setLiveStatus(`<i class="bi bi-broadcast"></i> Added ${added} live spot${added === 1 ? '' : 's'} for ${place}${sampleNote}.`);
      render();
    } catch (err) {
      ui.setLiveStatus('');
    }
  }

  ui.bind({
    onSearch: runSearch,
    onChipToggle: (value, active) => {
      active ? filters.state.chips.add(value) : filters.state.chips.delete(value);
      render();
    },
    onPriceTier: (tier) => { filters.state.priceTier = tier; render(); },
    onRating: (value) => { filters.state.minRating = value; render(); },
    onSort: (value) => { filters.state.sort = value; render(); },
    onRegion: (value) => { filters.state.region = value; render(); },
    onClear: () => {
      filters.reset();
      ui.setPriceTier(null);
      ui.setRatingStars(0);
      document.querySelectorAll('#quickChips .chip').forEach((c) => c.classList.remove('is-active'));
      render();
    },
    onApply: () => render(),
    onLoadMore: loadMore,
  });

  render();
});