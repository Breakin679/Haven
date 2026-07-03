/**
 * CountUp
 * Animates a stat element from 0 up to its target value/suffix on load,
 * e.g. "18+" or "4.7". Purely for the hero's entrance dynamism.
 */
class CountUp {
  constructor(el, { duration = 1200 } = {}) {
    this.el = el;
    this.duration = duration;
    this.raw = el.textContent.trim();
    this.match = this.raw.match(/^([\d.]+)(.*)$/);
    if (!this.match) return;

    this.target = parseFloat(this.match[1]);
    this.suffix = this.match[2] || '';
    this.decimals = this.match[1].includes('.') ? this.match[1].split('.')[1].length : 0;
    this.run();
  }

  run() {
    const start = performance.now();
    const step = (now) => {
      const progress = Math.min((now - start) / this.duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
      const value = (this.target * eased).toFixed(this.decimals);
      this.el.textContent = `${value}${this.suffix}`;
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.hero__stat-num').forEach((el) => new CountUp(el));
});