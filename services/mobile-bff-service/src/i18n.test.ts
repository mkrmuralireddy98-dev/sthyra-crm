import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  parseAcceptLanguage, formatError, SUPPORTED_LOCALES, DEFAULT_LOCALE,
} from './i18n.js';

describe('i18n — parseAcceptLanguage', () => {
  it('returns null for missing header', () => {
    assert.equal(parseAcceptLanguage(undefined), null);
  });

  it('returns null when no supported locales', () => {
    assert.equal(parseAcceptLanguage('ja-JP,ko-KR;q=0.9'), null);
  });

  it('returns exact match when present', () => {
    assert.equal(parseAcceptLanguage('de-DE'), 'de-DE');
  });

  it('respects q-values (prefers higher-quality)', () => {
    const result = parseAcceptLanguage('de-DE;q=0.1,en-US;q=0.9');
    assert.equal(result, 'en-US');
  });

  it('skips unsupported locales and picks highest-priority supported one', () => {
    // fr-FR is unsupported; the next highest-priority is de-DE
    const result = parseAcceptLanguage('fr-FR;q=0.9,de-DE;q=0.5,en-US;q=0.1');
    assert.equal(result, 'de-DE');
  });

  it('first supported locale wins (sorted by q-value)', () => {
    // Both en-US and de-DE are supported; en-US has higher q
    const result = parseAcceptLanguage('en-US;q=0.9,de-DE;q=0.5');
    assert.equal(result, 'en-US');
  });

  it('returns SUPPORTED_LOCALES list (length 2 MVP)', () => {
    assert.equal(SUPPORTED_LOCALES.length, 2);
    assert.ok(SUPPORTED_LOCALES.includes('en-US'));
    assert.ok(SUPPORTED_LOCALES.includes('de-DE'));
  });

  it('DEFAULT_LOCALE is en-US', () => {
    assert.equal(DEFAULT_LOCALE, 'en-US');
  });
});

describe('i18n — formatError', () => {
  it('formats error in en-US (default)', () => {
    assert.equal(formatError('unauthorized'), 'Missing or invalid JWT');
  });

  it('formats error in de-DE', () => {
    assert.equal(formatError('unauthorized', 'de-DE'), 'JWT fehlt oder ist ungültig');
  });

  it('formats chunk_too_large in both locales', () => {
    assert.match(formatError('chunk_too_large', 'en-US'), /max/i);
    assert.match(formatError('chunk_too_large', 'de-DE'), /max/i);
  });

  it('falls back to en-US when locale not supported', () => {
    assert.equal(formatError('unauthorized', 'ja-JP' as never), 'Missing or invalid JWT');
  });
});

describe('i18n — SupportedLocale round-trip', () => {
  it('all error codes have entries in both locales', () => {
    for (const locale of SUPPORTED_LOCALES) {
      assert.ok(formatError('unauthorized', locale));
      assert.ok(formatError('not_found', locale));
      assert.ok(formatError('invalid_input', locale));
    }
  });
});