/**
 * SearchService
 * Owns the result pool and the search pipeline:
 *   local search (instant) → API search (background) → normalize → merge
 *   → de-dupe
 * FilterManager and SearchUI never talk to OsmApi or LocalSpots directly —
 * they only ever see the merged Spot[] pool this class maintains.
 */
class SearchService {
  constructor(localSpots) {
    this.pool = [...localSpots];
    this.osmApi = new OsmApi();
    this.fetchedQueries = new Set();
  }

  get allSpots() { return this.pool; }

  /** Instant, synchronous — searches whatever's already in the pool. */
  localResults(query) {
    return this.pool.filter((spot) => spot.matchesText(query));
  }

  /**
   * Background API search. Only fires once per distinct query per session
   * (no point re-asking OSM for "beirut" five times), and only for
   * queries long enough to plausibly be a place name. Merges fresh,
   * de-duped results straight into the pool and returns a small summary
   * for the UI to show ("12 live spots added for Beirut, Lebanon").
   */
  async apiSearch(query) {
    const key = query.trim().toLowerCase();
    if (key.length < 3 || this.fetchedQueries.has(key)) return { added: 0, cityLabel: null, countryLabel: null, sample: false };
    this.fetchedQueries.add(key);

    const { spots, cityLabel, countryLabel, sample } = await this.osmApi.searchPlaces(query.trim());
    const added = this.merge(spots);
    return { added, cityLabel, countryLabel, sample };
  }

  /** De-dupes by name+country and appends the genuinely new ones to the pool. Returns the count actually added. */
  merge(newSpots) {
    if (!newSpots.length) return 0;
    const existingKeys = new Set(this.pool.map((s) => s.dedupeKey));
    const fresh = newSpots.filter((s) => !existingKeys.has(s.dedupeKey));
    this.pool.push(...fresh);
    return fresh.length;
  }
}