/**
 * FilterManager
 * Applies filters and sorting to a Spot[] pool. Deliberately small:
 * region, quick-filter chips (category or tag, generated from data —
 * never hardcoded), a single price tier, and a minimum star rating. No
 * serenity/atmosphere/location facets — those are just tags now, and
 * "Location" duplicated what typing a country into search already does.
 */
class FilterManager {
  constructor() {
    this.state = {
      region: 'all',
      chips: new Set(),       // selected category/tag values — OR'd together
      priceTier: null,        // '$' | '$$' | '$$$' | '$$$$' | null (any)
      minRating: 0,           // 0–5, integer stars
      sort: 'best',           // 'best' | 'rating' | 'price-asc' | 'newest' | 'name-asc'
    };
  }

  get activeFilterCount() {
    let n = this.state.chips.size;
    if (this.state.priceTier) n += 1;
    if (this.state.minRating > 0) n += 1;
    return n;
  }

  reset() {
    this.state.chips.clear();
    this.state.priceTier = null;
    this.state.minRating = 0;
  }

  passesFilters(spot) {
    const s = this.state;
    if (s.region !== 'all' && spot.region !== s.region) return false;
    if (s.chips.size && ![spot.category, ...spot.tags].some((v) => s.chips.has(v))) return false;
    if (s.priceTier && spot.priceTier !== s.priceTier) return false;
    if (s.minRating > 0 && (spot.rating == null || spot.rating < s.minRating)) return false;
    return true;
  }

  /**
   * Predictable relevance score for "Best Match" — no hidden per-facet
   * weighting, just: how well does this spot's text match the query, plus
   * a small rating nudge. Every other sort mode is a plain field sort.
   */
  static rank(spot, query) {
    let score = 0;
    const q = (query || '').toLowerCase().trim();
    if (q) {
      const name = spot.name.toLowerCase();
      if (name === q) score += 100;
      else if (name.startsWith(q)) score += 60;
      else if (name.includes(q)) score += 40;

      if (spot.city && spot.city.toLowerCase().includes(q)) score += 35;
      if (spot.country.toLowerCase().includes(q)) score += 30;
      if (spot.tags.some((t) => t.toLowerCase().includes(q))) score += 20;
      if (spot.category.toLowerCase().includes(q)) score += 15;
    }
    score += (spot.rating ?? 0) * 2; // rating contributes 0–10
    return score;
  }

  apply(spots, query) {
    const filtered = spots.filter((spot) => this.passesFilters(spot));
    const s = this.state;

    if (s.sort === 'price-asc') return filtered.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    if (s.sort === 'rating') return filtered.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
    if (s.sort === 'name-asc') return filtered.sort((a, b) => a.name.localeCompare(b.name));
    if (s.sort === 'newest') return filtered.sort((a, b) => (b.source === 'osm' ? 1 : 0) - (a.source === 'osm' ? 1 : 0));

    // 'best' — ranked by text-match + rating, stable tie-break by name.
    return filtered
      .map((spot) => ({ spot, score: FilterManager.rank(spot, query) }))
      .sort((a, b) => b.score - a.score || a.spot.name.localeCompare(b.spot.name))
      .map((entry) => entry.spot);
  }

  /**
   * Quick filter chips are generated from the data, never hardcoded: the
   * most frequent category/tag values across whatever's currently in the
   * pool (local + merged-in live results).
   */
  static topChipValues(spots, limit = 9) {
    const freq = {};
    spots.forEach((spot) => {
      [spot.category, ...spot.tags].forEach((v) => { freq[v] = (freq[v] || 0) + 1; });
    });
    return Object.keys(freq).sort((a, b) => freq[b] - freq[a]).slice(0, limit);
  }
}