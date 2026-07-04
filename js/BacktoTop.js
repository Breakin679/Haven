/**
 * BackToTop
 * A small floating button that fades in once the person has scrolled
 * past a threshold, and smooth-scrolls back to the top on click.
 */
class BackToTop {
  constructor(buttonSelector = '#backToTop', threshold = 480) {
    this.button = document.querySelector(buttonSelector);
    if (!this.button) return;

    this.threshold = threshold;
    this.bind();
  }

  bind() {
    window.addEventListener('scroll', () => this.toggleVisibility(), { passive: true });
    this.button.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    this.toggleVisibility();
  }

  toggleVisibility() {
    this.button.classList.toggle('is-visible', window.scrollY > this.threshold);
  }
}

document.addEventListener('DOMContentLoaded', () => new BackToTop());