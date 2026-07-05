/**
 * SubmittableForm
 * Shared behavior for any form on this page: run native HTML5 validation,
 * show Bootstrap-style invalid feedback if something's wrong, and on
 * success show a confirmation banner and reset the form.
 *
 * IMPORTANT: there is no backend or database behind this project yet.
 * Submitting either form does not save or send anything anywhere — it
 * only simulates success locally so the interaction can be demonstrated.
 * Wiring this to a real endpoint later just means replacing fakeSubmit().
 */
class SubmittableForm {
  constructor({ formSelector, successSelector, successMessage }) {
    this.form = document.querySelector(formSelector);
    if (!this.form) return;

    this.success = document.querySelector(successSelector);
    this.successMessage = successMessage;

    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
  }

  /** Subclasses can override for extra checks beyond native HTML5 validity (e.g. "pick at least one chip"). */
  extraValidation() { return true; }

  async handleSubmit(e) {
    e.preventDefault();
    this.form.classList.add('was-validated');

    const nativelyValid = this.form.checkValidity();
    const customValid = this.extraValidation();

    if (!nativelyValid || !customValid) {
      if (this.success) this.success.classList.remove('is-visible');
      return;
    }

    await this.fakeSubmit();

    if (this.success) {
      this.success.innerHTML = `<i class="bi bi-check-circle"></i><span>${this.successMessage}</span>`;
      this.success.classList.add('is-visible');
      this.success.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    this.form.reset();
    this.form.classList.remove('was-validated');
    this.afterReset();
  }

  /** Simulated network delay so the submit button's disabled state is visible, same shape a real fetch() call would have. */
  fakeSubmit() {
    const btn = this.form.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.dataset.originalText = btn.innerHTML; btn.innerHTML = '<div class="spinner spinner--inline"></div> Sending…'; }

    return new Promise((resolve) => {
      setTimeout(() => {
        if (btn) { btn.disabled = false; btn.innerHTML = btn.dataset.originalText; }
        resolve();
      }, 700);
    });
  }

  afterReset() {}
}

/**
 * VenueSubmissionForm
 * Adds the "pick at least one category" chip requirement on top of the
 * shared validation flow.
 */
class VenueSubmissionForm extends SubmittableForm {
  constructor(options) {
    super(options);
    if (!this.form) return;

    this.chipSet = this.form.querySelector('#venueCategoryChips');
    if (this.chipSet) {
      this.chipSet.addEventListener('click', (e) => {
        const chip = e.target.closest('.chip');
        if (!chip) return;
        chip.classList.toggle('is-active');
        this.chipSet.classList.remove('is-required-empty');
      });
    }
  }

  extraValidation() {
    if (!this.chipSet) return true;
    const anyActive = this.chipSet.querySelector('.chip.is-active');
    this.chipSet.classList.toggle('is-required-empty', !anyActive);
    return Boolean(anyActive);
  }

  afterReset() {
    if (this.chipSet) this.chipSet.querySelectorAll('.chip').forEach((c) => c.classList.remove('is-active'));
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new VenueSubmissionForm({
    formSelector: '#venueForm',
    successSelector: '#venueSuccess',
    successMessage: 'Thanks. Your venue was recorded for this demo. (No database is connected yet, so nothing was actually saved.)',
  });

  new SubmittableForm({
    formSelector: '#contactForm',
    successSelector: '#contactSuccess',
    successMessage: 'Thanks for reaching out. In a live version, our team would reply within a day or two.',
  });
});