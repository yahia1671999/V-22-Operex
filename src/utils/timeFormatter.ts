/**
 * Unified Time and Date Formatter for 12-Hour Display
 * Supports Arabic (ص / م) and English (AM / PM)
 */

export interface FormatTimeOptions {
  lang?: 'ar' | 'en';
  includeSeconds?: boolean;
  fallback?: string;
}

export interface FormatDateTimeOptions extends FormatTimeOptions {
  dateSeparator?: '/' | '-';
  showDate?: boolean;
  showTime?: boolean;
}

/**
 * Format any time string, Date object, or timestamp into 12-hour format with AM/PM (ص / م)
 * Examples:
 * - "19:59" -> "07:59 م" (ar) / "07:59 PM" (en)
 * - "03:39" -> "03:39 ص" (ar) / "03:39 AM" (en)
 * - "12:00" -> "12:00 م" (ar) / "12:00 PM" (en)
 * - "00:00" -> "12:00 ص" (ar) / "12:00 AM" (en)
 */
export function formatTime12h(
  timeInput: string | Date | number | null | undefined,
  options?: FormatTimeOptions | 'ar' | 'en'
): string {
  // Normalize options
  const opts: FormatTimeOptions = typeof options === 'string'
    ? { lang: options }
    : (options || {});
  
  const lang = opts.lang === 'en' ? 'en' : 'ar';
  const fallback = opts.fallback !== undefined ? opts.fallback : '--:--';
  const includeSeconds = !!opts.includeSeconds;

  if (timeInput === null || timeInput === undefined || timeInput === '') {
    return fallback;
  }

  let hours: number | null = null;
  let minutes: number | null = null;
  let seconds: number | null = null;

  if (timeInput instanceof Date) {
    if (isNaN(timeInput.getTime())) return fallback;
    hours = timeInput.getHours();
    minutes = timeInput.getMinutes();
    seconds = timeInput.getSeconds();
  } else if (typeof timeInput === 'number') {
    const d = new Date(timeInput);
    if (isNaN(d.getTime())) return fallback;
    hours = d.getHours();
    minutes = d.getMinutes();
    seconds = d.getSeconds();
  } else if (typeof timeInput === 'string') {
    const trimmed = timeInput.trim();
    if (!trimmed || trimmed === '--:--' || trimmed === '---' || trimmed === '-' || trimmed === 'Invalid Date') {
      return fallback;
    }

    // Check if it already has Arabic or English period
    if (trimmed.includes(' ص') || trimmed.includes(' م') || trimmed.toUpperCase().includes(' AM') || trimmed.toUpperCase().includes(' PM')) {
      return trimmed;
    }

    // If it contains ISO string with Z or timezone offset (+XX:XX or -XX:XX)
    if (trimmed.includes('T') && (trimmed.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(trimmed))) {
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) {
        hours = d.getHours();
        minutes = d.getMinutes();
        seconds = d.getSeconds();
      }
    }

    // If still null, try plain ISO local string YYYY-MM-DDTHH:mm(:ss)?
    if (hours === null && trimmed.includes('T')) {
      const timePart = trimmed.split('T')[1];
      if (timePart) {
        const match = timePart.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
        if (match) {
          hours = parseInt(match[1], 10);
          minutes = parseInt(match[2], 10);
          seconds = match[3] !== undefined ? parseInt(match[3], 10) : 0;
        }
      }
    }

    // If still null, try pure time string HH:mm or HH:mm:ss
    if (hours === null) {
      const match = trimmed.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
      if (match) {
        hours = parseInt(match[1], 10);
        minutes = parseInt(match[2], 10);
        seconds = match[3] !== undefined ? parseInt(match[3], 10) : 0;
      }
    }

    // If still null, try general Date parse
    if (hours === null) {
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) {
        hours = d.getHours();
        minutes = d.getMinutes();
        seconds = d.getSeconds();
      }
    }
  }

  if (hours === null || minutes === null || isNaN(hours) || isNaN(minutes)) {
    return String(timeInput || fallback);
  }

  const isPM = hours >= 12;
  const hour12 = hours % 12 || 12;
  const period = lang === 'ar' ? (isPM ? 'م' : 'ص') : (isPM ? 'PM' : 'AM');

  const hh = String(hour12).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  
  if (includeSeconds && seconds !== null && !isNaN(seconds)) {
    const ss = String(seconds).padStart(2, '0');
    return `${hh}:${mm}:${ss} ${period}`;
  }

  return `${hh}:${mm} ${period}`;
}

/**
 * Formats a Date/Timestamp into unified Date + 12-hour Time string
 * Example: "2026/08/18 07:59 م" or "2026-08-18 07:59 م"
 */
export function formatDateTime12h(
  input: string | Date | number | null | undefined,
  options?: FormatDateTimeOptions | 'ar' | 'en'
): string {
  const opts: FormatDateTimeOptions = typeof options === 'string'
    ? { lang: options }
    : (options || {});

  const lang = opts.lang === 'en' ? 'en' : 'ar';
  const separator = opts.dateSeparator || '/';
  const fallback = opts.fallback !== undefined ? opts.fallback : '---';

  if (!input) return fallback;

  let d: Date | null = null;
  let rawDateStr = '';

  if (input instanceof Date) {
    d = isNaN(input.getTime()) ? null : input;
  } else if (typeof input === 'number') {
    const temp = new Date(input);
    d = isNaN(temp.getTime()) ? null : temp;
  } else if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed.includes('T')) {
      rawDateStr = trimmed.split('T')[0];
    }
    const temp = new Date(trimmed);
    if (!isNaN(temp.getTime())) {
      d = temp;
    }
  }

  if (!d) return String(input);

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  const dateStr = rawDateStr && separator === '-' 
    ? rawDateStr 
    : `${year}${separator}${month}${separator}${day}`;

  const timeStr = formatTime12h(input, {
    lang,
    includeSeconds: opts.includeSeconds,
    fallback: ''
  });

  if (opts.showDate === false) return timeStr;
  if (opts.showTime === false) return dateStr;

  return `${dateStr} ${timeStr}`.trim();
}

/**
 * Creates a local ISO timestamp string without UTC shift
 * Format: "YYYY-MM-DDTHH:mm:ss"
 */
export function createLocalTimestamp(dateStr: string, timeStr: string): string {
  const cleanDate = (dateStr || '').trim();
  let cleanTime = (timeStr || '').trim();

  if (cleanTime.length === 5) {
    cleanTime = `${cleanTime}:00`;
  } else if (cleanTime.length === 0) {
    cleanTime = '00:00:00';
  }

  return `${cleanDate}T${cleanTime}`;
}

/**
 * Extracts a normalized 24-hour HH:mm string from any timestamp for input forms
 */
export function extractTime24h(input: string | Date | number | null | undefined): string {
  if (!input) return '';

  if (input instanceof Date && !isNaN(input.getTime())) {
    const hh = String(input.getHours()).padStart(2, '0');
    const mm = String(input.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed.includes('T')) {
      const timePart = trimmed.split('T')[1];
      const match = timePart.match(/^(\d{1,2}):(\d{1,2})/);
      if (match) {
        return `${match[1].padStart(2, '0')}:${match[2].padStart(2, '0')}`;
      }
    }
    const match = trimmed.match(/^(\d{1,2}):(\d{1,2})/);
    if (match) {
      return `${match[1].padStart(2, '0')}:${match[2].padStart(2, '0')}`;
    }
  }

  return '';
}
