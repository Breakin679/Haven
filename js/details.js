/**
 * DetailsPage
 * Renders the full profile for a single spot.
 *
 * Data source note: there's no backend/database in this project, so a
 * spot's full data has to travel with the browsing session. DestinationCatalog
 * persists every spot it renders (curated or live) into sessionStorage;
 * this page reads that first, falling back to the curated dataset directly
 * so a bookmarked or freshly-typed link to a curated spot always works,
 * even in a brand-new tab. A live spot opened in a new tab (no session
 * data) can't be recovered — that's an honest limitation of not having a
 * database, and the page says so rather than pretending otherwise.
 */
class DetailsPage {
  constructor(containerSelector = '#detailsContent') {
    this.container = document.querySelector(containerSelector);
    if (!this.container) return;

    const id = new URLSearchParams(window.location.search).get('id');
    const spot = id ? DestinationCatalog.findById(id) : null;

    if (!spot) {
      this.renderNotFound();
      return;
    }

    this.spot = spot;
    document.title = `${spot.name} — Haven`;
    this.render();
  }

  /* ---------------------------------------------------------------- */
  /* Small formatting helpers — written to work on either a live class */
  /* instance or a plain object rehydrated from sessionStorage.        */
  /* ---------------------------------------------------------------- */

  static cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  static priceText(spot) { return spot.price != null ? `$${spot.price.toLocaleString()} / ${spot.priceUnit}` : 'Price on request'; }

  static ratingText(spot) { return spot.rating != null ? `★ ${spot.rating.toFixed(1)}` : 'New — not yet rated'; }

  static serenityText(spot) { return { high: 'Quiet', medium: 'Moderate', low: 'Lively' }[spot.serenity] || 'Unknown'; }

  static badgeClass(category) {
    const map = {
      wedding: 'spot-card__badge--wedding',
      vacation: 'spot-card__badge--vacation',
      honeymoon: 'spot-card__badge--honeymoon',
      couples: 'spot-card__badge--honeymoon',
      adventure: 'spot-card__badge--vacation',
      camping: 'spot-card__badge--vacation',
      family: 'spot-card__badge--vacation',
    };
    return map[category] || 'spot-card__badge--live';
  }

  static amenities(spot) {
    const atmosphereMap = {
      historical: 'Historic architecture',
      rustic: 'Natural, rustic surroundings',
      modern: 'Modern facilities',
      luxury: 'Luxury-grade amenities',
      cozy: 'Intimate, cozy setting',
    };
    const serenityMap = {
      high: 'Quiet, peaceful atmosphere',
      medium: 'Comfortably paced surroundings',
      low: 'Lively, high-energy setting',
    };
    const categoryMap = {
      wedding: 'Event coordination available',
      honeymoon: 'Romantic setting',
      couples: 'Built for two',
      vacation: 'Suited to extended stays',
      adventure: 'Outdoor activities nearby',
      camping: 'Camping-friendly grounds',
      family: 'Family-friendly',
    };

    const list = [
      atmosphereMap[spot.atmosphere],
      serenityMap[spot.serenity],
      ...spot.categories.map((c) => categoryMap[c]).filter(Boolean),
      ...spot.tags.map((t) => DetailsPage.cap(t.replace(/-/g, ' '))),
    ].filter(Boolean);

    return [...new Set(list)];
  }

  static gallery(spot) {
    const slug = spot.name.toLowerCase().replace(/\s+/g, '-');
    return [spot.imageUrl, `https://picsum.photos/seed/${slug}-2/900/600`, `https://picsum.photos/seed/${slug}-3/900/600`];
  }

  /* ---------------------------------------------------------------- */
  /* Rendering                                                          */
  /* ---------------------------------------------------------------- */

  renderNotFound() {
    const liveHint = window.location.search.includes('live-')
      ? 'Live spots only stick around for the session you searched them in — try searching again from Discover.'
      : 'It may have been a bad or outdated link.';

    this.container.innerHTML = `
      <div class="section" style="padding-top:3rem;">
        <div class="state-message" style="padding:4rem 1.5rem;">
          <i class="bi bi-compass"></i>
          <p style="margin:0 0 1.25rem;">We couldn't find that spot in this session. ${liveHint}</p>
          <a class="btn btn--primary" href="search.html"><i class="bi bi-search"></i> Back to Discover</a>
        </div>
      </div>
    `;
  }

  render() {
    const s = this.spot;
    const [hero, thumb1, thumb2] = DetailsPage.gallery(s);
    const amenities = DetailsPage.amenities(s);

    this.container.innerHTML = `
      <div class="details">
        <a class="details__back" href="search.html"><i class="bi bi-arrow-left"></i> Back to Discover</a>

        <div class="details__gallery">
          <div class="details__hero" style="background-image:url('${hero}')">
            ${s.isLive ? '<span class="spot-card__live"><i class="bi bi-broadcast"></i> Live</span>' : ''}
            <span class="spot-card__region" style="position:absolute;bottom:1rem;right:1rem;">${s.region}</span>
          </div>
          <div class="details__thumbs">
            <div class="details__thumb" style="background-image:url('${thumb1}')"></div>
            <div class="details__thumb" style="background-image:url('${thumb2}')"></div>
          </div>
        </div>

        <div class="details__layout">
          <div class="details__main">
            <div class="details__badges">
              ${s.categories.map((c) => `<span class="spot-card__badge ${DetailsPage.badgeClass(c)}" style="position:static;">${DetailsPage.cap(c)}</span>`).join('')}
            </div>

            <h1 class="details__title">${s.name}</h1>
            <div class="details__loc"><i class="bi bi-geo-alt"></i> ${s.code ? `${s.code} · ` : ''}${s.country}</div>

            <div class="details__meta-row">
              <span><i class="bi bi-star-fill"></i> ${DetailsPage.ratingText(s)}</span>
              <span><i class="bi bi-moon-stars"></i> ${DetailsPage.serenityText(s)}</span>
              <span><i class="bi bi-palette"></i> ${DetailsPage.cap(s.atmosphere)}</span>
            </div>

            <p class="details__blurb">${s.blurb}</p>

            <h3 class="details__subhead">Amenities &amp; highlights</h3>
            <div class="chip-set">
              ${amenities.map((a) => `<span class="chip" style="cursor:default;">${a}</span>`).join('')}
            </div>

            ${s.lat && s.lon ? `
              <h3 class="details__subhead">Location</h3>
              <a class="btn btn--ghost btn--sm" href="https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lon}#map=16/${s.lat}/${s.lon}" target="_blank" rel="noopener">
                <i class="bi bi-map"></i> View on OpenStreetMap
              </a>
            ` : ''}
          </div>

          <aside class="details__sidebar">
            <div class="details__price-card">
              <span class="details__price-label">Starting from</span>
              <div class="details__price">${DetailsPage.priceText(s)}</div>
              <a class="btn btn--primary" style="width:100%;justify-content:center;margin-top:1rem;" href="community.html#contact">
                <i class="bi bi-send"></i> Request This Spot
              </a>
              <a class="btn btn--ghost" style="width:100%;justify-content:center;margin-top:0.6rem;" href="community.html#submit-venue">
                <i class="bi bi-flag"></i> Report an Issue
              </a>
              <p class="details__price-note">Haven doesn't process bookings directly yet — this connects you with our team instead.</p>
            </div>
          </aside>
        </div>

        <div class="section" id="relatedSection" style="padding-left:0;padding-right:0;">
          <div class="section__head">
            <div><span class="eyebrow">Keep Exploring</span><h2>You might also like</h2></div>
          </div>
          <div class="spot-grid" id="relatedGrid"></div>
        </div>
      </div>
    `;

    this.renderRelated();
  }

  renderRelated() {
    const grid = document.getElementById('relatedGrid');
    if (!grid) return;

    const pool = DestinationCatalog.buildData().filter((d) => d.id !== this.spot.id);
    const sameCategory = pool.filter((d) => d.categories.some((c) => this.spot.categories?.includes(c)));
    const chosen = (sameCategory.length >= 3 ? sameCategory : pool).slice(0, 3);

    grid.innerHTML = chosen.map((d) => d.toGridHTML()).join('');
  }
}

document.addEventListener('DOMContentLoaded', () => new DetailsPage());