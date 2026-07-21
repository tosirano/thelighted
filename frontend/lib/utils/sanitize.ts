/**
 * sanitize.ts
 *
 * Wraps DOMPurify with a strict allowlist.
 * - No <script> tags
 * - No event handler attributes (onclick, onload, etc.)
 * - No javascript: URIs
 * - Only safe inline formatting tags allowed
 *
 * Safe to call server-side (returns input unchanged when window is absent).
 */

import DOMPurify from "dompurify";

/**
 * Allowed HTML tags — conservative list for user-generated content.
 * Does NOT include <script>, <iframe>, <object>, <embed>, <form>, etc.
 */
const ALLOWED_TAGS = [
  "b", "strong", "i", "em", "u", "s", "br", "p",
  "ul", "ol", "li", "blockquote", "span",
];

/**
 * Allowed attributes — explicitly no event handlers or src/href attributes
 * that could carry javascript: URIs.
 */
const ALLOWED_ATTR: string[] = [];

/**
 * Sanitize a string of user-generated content.
 *
 * @param input - Raw string that may contain HTML
 * @returns Sanitized string safe for rendering
 *
 * @example
 * sanitize('<script>alert(1)</script>Hello')  // → 'Hello'
 * sanitize('<b onclick="evil()">Bold</b>')     // → '<b>Bold</b>'
 * sanitize('<a href="javascript:evil()">x</a>') // → 'x'
 */
export function sanitize(input: string): string {
  if (typeof window === "undefined") {
    // Server-side: DOMPurify requires a DOM. Strip all tags as a safe fallback.
    return input.replace(/<[^>]*>/g, "");
  }

  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Block javascript: and data: URIs in any attribute value
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    // Prevent DOM clobbering
    SANITIZE_DOM: true,
  });
}

/**
 * Strip ALL HTML tags — use this when you only need plain text output.
 *
 * @example
 * stripTags('<b>Hello</b> world') // → 'Hello world'
 */
export function stripTags(input: string): string {
  if (typeof window === "undefined") {
    return input.replace(/<[^>]*>/g, "");
  }
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}