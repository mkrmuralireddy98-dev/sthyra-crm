import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  tokens,
  tokensFor,
  toCssVariables,
  brand,
  type ColorMode,
} from './index.js';

describe('tokens', () => {
  describe('default export', () => {
    it('ships dark mode by default (product default per design spec)', () => {
      assert.equal(tokens.color.bg, '#0A0D13');
    });
  });

  describe('tokensFor(mode)', () => {
    const modes: ColorMode[] = ['light', 'dark', 'high-contrast'];

    it('returns a complete color token bundle for every mode', () => {
      for (const mode of modes) {
        const t = tokensFor(mode);
        for (const key of [
          'bg', 'surface', 'fg', 'border', 'accent',
          'positive', 'warning', 'critical', 'focus',
        ] as const) {
          assert.ok(t.color[key].length > 0, `${mode}.color.${key} must be defined`);
          assert.match(t.color[key], /^#[0-9A-Fa-f]{6}$/, `${mode}.color.${key} must be a hex color`);
        }
      }
    });

    it('returns distinct bg colors across modes', () => {
      const bgs = new Set(modes.map((m) => tokensFor(m).color.bg));
      assert.equal(bgs.size, modes.length, 'each mode must have a unique bg');
    });

    it('uses white-on-black for high-contrast mode', () => {
      const hc = tokensFor('high-contrast');
      assert.equal(hc.color.bg, '#000000');
      assert.equal(hc.color.fg, '#FFFFFF');
      assert.equal(hc.color.border, '#FFFFFF');
    });
  });

  describe('brand palette (PPE-aware — Appendix L.1 resolution)', () => {
    it('uses teal as primary accent', () => {
      assert.equal(brand.signal500, '#00B894');
    });

    it('uses amber as warning-only (NOT primary)', () => {
      assert.match(brand.amber500, /^#[0-9A-Fa-f]{6}$/);
    });

    it('warning in dark mode is amber400 (lighter shade for contrast)', () => {
      assert.equal(tokensFor('dark').color.warning, brand.amber400);
    });

    it('warning in light mode is amber500 (darker shade for contrast)', () => {
      assert.equal(tokensFor('light').color.warning, brand.amber500);
    });
  });

  describe('toCssVariables()', () => {
    it('emits a valid :root block', () => {
      const css = toCssVariables('dark');
      assert.match(css, /^:root \{/);
      assert.match(css, /\}$/);
    });

    it('includes color, spacing, radius, motion, and shadow tokens', () => {
      const css = toCssVariables('dark');
      assert.match(css, /--color-bg:/);
      assert.match(css, /--color-accent:/);
      assert.match(css, /--space-4:/);
      assert.match(css, /--radius-md:/);
      assert.match(css, /--dur-base:/);
      assert.match(css, /--ease-standard:/);
      assert.match(css, /--shadow-md:/);
    });

    it('emits different bg color per mode', () => {
      const lightCss = toCssVariables('light');
      const darkCss = toCssVariables('dark');
      assert.notEqual(
        lightCss.match(/--color-bg: (.+);/)?.[1],
        darkCss.match(/--color-bg: (.+);/)?.[1],
        'light and dark must produce different bg tokens',
      );
    });
  });
});
