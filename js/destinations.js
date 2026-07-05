/**
 * DestinationCatalog
 * Drives the infinite spot carousel on the home page. Built entirely on
 * top of LocalSpots + Spot — the search page (js/search/*) reuses the
 * exact same LocalSpots.build() rather than a separate dataset.
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
    this.spots = LocalSpots.build();
    this.carousel = null;

    if (this.track) this.renderCarousel();
    if (this.toggleGroup) this.bindToggle();
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