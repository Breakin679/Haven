/**
 * Carousel
 * A small, reusable infinite carousel engine.
 *
 * How the "infinite" loop works:
 *  - The track's original items are cloned once and appended after themselves.
 *  - Autoplay/next() walks forward through original + clones.
 *  - The instant it fully crosses into the clone set, the track snaps back
 *    to position 0 with transitions disabled for a single frame — because the
 *    clones are visually identical to the originals, the snap is invisible.
 *  - prev() uses the same trick in reverse.
 *
 * Works for any number of items-per-view, since it measures real pixel
 * offsets between rendered items rather than assuming a fixed width.
 */
class Carousel {
  constructor({ viewport, track, dotsContainer = null, prevBtn = null, nextBtn = null, autoplayMs = 4500 }) {
    this.viewport = viewport;
    this.track = track;
    this.dotsContainer = dotsContainer;
    this.prevBtn = prevBtn;
    this.nextBtn = nextBtn;
    this.autoplayMs = autoplayMs;
    this.timer = null;
    this.index = 0;

    this.setup();
  }

  setup() {
    this.originalItems = Array.from(this.track.children);
    this.count = this.originalItems.length;
    if (this.count === 0) return;

    // Clone once for the seamless-loop illusion (skip if only one slide).
    if (this.count > 1) {
      this.originalItems.forEach((item) => {
        const clone = item.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        clone.dataset.clone = 'true';
        this.track.appendChild(clone);
      });
    }

    this.buildDots();
    this.bindControls();
    this.bindHoverPause();
    this.bindResize();

    requestAnimationFrame(() => {
      this.measure();
      this.goTo(0, { instant: true });
      this.startAutoplay();
    });
  }

  measure() {
    const items = Array.from(this.track.children);
    if (items.length < 2) {
      this.step = items[0] ? items[0].getBoundingClientRect().width : 0;
      return;
    }
    const r0 = items[0].getBoundingClientRect();
    const r1 = items[1].getBoundingClientRect();
    this.step = r1.left - r0.left;
  }

  buildDots() {
    if (!this.dotsContainer) return;
    this.dotsContainer.innerHTML = this.originalItems
      .map((_, i) => `<button class="carousel__dot${i === 0 ? ' is-active' : ''}" data-index="${i}" aria-label="Go to slide ${i + 1}"></button>`)
      .join('');
    this.dots = Array.from(this.dotsContainer.children);
    this.dots.forEach((dot) => {
      dot.addEventListener('click', () => {
        this.goTo(Number(dot.dataset.index));
        this.restartAutoplay();
      });
    });
  }

  bindControls() {
    if (this.nextBtn) this.nextBtn.addEventListener('click', () => { this.next(); this.restartAutoplay(); });
    if (this.prevBtn) this.prevBtn.addEventListener('click', () => { this.prev(); this.restartAutoplay(); });
  }

  bindHoverPause() {
    this.viewport.addEventListener('mouseenter', () => this.stopAutoplay());
    this.viewport.addEventListener('mouseleave', () => this.startAutoplay());
    this.viewport.addEventListener('focusin', () => this.stopAutoplay());
    this.viewport.addEventListener('focusout', () => this.startAutoplay());
  }

  bindResize() {
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        this.measure();
        this.applyTransform(true);
      }, 150);
    });
  }

  startAutoplay() {
    if (this.count <= 1 || this.autoplayMs <= 0) return;
    this.stopAutoplay();
    this.timer = setInterval(() => this.next(), this.autoplayMs);
  }

  stopAutoplay() { if (this.timer) clearInterval(this.timer); }

  restartAutoplay() { this.stopAutoplay(); this.startAutoplay(); }

  applyTransform(instant = false) {
    if (instant) this.track.classList.add('no-transition');
    this.track.style.transform = `translateX(-${this.index * this.step}px)`;
    if (instant) {
      // Force reflow so the "no-transition" class actually applies before we remove it.
      void this.track.offsetHeight;
      this.track.classList.remove('no-transition');
    }
    this.updateDots();
  }

  updateDots() {
    if (!this.dots) return;
    const active = ((this.index % this.count) + this.count) % this.count;
    this.dots.forEach((dot, i) => dot.classList.toggle('is-active', i === active));
  }

  goTo(index, { instant = false } = {}) {
    this.index = index;
    this.applyTransform(instant);
  }

  next() {
    this.index += 1;
    this.applyTransform();
    if (this.index >= this.count && this.count > 1) {
      this.onTransitionEndOnce(() => this.goTo(this.index - this.count, { instant: true }));
    }
  }

  prev() {
    if (this.index === 0 && this.count > 1) {
      // Jump invisibly into the clone zone (looks identical to slide 0), then animate back one step.
      this.goTo(this.count, { instant: true });
      requestAnimationFrame(() => this.goTo(this.count - 1));
      return;
    }
    this.index -= 1;
    this.applyTransform();
  }

  onTransitionEndOnce(callback) {
    const handler = () => {
      this.track.removeEventListener('transitionend', handler);
      callback();
    };
    this.track.addEventListener('transitionend', handler);
  }
}