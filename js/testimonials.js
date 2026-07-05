/**
 * Testimonial
 * Base class for a single testimonial slide. Each subclass renders a
 * completely different layout, while staying on the same color system.
 */
class Testimonial {
  constructor({ quote, name, role }) {
    this.quote = quote;
    this.name = name;
    this.role = role;
  }

  initials() {
    return this.name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  toSlideHTML() {
    return `<div class="testimonial-carousel__item">${this.toCardHTML()}</div>`;
  }
}

/** Variant 1 — quote-forward card with an initials ring. */
class QuoteTestimonial extends Testimonial {
  toCardHTML() {
    return `
      <div class="testi-card--quote">
        <div class="testi-avatar">${this.initials()}</div>
        <div>
          <span class="testi-mark">&ldquo;</span>
          <p class="quote">${this.quote}</p>
          <div class="testi-who">${this.name}<span>${this.role}</span></div>
        </div>
      </div>
    `;
  }
}

/** Variant 2 — a headline stat next to the quote. */
class StatTestimonial extends Testimonial {
  constructor(data) {
    super(data);
    this.statNum = data.statNum;
    this.statLabel = data.statLabel;
  }

  toCardHTML() {
    return `
      <div class="testi-card--stat">
        <div>
          <div class="testi-stat-num">${this.statNum}</div>
          <div class="testi-stat-label">${this.statLabel}</div>
        </div>
        <div>
          <p class="quote">${this.quote}</p>
          <div class="testi-who">${this.name}<span>${this.role}</span></div>
        </div>
      </div>
    `;
  }
}

/** Variant 3 — minimal, centered, perforated backdrop. */
class MinimalTestimonial extends Testimonial {
  toCardHTML() {
    return `
      <div class="testi-card--minimal">
        <div class="testi-rule"></div>
        <p class="quote">${this.quote}</p>
        <div class="testi-who">${this.name}<span>${this.role}</span></div>
      </div>
    `;
  }
}

/**
 * TestimonialCarousel
 * Builds the three testimonial slides and hands them to the shared
 * Carousel engine for the infinite, auto-rotating loop.
 */
class TestimonialCarousel {
  constructor({ viewportSelector, trackSelector, dotsSelector, prevSelector, nextSelector }) {
    this.viewport = document.querySelector(viewportSelector);
    this.track = document.querySelector(trackSelector);
    if (!this.track) return;

    this.slides = [
      new QuoteTestimonial({
        quote: 'We looked at four different palaces before finding Beiteddine on Haven. The listing had real photos and pricing, no back and forth needed to know it was the one.',
        name: 'Layla & Karim',
        role: 'Married at Beiteddine Palace',
      }),
      new StatTestimonial({
        quote: 'I used the Local filter to plan a last-minute weekend in Faraya. Booked a lodge without a single group chat.',
        name: 'Sarah T.',
        role: 'Solo traveler',
        statNum: '10 min',
        statLabel: 'From search to booked',
      }),
      new MinimalTestimonial({
        quote: 'As a planner I source venues for a living. Haven is the first place I check now. The budget filter alone saves me an hour per client.',
        name: 'Nadine R.',
        role: 'Wedding planner',
      }),
    ];

    this.track.innerHTML = this.slides.map((s) => s.toSlideHTML()).join('');

    this.carousel = new Carousel({
      viewport: this.viewport,
      track: this.track,
      dotsContainer: document.querySelector(dotsSelector),
      prevBtn: document.querySelector(prevSelector),
      nextBtn: document.querySelector(nextSelector),
      autoplayMs: 5500,
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new TestimonialCarousel({
    viewportSelector: '#testiViewport',
    trackSelector: '#testiTrack',
    dotsSelector: '#testiDots',
    prevSelector: '#testiPrev',
    nextSelector: '#testiNext',
  });
});