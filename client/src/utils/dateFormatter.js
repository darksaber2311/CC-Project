/**
 * SecureDocs Unified Date & Time Formatter
 * 
 * Ensures all UTC timestamps from SQLite/Node.js are parsed accurately
 * without browser/ECMAScript local-time misinterpretation, and displayed
 * in India Standard Time (Asia/Kolkata, UTC+05:30) as:
 * "28 Oct 2026, 2:30:45 PM IST"
 */

export function parseUtcDate(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;

    // 1. If it has timezone offset or ends with Z, it is an explicit ISO string
    if (trimmed.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(trimmed)) {
      const d = new Date(trimmed);
      return isNaN(d.getTime()) ? null : d;
    }

    // 2. If it's SQLite default format YYYY-MM-DD HH:MM:SS(.SSS)
    // SQLite's datetime('now') generates UTC but omits 'T' and 'Z'.
    // Convert to explicit ISO 8601 UTC to prevent local-timezone misinterpretation.
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(trimmed)) {
      const d = new Date(trimmed.replace(' ', 'T') + 'Z');
      return isNaN(d.getTime()) ? null : d;
    }

    // 3. If it has 'T' but no timezone indicator YYYY-MM-DDTHH:MM:SS(.SSS)
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(trimmed)) {
      const d = new Date(trimmed + 'Z');
      return isNaN(d.getTime()) ? null : d;
    }

    // General fallback
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function formatDateTime(val, options = {}) {
  const d = parseUtcDate(val);
  if (!d) return '—';

  const timeZone = options.timeZone || 'Asia/Kolkata';

  const dtf = new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone
  });

  const parts = dtf.formatToParts(d);
  const m = {};
  for (const p of parts) m[p.type] = p.value;

  const tzAbbr = timeZone === 'Asia/Kolkata' ? 'IST' : (options.timeZoneName || 'UTC');
  return `${m.day} ${m.month} ${m.year}, ${m.hour}:${m.minute}:${m.second} ${(m.dayPeriod || '').toUpperCase()} ${tzAbbr}`;
}

export function formatDate(val, options = {}) {
  const d = parseUtcDate(val);
  if (!d) return '—';

  const timeZone = options.timeZone || 'Asia/Kolkata';

  const dtf = new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone
  });

  const parts = dtf.formatToParts(d);
  const m = {};
  for (const p of parts) m[p.type] = p.value;

  return `${m.day} ${m.month} ${m.year}`;
}

export function formatTime(val, options = {}) {
  const d = parseUtcDate(val);
  if (!d) return '—';

  const timeZone = options.timeZone || 'Asia/Kolkata';
  const includeSeconds = options.includeSeconds !== false;

  const dtf = new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    ...(includeSeconds ? { second: '2-digit' } : {}),
    hour12: true,
    timeZone
  });

  const parts = dtf.formatToParts(d);
  const m = {};
  for (const p of parts) m[p.type] = p.value;

  const tzAbbr = timeZone === 'Asia/Kolkata' ? 'IST' : (options.timeZoneName || 'UTC');
  const timeStr = includeSeconds 
    ? `${m.hour}:${m.minute}:${m.second} ${(m.dayPeriod || '').toUpperCase()}`
    : `${m.hour}:${m.minute} ${(m.dayPeriod || '').toUpperCase()}`;

  return `${timeStr} ${tzAbbr}`;
}
