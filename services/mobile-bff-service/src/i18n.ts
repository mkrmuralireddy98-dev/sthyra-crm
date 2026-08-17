/**
 * i18n — error message catalog (Phase 6).
 *
 * Locales shipped Phase 6 MVP: en-US, de-DE.
 * Phase 6.b: add ja-JP, es-ES, etc.
 */

export type SupportedLocale = 'en-US' | 'de-DE';

export const SUPPORTED_LOCALES: readonly SupportedLocale[] = ['en-US', 'de-DE'] as const;
export const DEFAULT_LOCALE: SupportedLocale = 'en-US';

export type ErrorCode =
  | 'unauthorized'
  | 'missing_idempotency_key'
  | 'invalid_input'
  | 'not_found'
  | 'chunk_too_large'
  | 'session_too_large'
  | 'chunk_conflict'
  | 'finalize_conflict'
  | 'conversation_full'
  | 'unsupported_locale';

const messages: Record<ErrorCode, Record<SupportedLocale, string>> = {
  unauthorized: {
    'en-US': 'Missing or invalid JWT',
    'de-DE': 'JWT fehlt oder ist ungültig',
  },
  missing_idempotency_key: {
    'en-US': 'Missing Idempotency-Key',
    'de-DE': 'Idempotency-Key fehlt',
  },
  invalid_input: {
    'en-US': 'Invalid input',
    'de-DE': 'Ungültige Eingabe',
  },
  not_found: {
    'en-US': 'Resource not found',
    'de-DE': 'Ressource nicht gefunden',
  },
  chunk_too_large: {
    'en-US': 'Chunk too large (max 32MB)',
    'de-DE': 'Chunk zu groß (max. 32MB)',
  },
  session_too_large: {
    'en-US': 'Session too large (max 8GB)',
    'de-DE': 'Sitzung zu groß (max. 8GB)',
  },
  chunk_conflict: {
    'en-US': 'Chunk data mismatch at this index',
    'de-DE': 'Chunk-Daten stimmen an diesem Index nicht überein',
  },
  finalize_conflict: {
    'en-US': 'Finalize validation failed',
    'de-DE': 'Finalisierungs-Validierung fehlgeschlagen',
  },
  conversation_full: {
    'en-US': 'Conversation at message cap (1000)',
    'de-DE': 'Konversation hat Nachrichtenlimit erreicht (1000)',
  },
  unsupported_locale: {
    'en-US': 'Unsupported locale',
    'de-DE': 'Nicht unterstützte Sprache',
  },
};

/**
 * Parse Accept-Language header. Per RFC 7231.
 * Returns the highest-quality supported locale, or null if none supported.
 */
export function parseAcceptLanguage(header: string | undefined): SupportedLocale | null {
  if (!header) return null;
  const entries = header
    .split(',')
    .map((entry) => {
      const [tag, ...qParts] = entry.trim().split(';');
      const quality = qParts
        .map((p) => p.trim())
        .find((p) => p.startsWith('q='));
      const trimmedTag = (tag ?? '').trim().toLowerCase();
      if (!trimmedTag) return null;
      return { tag: trimmedTag, q: quality ? Number(quality.slice(2)) : 1 };
    })
    .filter((e): e is { tag: string; q: number } => e !== null)
    .sort((a, b) => b.q - a.q);

  for (const e of entries) {
    // Case-insensitive lookup against supported locales
    const supportedLower = SUPPORTED_LOCALES.map((l) => l.toLowerCase());
    const idx = supportedLower.indexOf(e.tag);
    if (idx >= 0) {
      return SUPPORTED_LOCALES[idx]!;
    }
  }
  return null;
}

/**
 * Format an error message in the given locale. Falls back to DEFAULT_LOCALE
 * if the requested locale doesn't have a translation (no current case).
 */
export function formatError(code: ErrorCode, locale: SupportedLocale = DEFAULT_LOCALE): string {
  const dict = messages[code];
  return dict[locale] ?? dict[DEFAULT_LOCALE];
}