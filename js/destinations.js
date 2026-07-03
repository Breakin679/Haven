/**
 * Destination
 * A single curated spot (venue/destination) shown in the home page carousel.
 */
class Destination {
  constructor({ id, name, country, code, region, categories, priceTier, rating, blurb, seed }) {
    this.id = id;
    this.name = name;
    this.country = country;
    this.code = code;               // short postal-style location code, e.g. "GR · SANT"
    this.region = region;           // 'local' | 'global'
    this.categories = categories;   // ['wedding', 'vacation']
    this.priceTier = priceTier;     // '$' | '$$' | '$$$'
    this.rating = rating;           // number out of 5
    this.blurb = blurb;
    this.imageUrl = `https://picsum.photos/seed/${seed}/640/480`;
  }

  get badgeLabel() {
    if (this.categories.length > 1) return 'Wedding & Vacation';
    return this.categories[0] === 'wedding' ? 'Wedding' : 'Vacation';
  }

  get badgeClass() {
    if (this.categories.length > 1) return 'spot-card__badge--both';
    return this.categories[0] === 'wedding' ? 'spot-card__badge--wedding' : 'spot-card__badge--vacation';
  }

  toCardHTML() {
    return `
      <div class="spot-carousel__item">
        <article class="spot-card" data-region="${this.region}" data-id="${this.id}">
          <div class="spot-card__media" style="background-image:url('${this.imageUrl}')">
            <span class="spot-card__badge ${this.badgeClass}">${this.badgeLabel}</span>
            <span class="spot-card__region">${this.region}</span>
          </div>
          <div class="spot-card__perforation"></div>
          <div class="spot-card__body">
            <h3 class="spot-card__title">${this.name}</h3>
            <div class="spot-card__loc">${this.code} · ${this.country}</div>
            <p class="spot-card__blurb">${this.blurb}</p>
            <div class="spot-card__foot">
              <span class="spot-card__price">${this.priceTier} avg / event</span>
              <span class="spot-card__rating">★ ${this.rating.toFixed(1)}</span>
            </div>
          </div>
        </article>
      </div>
    `;
  }
}

/**
 * DestinationCatalog
 * Owns the full curated list and drives the infinite spot carousel,
 * rebuilding it whenever the Local / Global toggle changes.
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

    if (this.track) this.renderCarousel();
    if (this.toggleGroup) this.bindToggle();
  }

  static buildData() {
    const raw = [
      // --- Local (Lebanon) ---
      { name: 'Beiteddine Palace', country: 'Lebanon', code: 'LB · BEI', region: 'local', categories: ['wedding'], priceTier: '$$$', rating: 4.9, seed: 'beiteddine', blurb: 'A 19th-century Emiri palace with stone courtyards and cypress-lined terraces built for a grand entrance.' },
      { name: 'Batroun Seafront', country: 'Lebanon', code: 'LB · BAT', region: 'local', categories: ['wedding', 'vacation'], priceTier: '$$', rating: 4.7, seed: 'batroun', blurb: 'Sunset ceremonies on a private stretch of Mediterranean coastline, steps from the old souk.' },
      { name: 'Faraya Mountain Lodge', country: 'Lebanon', code: 'LB · FAR', region: 'local', categories: ['vacation'], priceTier: '$$', rating: 4.6, seed: 'faraya', blurb: 'Ski-season chalets and summer hiking base camps in the heart of the Kesrouan range.' },
      { name: 'Byblos Old Port', country: 'Lebanon', code: 'LB · BYB', region: 'local', categories: ['wedding', 'vacation'], priceTier: '$$', rating: 4.8, seed: 'byblos', blurb: 'One of the oldest continuously inhabited cities on earth, with a working marina as your backdrop.' },
      { name: 'Deir el Qamar Square', country: 'Lebanon', code: 'LB · DEQ', region: 'local', categories: ['wedding'], priceTier: '$$', rating: 4.7, seed: 'deirelqamar', blurb: 'A preserved 17th-century village square framed by red-tiled roofs and old sycamore trees.' },
      { name: 'Jeita Valley Retreat', country: 'Lebanon', code: 'LB · JEI', region: 'local', categories: ['vacation'], priceTier: '$', rating: 4.5, seed: 'jeita', blurb: 'Riverside cabins minutes from the Jeita Grotto, built for slow mornings and long lunches.' },
      { name: 'Broumana Garden Terrace', country: 'Lebanon', code: 'LB · BRO', region: 'local', categories: ['wedding'], priceTier: '$$', rating: 4.6, seed: 'broumana', blurb: 'Hillside gardens overlooking the Beirut coastline, popular for spring and autumn ceremonies.' },
      { name: 'Anjar Ruins Backdrop', country: 'Lebanon', code: 'LB · ANJ', region: 'local', categories: ['vacation'], priceTier: '$', rating: 4.4, seed: 'anjar', blurb: 'Umayyad-era colonnades in the Bekaa Valley, ideal for history-driven day trips.' },
      { name: 'Tannourine Cedar Lodges', country: 'Lebanon', code: 'LB · TAN', region: 'local', categories: ['vacation'], priceTier: '$$', rating: 4.6, seed: 'tannourine', blurb: 'Cabins tucked inside one of Lebanon\u2019s last old-growth cedar reserves.' },
      { name: 'Chtaura Vineyard Estate', country: 'Lebanon', code: 'LB · CHT', region: 'local', categories: ['wedding', 'vacation'], priceTier: '$$', rating: 4.7, seed: 'chtaura', blurb: 'Bekaa Valley vines and a stone press house repurposed for weddings and wine weekends.' },

      // --- Global ---
      { name: 'Santorini Caldera Villas', country: 'Greece', code: 'GR · SAN', region: 'global', categories: ['wedding', 'vacation'], priceTier: '$$$', rating: 4.9, seed: 'santorini', blurb: 'Whitewashed cliffside villas overlooking the volcanic caldera, famous for their sunsets.' },
      { name: 'Ubud Rice Terrace Retreat', country: 'Bali, Indonesia', code: 'ID · UBD', region: 'global', categories: ['vacation'], priceTier: '$$', rating: 4.8, seed: 'ubud', blurb: 'Open-air villas set into the terraces, with rice-paddy views from every room.' },
      { name: 'Tuscan Vineyard Estate', country: 'Italy', code: 'IT · TUS', region: 'global', categories: ['wedding'], priceTier: '$$$', rating: 4.8, seed: 'tuscany', blurb: 'A working vineyard estate near Siena with a centuries-old stone barn for receptions.' },
      { name: 'Maldives Overwater Villas', country: 'Maldives', code: 'MV · MLE', region: 'global', categories: ['wedding', 'vacation'], priceTier: '$$$', rating: 4.9, seed: 'maldives', blurb: 'Private overwater bungalows with direct lagoon access, built for barefoot ceremonies.' },
      { name: 'Lake Como Lakeside Villa', country: 'Italy', code: 'IT · COM', region: 'global', categories: ['wedding'], priceTier: '$$$', rating: 4.9, seed: 'lakecomo', blurb: 'A grand lakeside villa with formal gardens, favored for destination weddings since the 1800s.' },
      { name: 'Le Marais Courtyard', country: 'Paris, France', code: 'FR · PAR', region: 'global', categories: ['wedding'], priceTier: '$$$', rating: 4.6, seed: 'paris', blurb: 'An 18th-century hôtel particulier courtyard tucked away in central Paris.' },
      { name: 'Kyoto Temple Gardens', country: 'Japan', code: 'JP · KYO', region: 'global', categories: ['vacation'], priceTier: '$$', rating: 4.7, seed: 'kyoto', blurb: 'Moss gardens and machiya guesthouses within walking distance of the Philosopher\u2019s Path.' },
      { name: 'Marrakech Riad Courtyard', country: 'Morocco', code: 'MA · MRK', region: 'global', categories: ['wedding', 'vacation'], priceTier: '$$', rating: 4.7, seed: 'marrakech', blurb: 'A restored riad with a central fountain courtyard, hidden behind the medina walls.' },
      { name: 'Amalfi Coast Terrace', country: 'Italy', code: 'IT · AML', region: 'global', categories: ['wedding'], priceTier: '$$$', rating: 4.8, seed: 'amalfi', blurb: 'Lemon-grove terraces cut into the cliffs above Positano, built for cocktail-hour views.' },
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
  new DestinationCatalog({
    viewportSelector: '#spotViewport',
    trackSelector: '#spotTrack',
    dotsSelector: '#spotDots',
    prevSelector: '#spotPrev',
    nextSelector: '#spotNext',
    toggleSelector: '#regionToggle',
  });
});