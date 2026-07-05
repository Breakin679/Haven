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
/**
 * SpotActionModal
 * A single reusable popup for "Request This Spot" and "Report an Issue".
 * There's no backend yet, so submitting doesn't actually send or save
 * anything — but unlike a bare link off to a generic contact page, this
 * gives the visitor a real confirmation tied to the spot they were just
 * looking at, with a fallback link to the Contact page for anyone who'd
 * rather not use the popup at all.
 */
class SpotActionModal {
  static instance = null;

  static open(mode, spot) {
    if (!SpotActionModal.instance) SpotActionModal.instance = new SpotActionModal();
    SpotActionModal.instance.show(mode, spot);
  }

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'spot-modal-overlay';
    this.overlay.innerHTML = `
      <div class="spot-modal" role="dialog" aria-modal="true" aria-labelledby="spotModalTitle">
        <button type="button" class="spot-modal__close" aria-label="Close">
          <i class="bi bi-x-lg"></i>
        </button>
        <div class="spot-modal__body" id="spotModalBody"></div>
      </div>
    `;
    document.body.appendChild(this.overlay);
    this.body = this.overlay.querySelector('#spotModalBody');

    this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });
    this.overlay.querySelector('.spot-modal__close').addEventListener('click', () => this.close());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.overlay.classList.contains('is-open')) this.close();
    });
  }

  close() {
    this.overlay.classList.remove('is-open');
    document.body.classList.remove('spot-modal-open');
  }

  show(mode, spot) {
    this.mode = mode;
    this.spot = spot;
    this.body.innerHTML = mode === 'request' ? this.requestFormHTML(spot) : this.reportFormHTML(spot);
    this.overlay.classList.add('is-open');
    document.body.classList.add('spot-modal-open');

    this.body.querySelector('form').addEventListener('submit', (e) => this.handleSubmit(e));
    const firstField = this.body.querySelector('input, select, textarea');
    if (firstField) setTimeout(() => firstField.focus(), 60);
  }

  requestFormHTML(spot) {
    return `
      <span class="eyebrow">Get In Touch</span>
      <h3 id="spotModalTitle">Request ${spot.name}</h3>
      <p class="spot-modal__lede">Tell us a bit about your plans and our team will follow up about availability and pricing.</p>
      <form novalidate>
        <div class="field-row">
          <div class="field">
            <label for="reqName">Your name</label>
            <input type="text" id="reqName" required>
            <div class="invalid-feedback">Let us know who's asking.</div>
          </div>
          <div class="field">
            <label for="reqEmail">Email</label>
            <input type="email" id="reqEmail" required>
            <div class="invalid-feedback">A valid email helps us follow up.</div>
          </div>
        </div>
        <div class="field">
          <label for="reqDate">Preferred date <span style="text-transform:none;color:#8a8f84;">(optional)</span></label>
          <input type="date" id="reqDate">
        </div>
        <div class="field">
          <label for="reqMessage">Anything else we should know? <span style="text-transform:none;color:#8a8f84;">(optional)</span></label>
          <textarea id="reqMessage" placeholder="Guest count, timing, questions…"></textarea>
        </div>
        <button class="btn btn--primary" type="submit" style="width:100%;justify-content:center;"><i class="bi bi-send"></i> Send Request</button>
      </form>
      <p class="spot-modal__fallback">Prefer email? <a href="community.html#contact">Reach our team directly</a>.</p>
    `;
  }

  reportFormHTML(spot) {
    return `
      <span class="eyebrow">Help Us Fix It</span>
      <h3 id="spotModalTitle">Report an issue with ${spot.name}</h3>
      <p class="spot-modal__lede">Wrong price, outdated photos, closed venue? Let us know what's off.</p>
      <form novalidate>
        <div class="field">
          <label for="repType">What's wrong?</label>
          <select id="repType" required>
            <option value="" disabled selected>Choose one…</option>
            <option value="pricing">Pricing is incorrect</option>
            <option value="closed">Venue is closed / no longer available</option>
            <option value="photos">Photos or description are wrong</option>
            <option value="duplicate">Duplicate listing</option>
            <option value="other">Something else</option>
          </select>
          <div class="invalid-feedback">Pick what this is about.</div>
        </div>
        <div class="field">
          <label for="repDetails">Details</label>
          <textarea id="repDetails" required minlength="10" placeholder="What did you notice?"></textarea>
          <div class="invalid-feedback">A couple of sentences helps (10+ characters).</div>
        </div>
        <button class="btn btn--primary" type="submit" style="width:100%;justify-content:center;"><i class="bi bi-flag"></i> Submit Report</button>
      </form>
      <p class="spot-modal__fallback">Prefer email? <a href="community.html#contact">Reach our team directly</a>.</p>
    `;
  }

  /** Same shape as SubmittableForm in js/community.js: validate, fake a network delay so the button's disabled state is visible, then show a success view. Wiring this to a real endpoint later just means replacing the setTimeout with a fetch(). */
  async handleSubmit(e) {
    e.preventDefault();
    const form = e.target;
    form.classList.add('was-validated');
    if (!form.checkValidity()) return;

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner spinner--inline"></div> Sending…';

    await new Promise((resolve) => setTimeout(resolve, 700));

    const successText = this.mode === 'request'
      ? `Your request for <strong>${this.spot.name}</strong> has been sent. Haven doesn't have live booking yet, so this is a demo confirmation — in production our team would follow up by email.`
      : `Thanks for flagging <strong>${this.spot.name}</strong>. Haven doesn't have a database connected yet, so this report isn't actually saved — but this is exactly how it will work once it is.`;

    this.body.innerHTML = `
      <div class="spot-modal__success">
        <i class="bi bi-check-circle"></i>
        <h3 id="spotModalTitle">${this.mode === 'request' ? 'Request sent' : 'Report submitted'}</h3>
        <p>${successText}</p>
        <button type="button" class="btn btn--ghost" id="spotModalDone" style="width:100%;justify-content:center;">Done</button>
      </div>
    `;
    this.body.querySelector('#spotModalDone').addEventListener('click', () => this.close());
  }
}

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
            <div class="details__loc"><i class="bi bi-geo-alt"></i> ${s.city ? `${s.city} · ` : (s.code ? `${s.code} · ` : '')}${s.country}</div>

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
              <button type="button" class="btn btn--primary" style="width:100%;justify-content:center;margin-top:1rem;" data-spot-action="request">
                <i class="bi bi-send"></i> Request This Spot
              </button>
              <button type="button" class="btn btn--ghost" style="width:100%;justify-content:center;margin-top:0.6rem;" data-spot-action="report">
                <i class="bi bi-flag"></i> Report an Issue
              </button>
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
    this.bindActions();
  }

  /**
   * "Request This Spot" and "Report an Issue" used to just link off to the
   * Community page's generic forms, with nothing tying the submission back
   * to the spot the visitor was actually looking at. They now open a small
   * in-page modal instead: pick a reason, get a real (if simulated) success
   * confirmation right there, with a fallback link to the Contact page for
   * anyone who'd rather not use the popup.
   */
  bindActions() {
    this.container.querySelectorAll('[data-spot-action]').forEach((btn) => {
      btn.addEventListener('click', () => SpotActionModal.open(btn.dataset.spotAction, this.spot));
    });
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