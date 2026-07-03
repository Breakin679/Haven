/**
 * Sidebar
 * The rail itself expands/collapses purely with CSS (:hover / :focus-within),
 * so this class only has one job: mark the link that matches the current page.
 */
class Sidebar {
  constructor(rootSelector = '.sidebar') {
    this.root = document.querySelector(rootSelector);
    if (!this.root) return;
    this.highlightActiveLink();
  }

  highlightActiveLink() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    this.root.querySelectorAll('.sidebar__link').forEach((link) => {
      link.classList.toggle('is-active', link.getAttribute('href') === currentPage);
    });
  }
}

document.addEventListener('DOMContentLoaded', () => new Sidebar());