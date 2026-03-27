/**
 * Smoothly scrolls the window to the top. Use after successful form submissions
 * when the user stays on the same page so they see the top of the page (e.g. success message).
 */
export function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
