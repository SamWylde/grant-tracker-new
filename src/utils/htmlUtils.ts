/**
 * Utility functions for HTML manipulation
 */

/**
 * Strip HTML tags and decode entities from a string
 * @param html - HTML string to clean
 * @returns Plain text with HTML removed and entities decoded
 */
export function stripHtml(html: string): string {
  if (!html) return '';

  // Create a temporary div to use browser's HTML parsing
  const tmp = document.createElement('div');
  tmp.innerHTML = html;

  // Get text content (this automatically decodes entities and strips tags)
  let text = tmp.textContent || tmp.innerText || '';

  // Clean up extra whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}
