/**
 * Set the actual viewport height as a CSS variable for iOS Safari
 * This fixes the 100vh issue where Safari's dynamic UI bars create gaps
 */
export function setAppHeight() {
  const vv = window.visualViewport;
  const h = vv?.height ?? window.innerHeight;
  document.documentElement.style.setProperty("--app-h", `${h}px`);
  
  // Debug log (can remove later)
  console.log('Viewport height set:', h, 'px');
}

/**
 * Initialize viewport height tracking
 * Call this once on app mount
 */
export function initViewportHeight() {
  setAppHeight();
  window.addEventListener("resize", setAppHeight);
  window.visualViewport?.addEventListener("resize", setAppHeight);
  window.visualViewport?.addEventListener("scroll", setAppHeight); // important on iOS
}

/**
 * Cleanup viewport height tracking
 */
export function cleanupViewportHeight() {
  window.removeEventListener("resize", setAppHeight);
  window.visualViewport?.removeEventListener("resize", setAppHeight);
  window.visualViewport?.removeEventListener("scroll", setAppHeight);
}
