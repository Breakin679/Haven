/**
 * Sidebar
 * - Highlights the link matching the current page.
 * - Wide desktop expands purely via CSS :hover — nothing to do here.
 * - Small desktop / tablet can't rely on hover, so a toggle button
 *   (visible only in that breakpoint, via CSS) presses the rail open.
 */
class Sidebar {
  constructor(rootSelector = '.sidebar') {
    this.root = document.querySelector(rootSelector);
    if (!this.root) return;

    this.toggleBtn = this.root.querySelector('.sidebar__toggle');
    this.highlightActiveLink();
    this.bindToggle();
  }

  highlightActiveLink() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    this.root.querySelectorAll('.sidebar__link').forEach((link) => {
      link.classList.toggle('is-active', link.getAttribute('href') === currentPage);
    });
  }

  bindToggle() {
    if (!this.toggleBtn) return;

    this.toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const expanded = this.root.classList.toggle('is-expanded');
      this.toggleBtn.setAttribute('aria-expanded', String(expanded));
    });

    // Pressing a nav link while expanded (small desktop) should close it again.
    this.root.querySelectorAll('.sidebar__link').forEach((link) => {
      link.addEventListener('click', () => this.collapse());
    });

    // Clicking anywhere outside the rail closes it.
    document.addEventListener('click', (e) => {
      if (!this.root.contains(e.target)) this.collapse();
    });
  }

  collapse() {
    this.root.classList.remove('is-expanded');
    if (this.toggleBtn) this.toggleBtn.setAttribute('aria-expanded', 'false');
  }
}

document.addEventListener('DOMContentLoaded', () => new Sidebar());