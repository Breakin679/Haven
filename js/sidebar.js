/**
 * Sidebar
 * Handles the collapsible sidebar behaviour shared across every page:
 *  - toggling the collapsed/expanded state
 *  - remembering the user's last choice (localStorage)
 *  - highlighting the link that matches the current page
 */
class Sidebar {
  constructor(rootSelector = '.sidebar') {
    this.root = document.querySelector(rootSelector);
    if (!this.root) return;

    this.toggleBtn = this.root.querySelector('.sidebar__toggle');
    this.storageKey = 'haven:sidebar-collapsed';

    this.applyStoredState();
    this.highlightActiveLink();
    this.bindEvents();
  }

  applyStoredState() {
    const collapsed = localStorage.getItem(this.storageKey) === 'true';
    this.setCollapsed(collapsed, false);
  }

  bindEvents() {
    if (this.toggleBtn) {
      this.toggleBtn.addEventListener('click', () => {
        const isCollapsed = this.root.classList.contains('is-collapsed');
        this.setCollapsed(!isCollapsed, true);
      });
    }
  }

  setCollapsed(collapsed, persist) {
    this.root.classList.toggle('is-collapsed', collapsed);
    document.body.classList.toggle('sidebar-collapsed', collapsed);

    if (this.toggleBtn) {
      const label = this.toggleBtn.querySelector('.sidebar__label');
      if (label) label.textContent = collapsed ? 'Expand' : 'Collapse';
      this.toggleBtn.setAttribute('aria-expanded', String(!collapsed));
    }

    if (persist) localStorage.setItem(this.storageKey, String(collapsed));
  }

  highlightActiveLink() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    this.root.querySelectorAll('.sidebar__link').forEach((link) => {
      const target = link.getAttribute('href');
      link.classList.toggle('is-active', target === currentPage);
    });
  }
}

document.addEventListener('DOMContentLoaded', () => new Sidebar());
