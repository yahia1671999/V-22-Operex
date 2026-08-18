import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML strings to prevent Stored & DOM-based XSS attacks.
 */
export function sanitizeHtml(rawHtml: string | null | undefined): string {
  if (!rawHtml || typeof rawHtml !== 'string') return '';
  
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: [
      'p', 'b', 'i', 'em', 'strong', 'u', 's', 'strike', 'sub', 'sup',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'span', 'blockquote',
      'ul', 'ol', 'li', 'br', 'hr', 'table', 'thead', 'tbody', 'tfoot',
      'tr', 'th', 'td', 'caption', 'code', 'pre', 'mark', 'small'
    ],
    ALLOWED_ATTR: [
      'style', 'class', 'dir', 'align', 'colspan', 'rowspan', 'title', 'id'
    ],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  });
}
