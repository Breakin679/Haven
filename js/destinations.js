/**
 * Destination
 * A single curated spot. Schema is intentionally rich so the Discovery
 * Engine's filters (type, price, rating, serenity, atmosphere, interests,
 * location) all have real fields to work against instead of guesses.
 */
class Destination {
  constructor({ id, name, country, code, region, categories, price, priceUnit, rating, serenity, atmosphere, tags, blurb, seed, isLive, lat, lon }) {
    this.id = id;
    this.name = name;
    this.country = country;
    this.code = code;                 // short postal-style location code, e.g. "GR · SAN"
    this.region = region;             // 'local' | 'global'
    this.categories = categories;     // e.g. ['wedding', 'honeymoon', 'couples']
    this.price = price ?? null;       // actual number, e.g. 4200 (USD)
    this.priceUnit = priceUnit;       // 'event' | 'night' | 'visit'
    this.rating = rating ?? null;     // numeric, e.g. 4.8
    this.serenity = serenity;         // 'high' | 'medium' | 'low'
    this.atmosphere = atmosphere;     // 'historical' | 'rustic' | 'modern' | 'luxury' | 'cozy'
    this.tags = tags || [];           // e.g. ['heritage', 'beachfront']
    this.blurb = blurb;
    this.imageUrl = `https://picsum.photos/seed/${seed}/640/480`;
    this.isLive = isLive || false;    // true for spots merged in from the live API
    this.lat = lat ?? null;           // only set for live spots — powers the "View on OpenStreetMap" link
    this.lon = lon ?? null;
  }

  get primaryCategory() { return this.categories[0]; }

  get badgeLabel() { return this.primaryCategory.charAt(0).toUpperCase() + this.primaryCategory.slice(1); }

  get badgeClass() {
    const map = {
      wedding: 'spot-card__badge--wedding',
      vacation: 'spot-card__badge--vacation',
      honeymoon: 'spot-card__badge--honeymoon',
      couples: 'spot-card__badge--honeymoon',
      adventure: 'spot-card__badge--vacation',
      camping: 'spot-card__badge--vacation',
      family: 'spot-card__badge--vacation',
    };
    return map[this.primaryCategory] || 'spot-card__badge--vacation';
  }

  get formattedPrice() {
    if (this.price == null) return 'Price on request';
    if (this.price === 0) return 'Free entry';
    return `$${this.price.toLocaleString()} / ${this.priceUnit}`;
  }

  get ratingText() { return this.rating != null ? `★ ${this.rating.toFixed(1)}` : 'New'; }

  get serenityLabel() { return { high: 'Quiet', medium: 'Moderate', low: 'Lively' }[this.serenity] || ''; }

  get atmosphereLabel() { return this.atmosphere.charAt(0).toUpperCase() + this.atmosphere.slice(1); }

  matchesQuery(query) {
    if (!query) return true;
    const haystack = `${this.name} ${this.country}`.toLowerCase();
    return haystack.includes(query);
  }

  /** Carousel-wrapped card (home page). */
  toCardHTML() {
    return `<div class="spot-carousel__item">${this.toGridHTML()}</div>`;
  }

  /** Bare card markup — links straight to the details page. */
  toGridHTML() {
    const extraCount = this.categories.length - 1;
    return `
      <a class="spot-card" href="details.html?id=${this.id}" data-region="${this.region}" data-id="${this.id}">
        <div class="spot-card__media" style="background-image:url('${this.imageUrl}')">
          <span class="spot-card__badge ${this.badgeClass}">${this.badgeLabel}${extraCount > 0 ? ` +${extraCount}` : ''}</span>
          ${this.isLive ? '<span class="spot-card__live"><i class="bi bi-broadcast"></i> Live</span>' : ''}
          <span class="spot-card__region">${this.region}</span>
        </div>
        <div class="spot-card__perforation"></div>
        <div class="spot-card__body">
          <h3 class="spot-card__title">${this.name}</h3>
          <div class="spot-card__loc">${this.code} · ${this.country}</div>
          <div class="spot-card__meta">
            <span><i class="bi bi-moon-stars"></i> ${this.serenityLabel}</span>
            <span><i class="bi bi-palette"></i> ${this.atmosphereLabel}</span>
          </div>
          <p class="spot-card__blurb">${this.blurb}</p>
          <div class="spot-card__foot">
            <span class="spot-card__price">${this.formattedPrice}</span>
            <span class="spot-card__rating">${this.ratingText}</span>
          </div>
        </div>
      </a>
    `;
  }
}

/**
 * LiveSpot
 * A Destination built from a live OpenStreetMap point of interest
 * (Nominatim for geocoding, Overpass for the POI itself) instead of our
 * curated dataset.
 *
 * OSM doesn't speak our filters' vocabulary, so this class's whole job is
 * translation, not the filters' job to loosen up for OSM:
 *  - categories come from the same set the curated data uses (vacation,
 *    couples, honeymoon, adventure, camping, family), so the Type filter
 *    can actually match a live spot — the OSM-specific label (Historic,
 *    Museum, ...) becomes the badge instead.
 *  - tags are a small curated-style vocabulary, not raw OSM tag keys.
 *  - rating and price are never left null — a deterministic estimate
 *    (seeded off the name, stable across re-fetches) stands in, since a
 *    null would silently fail every Price/Rating filter forever.
 */
class LiveSpot extends Destination {
  constructor({ id, name, country, region, osmCategory, seed, lat, lon }) {
    const traits = LiveSpot.inferTraits(osmCategory, name);
    super({
      id,
      name,
      country,
      code: 'LIVE',
      region,
      categories: traits.categories,
      price: traits.price,
      priceUnit: 'visit',
      rating: traits.rating,
      serenity: traits.serenity,
      atmosphere: traits.atmosphere,
      tags: traits.tags,
      blurb: `A ${traits.label.toLowerCase()} spot surfaced live from OpenStreetMap.`,
      seed,
      isLive: true,
      lat,
      lon,
    });
    this.osmCategoryLabel = traits.label;
  }

  get badgeLabel() { return this.osmCategoryLabel; }
  get badgeClass() { return 'spot-card__badge--live'; }

  static inferTraits(osmCategory, name) {
    const presets = {
      historic:   { label: 'Historic', categories: ['vacation', 'couples'],             tags: ['heritage', 'architecture'], serenity: 'high',   atmosphere: 'historical', ratingBase: 4.6, priceBase: 12 },
      museum:     { label: 'Culture',  categories: ['vacation', 'family'],              tags: ['heritage', 'culture'],      serenity: 'high',   atmosphere: 'historical', ratingBase: 4.5, priceBase: 10 },
      attraction: { label: 'Sights',   categories: ['vacation', 'adventure'],           tags: ['iconic', 'sights'],         serenity: 'medium', atmosphere: 'modern',     ratingBase: 4.4, priceBase: 0 },
      viewpoint:  { label: 'Sights',   categories: ['vacation', 'honeymoon', 'couples'],tags: ['sunset-views', 'iconic'],   serenity: 'medium', atmosphere: 'modern',     ratingBase: 4.6, priceBase: 0 },
      park:       { label: 'Park',     categories: ['vacation', 'family', 'camping'],   tags: ['hiking', 'countryside'],    serenity: 'high',   atmosphere: 'rustic',     ratingBase: 4.3, priceBase: 0 },
      beach:      { label: 'Beach',    categories: ['vacation', 'honeymoon', 'couples'],tags: ['beachfront', 'snorkeling'], serenity: 'high',   atmosphere: 'rustic',     ratingBase: 4.6, priceBase: 0 },
    };
    const preset = presets[osmCategory] || {
      label: 'Spot', categories: ['vacation'], tags: ['sights'], serenity: 'medium', atmosphere: 'modern', ratingBase: 4.3, priceBase: 5,
    };

    const frac = LiveSpot.hashFraction(name || 'spot');
    const rating = Math.min(5, Math.max(3.8, Math.round((preset.ratingBase + (frac - 0.5) * 0.6) * 10) / 10));
    const jitter = preset.priceBase > 0 ? 8 : 6;
    const price = Math.max(0, Math.round(preset.priceBase + (frac - 0.5) * jitter));

    return { label: preset.label, categories: preset.categories, tags: preset.tags, serenity: preset.serenity, atmosphere: preset.atmosphere, rating, price };
  }

  /** Tiny deterministic string hash → stable fraction in [0, 1). */
  static hashFraction(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return (h % 1000) / 1000;
  }
}

/**
 * DestinationCatalog
 * Owns the full curated list and drives the infinite spot carousel on the
 * home page. The Discovery Engine page (search.js) reuses buildData()
 * directly rather than duplicating the dataset.
 */
class DestinationCatalog {
  constructor({ viewportSelector, trackSelector, dotsSelector, prevSelector, nextSelector, toggleSelector }) {
    this.viewport = document.querySelector(viewportSelector);
    this.track = document.querySelector(trackSelector);
    this.dots = document.querySelector(dotsSelector);
    this.prevBtn = document.querySelector(prevSelector);
    this.nextBtn = document.querySelector(nextSelector);
    this.toggleGroup = document.querySelector(toggleSelector);

    this.activeFilter = 'all';
    this.spots = DestinationCatalog.buildData();
    this.carousel = null;

    if (this.track) {
      DestinationCatalog.persist(this.spots);
      this.renderCarousel();
    }
    if (this.toggleGroup) this.bindToggle();
  }

  /**
   * Session-only persistence (no backend exists) so the details page can
   * look up a spot after a full page navigation — including live spots
   * merged in from the API, which only ever exist in memory otherwise.
   * Merges rather than overwrites, so the home page and search page don't
   * stomp on each other's persisted spots within the same session.
   */
  static persist(spots) {
    try {
      const existing = DestinationCatalog.loadPersisted();
      const byId = new Map(existing.map((s) => [String(s.id), s]));
      spots.forEach((s) => byId.set(String(s.id), s));
      sessionStorage.setItem('haven:spots', JSON.stringify([...byId.values()]));
    } catch (e) { /* storage unavailable — fail silently */ }
  }

  static loadPersisted() {
    try {
      const raw = sessionStorage.getItem('haven:spots');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  /** Checks this session's seen spots first (covers live spots), then falls back to the curated dataset (always available, covers direct/bookmarked links). */
  static findById(id) {
    const fromSession = DestinationCatalog.loadPersisted().find((s) => String(s.id) === String(id));
    if (fromSession) return fromSession;
    return DestinationCatalog.buildData().find((s) => String(s.id) === String(id)) || null;
  }

  static buildData() {
    const raw = [
      // --- Local (Lebanon) ---
      { name: 'Beiteddine Palace', country: 'Lebanon', code: 'LB · BEI', region: 'local', categories: ['wedding', 'honeymoon', 'couples'], price: 8500, priceUnit: 'event', rating: 4.9, serenity: 'high', atmosphere: 'historical', tags: ['heritage', 'architecture'], seed: 'beiteddine', blurb: 'A 19th-century Emiri palace with stone courtyards and cypress-lined terraces built for a grand entrance.' },
      { name: 'Batroun Seafront', country: 'Lebanon', code: 'LB · BAT', region: 'local', categories: ['wedding', 'vacation', 'couples'], price: 4200, priceUnit: 'event', rating: 4.7, serenity: 'medium', atmosphere: 'modern', tags: ['beachfront', 'nightlife'], seed: 'batroun', blurb: 'Sunset ceremonies on a private stretch of Mediterranean coastline, steps from the old souk.' },
      { name: 'Faraya Mountain Lodge', country: 'Lebanon', code: 'LB · FAR', region: 'local', categories: ['vacation', 'adventure', 'camping'], price: 90, priceUnit: 'night', rating: 4.6, serenity: 'high', atmosphere: 'rustic', tags: ['hiking', 'mountain'], seed: 'faraya', blurb: 'Ski-season chalets and summer hiking base camps in the heart of the Kesrouan range.' },
      { name: 'Byblos Old Port', country: 'Lebanon', code: 'LB · BYB', region: 'local', categories: ['wedding', 'vacation', 'couples'], price: 5200, priceUnit: 'event', rating: 4.8, serenity: 'medium', atmosphere: 'historical', tags: ['heritage', 'marina'], seed: 'byblos', blurb: 'One of the oldest continuously inhabited cities on earth, with a working marina as your backdrop.' },
      { name: 'Deir el Qamar Square', country: 'Lebanon', code: 'LB · DEQ', region: 'local', categories: ['wedding', 'couples'], price: 3800, priceUnit: 'event', rating: 4.7, serenity: 'medium', atmosphere: 'historical', tags: ['heritage', 'village'], seed: 'deirelqamar', blurb: 'A preserved 17th-century village square framed by red-tiled roofs and old sycamore trees.' },
      { name: 'Jeita Valley Retreat', country: 'Lebanon', code: 'LB · JEI', region: 'local', categories: ['vacation', 'camping', 'family'], price: 60, priceUnit: 'night', rating: 4.5, serenity: 'high', atmosphere: 'rustic', tags: ['camping', 'riverside'], seed: 'jeita', blurb: 'Riverside cabins minutes from the Jeita Grotto, built for slow mornings and long lunches.' },
      { name: 'Broumana Garden Terrace', country: 'Lebanon', code: 'LB · BRO', region: 'local', categories: ['wedding', 'couples'], price: 4600, priceUnit: 'event', rating: 4.6, serenity: 'medium', atmosphere: 'cozy', tags: ['garden', 'hillside'], seed: 'broumana', blurb: 'Hillside gardens overlooking the Beirut coastline, popular for spring and autumn ceremonies.' },
      { name: 'Anjar Ruins Backdrop', country: 'Lebanon', code: 'LB · ANJ', region: 'local', categories: ['vacation', 'adventure'], price: 45, priceUnit: 'night', rating: 4.4, serenity: 'medium', atmosphere: 'historical', tags: ['heritage', 'day-trip'], seed: 'anjar', blurb: 'Umayyad-era colonnades in the Bekaa Valley, ideal for history-driven day trips.' },
      { name: 'Tannourine Cedar Lodges', country: 'Lebanon', code: 'LB · TAN', region: 'local', categories: ['vacation', 'camping', 'adventure'], price: 75, priceUnit: 'night', rating: 4.6, serenity: 'high', atmosphere: 'rustic', tags: ['hiking', 'forest'], seed: 'tannourine', blurb: 'Cabins tucked inside one of Lebanon\u2019s last old-growth cedar reserves.' },
      { name: 'Chtaura Vineyard Estate', country: 'Lebanon', code: 'LB · CHT', region: 'local', categories: ['wedding', 'vacation', 'couples'], price: 3900, priceUnit: 'event', rating: 4.7, serenity: 'medium', atmosphere: 'rustic', tags: ['vineyard', 'countryside'], seed: 'chtaura', blurb: 'Bekaa Valley vines and a stone press house repurposed for weddings and wine weekends.' },

      // --- Global ---
      { name: 'Santorini Caldera Villas', country: 'Greece', code: 'GR · SAN', region: 'global', categories: ['wedding', 'honeymoon', 'couples'], price: 15000, priceUnit: 'event', rating: 4.9, serenity: 'medium', atmosphere: 'luxury', tags: ['iconic', 'sunset-views'], seed: 'santorini', blurb: 'Whitewashed cliffside villas overlooking the volcanic caldera, famous for their sunsets.' },
      { name: 'Ubud Rice Terrace Retreat', country: 'Bali, Indonesia', code: 'ID · UBD', region: 'global', categories: ['vacation', 'honeymoon', 'adventure'], price: 180, priceUnit: 'night', rating: 4.8, serenity: 'high', atmosphere: 'rustic', tags: ['wellness', 'jungle'], seed: 'ubud', blurb: 'Open-air villas set into the terraces, with rice-paddy views from every room.' },
      { name: 'Tuscan Vineyard Estate', country: 'Italy', code: 'IT · TUS', region: 'global', categories: ['wedding', 'couples'], price: 12000, priceUnit: 'event', rating: 4.8, serenity: 'high', atmosphere: 'rustic', tags: ['vineyard', 'countryside'], seed: 'tuscany', blurb: 'A working vineyard estate near Siena with a centuries-old stone barn for receptions.' },
      { name: 'Maldives Overwater Villas', country: 'Maldives', code: 'MV · MLE', region: 'global', categories: ['honeymoon', 'vacation', 'couples'], price: 650, priceUnit: 'night', rating: 4.9, serenity: 'high', atmosphere: 'luxury', tags: ['beachfront', 'snorkeling'], seed: 'maldives', blurb: 'Private overwater bungalows with direct lagoon access, built for barefoot ceremonies.' },
      { name: 'Lake Como Lakeside Villa', country: 'Italy', code: 'IT · COM', region: 'global', categories: ['wedding', 'honeymoon', 'couples'], price: 18000, priceUnit: 'event', rating: 4.9, serenity: 'high', atmosphere: 'luxury', tags: ['iconic', 'lakeside'], seed: 'lakecomo', blurb: 'A grand lakeside villa with formal gardens, favored for destination weddings since the 1800s.' },
      { name: 'Le Marais Courtyard', country: 'Paris, France', code: 'FR · PAR', region: 'global', categories: ['wedding', 'couples'], price: 9500, priceUnit: 'event', rating: 4.6, serenity: 'low', atmosphere: 'historical', tags: ['architecture', 'city'], seed: 'paris', blurb: 'An 18th-century hôtel particulier courtyard tucked away in central Paris.' },
      { name: 'Kyoto Temple Gardens', country: 'Japan', code: 'JP · KYO', region: 'global', categories: ['vacation', 'honeymoon'], price: 140, priceUnit: 'night', rating: 4.7, serenity: 'high', atmosphere: 'historical', tags: ['heritage', 'gardens'], seed: 'kyoto', blurb: 'Moss gardens and machiya guesthouses within walking distance of the Philosopher\u2019s Path.' },
      { name: 'Marrakech Riad Courtyard', country: 'Morocco', code: 'MA · MRK', region: 'global', categories: ['wedding', 'vacation', 'couples'], price: 6200, priceUnit: 'event', rating: 4.7, serenity: 'medium', atmosphere: 'cozy', tags: ['riad', 'medina'], seed: 'marrakech', blurb: 'A restored riad with a central fountain courtyard, hidden behind the medina walls.' },
    ];

    return raw.map((r, i) => new Destination({ id: i + 1, ...r }));
  }

  bindToggle() {
    this.toggleGroup.querySelectorAll('.toggle-group__btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.toggleGroup.querySelectorAll('.toggle-group__btn').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        this.activeFilter = btn.dataset.filter;
        this.renderCarousel();
      });
    });
  }

  get filteredSpots() {
    if (this.activeFilter === 'all') return this.spots;
    return this.spots.filter((s) => s.region === this.activeFilter);
  }

  renderCarousel() {
    if (this.carousel) this.carousel.stopAutoplay();

    const spots = this.filteredSpots;
    this.track.innerHTML = spots.length
      ? spots.map((s) => s.toCardHTML()).join('')
      : `<div class="spot-carousel__item"><p>No spots match this view yet — check back soon.</p></div>`;

    this.carousel = new Carousel({
      viewport: this.viewport,
      track: this.track,
      dotsContainer: this.dots,
      prevBtn: this.prevBtn,
      nextBtn: this.nextBtn,
      autoplayMs: 4500,
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (!document.querySelector('#spotTrack')) return;
  new DestinationCatalog({
    viewportSelector: '#spotViewport',
    trackSelector: '#spotTrack',
    dotsSelector: '#spotDots',
    prevSelector: '#spotPrev',
    nextSelector: '#spotNext',
    toggleSelector: '#regionToggle',
  });
});