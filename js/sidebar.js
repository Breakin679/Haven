/**
 * Sidebar — collapsible navigation with icons + labels (custom UI requirement)
 *
 * - Desktop (>1024px): expands on hover via CSS; labels fade in automatically.
 * - Tablet (601–1024px): compact icon rail; toggle button reveals labels + overlay.
 * - Mobile (≤600px): off-canvas drawer; topbar menu button opens full sidebar.
 */
class Sidebar {
  constructor(rootSelector = '.sidebar') {
    this.root = document.querySelector(rootSelector);
    if (!this.root) return;

    this.toggleBtn = this.root.querySelector('.sidebar__toggle');
    this.overlay = document.querySelector('.sidebar-overlay');
    this.menuBtn = document.querySelector('.topbar__menu');
    this.mqMobile = window.matchMedia('(max-width: 600px)');
    this.mqTablet = window.matchMedia('(max-width: 1024px)');

    this.highlightActiveLink();
    this.bindToggle();
    this.bindOverlay();
    this.bindTopbarMenu();
    this.bindEscape();
    this.bindResize();
  }

  highlightActiveLink() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    this.root.querySelectorAll('.sidebar__link').forEach((link) => {
      link.classList.toggle('is-active', link.getAttribute('href') === currentPage);
    });
  }

  isOverlayMode() {
    return this.mqTablet.matches;
  }

  bindToggle() {
    if (!this.toggleBtn) return;

    this.toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });

    this.root.querySelectorAll('.sidebar__link').forEach((link) => {
      link.addEventListener('click', () => this.collapse());
    });

    document.addEventListener('click', (e) => {
      if (!this.root.classList.contains('is-expanded')) return;
      if (this.root.contains(e.target)) return;
      if (this.menuBtn?.contains(e.target)) return;
      this.collapse();
    });
  }

  bindOverlay() {
    if (!this.overlay) return;
    this.overlay.addEventListener('click', () => this.collapse());
  }

  bindTopbarMenu() {
    if (!this.menuBtn) return;

    this.menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });
  }

  bindEscape() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.root.classList.contains('is-expanded')) {
        this.collapse();
      }
    });
  }

  bindResize() {
    const onChange = () => {
      if (!this.isOverlayMode()) this.collapse();
    };
    this.mqTablet.addEventListener('change', onChange);
  }

  toggle() {
    if (this.root.classList.contains('is-expanded')) {
      this.collapse();
    } else {
      this.expand();
    }
  }

  expand() {
    this.root.classList.add('is-expanded');
    this.toggleBtn?.setAttribute('aria-expanded', 'true');
    this.menuBtn?.setAttribute('aria-expanded', 'true');

    if (this.isOverlayMode()) {
      document.body.classList.add('sidebar-open');
      if (this.overlay) {
        this.overlay.classList.add('is-visible');
        this.overlay.removeAttribute('hidden');
        this.overlay.setAttribute('aria-hidden', 'false');
      }
    }
  }

  collapse() {
    this.root.classList.remove('is-expanded');
    this.toggleBtn?.setAttribute('aria-expanded', 'false');
    this.menuBtn?.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('sidebar-open');

    if (this.overlay) {
      this.overlay.classList.remove('is-visible');
      this.overlay.setAttribute('hidden', '');
      this.overlay.setAttribute('aria-hidden', 'true');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => new Sidebar());
