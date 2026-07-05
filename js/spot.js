/**
 * Spot
 * The one and only result shape in the app. Local curated data and live
 * OpenStreetMap data both get normalized into this before anything else
 * (filtering, ranking, rendering) ever touches them — there is no
 * separate "LiveSpot" subtype anymore, and no code path that treats the
 * two sources differently once they're built.
 *
 * Schema (deliberately small):
 *   id, name, city, country, region ('local' | 'global')
 *   category   — one primary descriptor, e.g. "wedding", "beach", "historic"
 *   tags       — everything else descriptive (vibe, interests, audience —
 *                what used to be split across type/serenity/atmosphere/
 *                interests all lives here now)
 *   rating     — 0–5 or null
 *   price      — a number (USD) or null; priceTier below buckets it
 *   priceUnit  — 'event' | 'night' | 'visit' (only used for display text)
 *   image, description, code
 *   source     — 'local' | 'osm'
 */
class Spot {
  constructor({ id, name, city, country, region, category, tags, rating, price, priceUnit, image, description, code, source }) {
    this.id = id;
    this.name = name;
    this.city = city || '';
    this.country = country;
    this.region = region;
    this.category = category;
    this.tags = tags || [];
    this.rating = rating ?? null;
    this.price = price ?? null;
    this.priceUnit = priceUnit || 'event';
    this.image = image;
    this.description = description || '';
    this.code = code || '';
    this.source = source; // 'local' | 'osm'
  }

  /** Stable key for de-duping the same real-world place across sources. */
  get dedupeKey() { return `${this.name}|${this.country}`.toLowerCase(); }

  /** $ / $$ / $$$ / $$$$ — bucketed relative to how the price is billed, since a $150/night stay and a $150/visit ticket aren't on the same scale. */
  get priceTier() {
    if (this.price == null) return null;
    if (this.priceUnit === 'event') {
      if (this.price <= 4000) return '$';
      if (this.price <= 8000) return '$$';
      if (this.price <= 13000) return '$$$';
      return '$$$$';
    }
    // 'night' or 'visit'
    if (this.price <= 60) return '$';
    if (this.price <= 150) return '$$';
    if (this.price <= 400) return '$$$';
    return '$$$$';
  }

  get formattedPrice() {
    if (this.price == null) return 'Price on request';
    if (this.price === 0) return 'Free entry';
    return `$${this.price.toLocaleString()} / ${this.priceUnit}`;
  }

  get ratingStars() {
    if (this.rating == null) return '☆☆☆☆☆';
    const full = Math.round(this.rating);
    return '★'.repeat(full) + '☆'.repeat(5 - full);
  }

  get badgeClass() {
    const map = {
      wedding: 'spot-card__badge--wedding',
      honeymoon: 'spot-card__badge--honeymoon',
      vacation: 'spot-card__badge--vacation',
    };
    return map[this.category] || 'spot-card__badge--vacation';
  }

  get badgeLabel() { return this.category.charAt(0).toUpperCase() + this.category.slice(1); }

  /** Every field text search should look through — plan explicitly calls out name/city/country/description/tags. */
  matchesText(query) {
    if (!query) return true;
    const q = query.toLowerCase().trim();
    return (
      this.name.toLowerCase().includes(q) ||
      this.city.toLowerCase().includes(q) ||
      this.country.toLowerCase().includes(q) ||
      this.description.toLowerCase().includes(q) ||
      this.category.toLowerCase().includes(q) ||
      this.tags.some((t) => t.toLowerCase().includes(q))
    );
  }

  /** Carousel-wrapped card (home page). */
  toCardHTML() {
    return `<div class="spot-carousel__item">${this.toGridHTML()}</div>`;
  }

  /** Search-results / grid card. */
  toGridHTML() {
    const locationLine = this.city ? `${this.city}, ${this.country}` : this.country;
    const shownTags = this.tags.slice(0, 2);
    return `
      <a class="spot-card" href="details.html?id=${this.id}" data-region="${this.region}" data-id="${this.id}">
        <div class="spot-card__media" style="background-image:url('${this.image}')">
          <span class="spot-card__badge ${this.badgeClass}">${this.badgeLabel}</span>
          ${this.source === 'osm' ? '<span class="spot-card__live"><i class="bi bi-broadcast"></i> Live</span>' : ''}
          <span class="spot-card__region">${this.region}</span>
        </div>
        <div class="spot-card__perforation"></div>
        <div class="spot-card__body">
          <h3 class="spot-card__title">${this.name}</h3>
          <div class="spot-card__loc"><i class="bi bi-geo-alt"></i> ${locationLine}</div>
          ${shownTags.length ? `<div class="spot-card__tags">${shownTags.map((t) => `<span class="spot-card__tag">${t.replace('-', ' ')}</span>`).join('')}</div>` : ''}
          <p class="spot-card__blurb">${this.description}</p>
          <div class="spot-card__foot">
            <span class="spot-card__price">${this.formattedPrice}${this.priceTier ? ` <span class="spot-card__tier">${this.priceTier}</span>` : ''}</span>
            <span class="spot-card__rating" title="${this.rating != null ? this.rating.toFixed(1) : 'Not yet rated'}">${this.ratingStars}</span>
          </div>
        </div>
      </a>
    `;
  }
}