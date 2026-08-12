/**
 * Sthyra CRM design tokens — the single source of truth for the visual system.
 * Resolved colors per Appendix L.1: teal + amber (PPE-aware palette).
 * Resolution: NEVER use safety-orange / cyan + copper as primary on real sites.
 */

export type ColorMode = 'light' | 'dark' | 'high-contrast';

export interface SemanticColor {
  readonly bg: string;
  readonly surface: string;
  readonly surfaceRaised: string;
  readonly surfaceSunken: string;
  readonly fg: string;
  readonly fgMuted: string;
  readonly fgSubtle: string;
  readonly border: string;
  readonly borderStrong: string;
  readonly accent: string;
  readonly accentFg: string;
  readonly positive: string;
  readonly warning: string;
  readonly critical: string;
  readonly info: string;
  readonly focus: string;
}

export interface BrandColor {
  /** teal — primary brand, safe, "go" */
  readonly signal50: string;
  readonly signal100: string;
  readonly signal300: string;
  readonly signal500: string;
  readonly signal600: string;
  readonly signal700: string;
  readonly signal900: string;
  /** amber — WARNING ONLY. Never used as primary action. */
  readonly amber400: string;
  readonly amber500: string;
  readonly amber600: string;
}

export interface PrimitiveScale {
  readonly 25: string;
  readonly 50: string;
  readonly 100: string;
  readonly 200: string;
  readonly 300: string;
  readonly 400: string;
  readonly 500: string;
  readonly 600: string;
  readonly 700: string;
  readonly 800: string;
  readonly 850: string;
  readonly 900: string;
  readonly 950: string;
  readonly 1000: string;
}

export interface SemanticTokens {
  readonly color: SemanticColor;
  readonly space: Readonly<Record<0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16 | 20 | 24 | 32 | 40 | 48 | 64 | 80, string>>;
  readonly radius: Readonly<Record<'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full', string>>;
  readonly spacingUnit: string;
  readonly type: TypeTokens;
  readonly motion: MotionTokens;
  readonly shadow: Readonly<Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', string>>;
}

export interface TypeTokens {
  readonly fontFamily: { readonly ui: string; readonly mono: string; readonly display: string };
  readonly fontSize: Readonly<Record<'xs' | 'sm' | 'base' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl', string>>;
  readonly lineHeight: Readonly<Record<'tight' | 'snug' | 'normal' | 'relaxed', string>>;
  readonly fontWeight: Readonly<Record<'regular' | 'medium' | 'semibold' | 'bold', string>>;
  readonly tracking: Readonly<Record<'tight' | 'normal' | 'wide', string>>;
}

export interface MotionTokens {
  readonly duration: Readonly<Record<'instant' | 'fast' | 'base' | 'slow' | 'slower', string>>;
  readonly ease: Readonly<Record<'standard' | 'decelerate' | 'accelerate' | 'spring', string>>;
}

export const brand: BrandColor = {
  signal50:  '#E6FBF5',
  signal100: '#C2F4E5',
  signal300: '#4FDDB6',
  signal500: '#00B894',
  signal600: '#00A081',
  signal700: '#017B62',
  signal900: '#003E31',
  amber400:  '#F5B544',
  amber500:  '#F5A524',
  amber600:  '#D58806',
} as const;

const gray: PrimitiveScale = {
  25:   '#FAFBFC',
  50:   '#F4F6F8',
  100:  '#E7EAEE',
  200:  '#D4D9E0',
  300:  '#B6BCC6',
  400:  '#8A93A1',
  500:  '#6A7382',
  600:  '#4F5764',
  700:  '#3A4150',
  800:  '#262C36',
  850:  '#1F242C', // dark-mode "raised" surface
  900:  '#161A22',
  950:  '#0A0D13',
  1000: '#05070A',
} as const;

const semanticByMode: Readonly<Record<ColorMode, SemanticColor>> = {
  light: {
    bg:             gray[25],
    surface:        '#FFFFFF',
    surfaceRaised:  gray[50],
    surfaceSunken:  gray[100],
    fg:             gray[950],
    fgMuted:        gray[600],
    fgSubtle:       gray[500],
    border:         gray[200],
    borderStrong:   gray[300],
    accent:         brand.signal500,
    accentFg:       '#FFFFFF',
    positive:       '#10B981',
    warning:        brand.amber500,
    critical:       '#EF4444',
    info:           '#0EA5E9',
    focus:          brand.signal500,
  },
  dark: {
    bg:             gray[950],
    surface:        gray[900],
    surfaceRaised:  gray[850] ?? gray[800],
    surfaceSunken:  gray[1000],
    fg:             gray[25],
    fgMuted:        gray[300],
    fgSubtle:       gray[400],
    border:         gray[800],
    borderStrong:   gray[700],
    accent:         brand.signal300,
    accentFg:       gray[1000],
    positive:       '#34D399',
    warning:        brand.amber400,
    critical:       '#F87171',
    info:           '#60A5FA',
    focus:          brand.signal300,
  },
  'high-contrast': {
    bg:             '#000000',
    surface:        '#000000',
    surfaceRaised:  '#0A0A0A',
    surfaceSunken:  '#000000',
    fg:             '#FFFFFF',
    fgMuted:        '#FFFFFF',
    fgSubtle:       '#E5E5E5',
    border:         '#FFFFFF',
    borderStrong:   '#FFFFFF',
    accent:         brand.signal300,
    accentFg:       '#000000',
    positive:       '#5EEAD4',
    warning:        brand.amber400,
    critical:       '#FCA5A5',
    info:           '#7DD3FC',
    focus:          '#FFFFFF',
  },
} as const;

const space: SemanticTokens['space'] = {
  0:  '0px',
  1:  '4px',
  2:  '8px',
  3:  '12px',
  4:  '16px',
  5:  '20px',
  6:  '24px',
  8:  '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
  24: '96px',
  32: '128px',
  40: '160px',
  48: '192px',
  64: '256px',
  80: '320px',
};

const radius: SemanticTokens['radius'] = {
  xs: '4px',
  sm: '6px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '24px',
  full: '9999px',
};

const type: TypeTokens = {
  fontFamily: {
    ui:      'Geist, Inter, system-ui, -apple-system, sans-serif',
    mono:    'JetBrains Mono, ui-monospace, SFMono-Regular, monospace',
    display: 'Geist, Inter, system-ui, sans-serif',
  },
  fontSize: {
    xs:   '12px',
    sm:   '13px',
    base: '14px',
    md:   '15px',
    lg:   '17px',
    xl:   '20px',
    '2xl':'24px',
    '3xl':'30px',
    '4xl':'38px',
    '5xl':'48px',
  },
  lineHeight: {
    tight:   '1.15',
    snug:    '1.3',
    normal:  '1.5',
    relaxed: '1.65',
  },
  fontWeight: {
    regular:  '400',
    medium:   '500',
    semibold: '600',
    bold:     '700',
  },
  tracking: {
    tight:  '-0.011em',
    normal: '0',
    wide:   '0.04em',
  },
};

const motion: MotionTokens = {
  duration: {
    instant: '60ms',
    fast:    '120ms',
    base:    '180ms',
    slow:    '280ms',
    slower:  '420ms',
  },
  ease: {
    standard:    'cubic-bezier(0.2, 0, 0, 1)',
    decelerate:  'cubic-bezier(0, 0, 0, 1)',
    accelerate:  'cubic-bezier(0.3, 0, 1, 1)',
    spring:      'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
};

const shadow: SemanticTokens['shadow'] = {
  xs: '0 1px 2px rgba(8,10,12,0.04)',
  sm: '0 1px 2px rgba(8,10,12,0.06), 0 1px 1px rgba(8,10,12,0.04)',
  md: '0 4px 12px rgba(8,10,12,0.08), 0 1px 2px rgba(8,10,12,0.04)',
  lg: '0 12px 32px rgba(8,10,12,0.12), 0 2px 6px rgba(8,10,12,0.06)',
  xl: '0 24px 64px rgba(8,10,12,0.16), 0 4px 12px rgba(8,10,12,0.08)',
};

/** Resolve a full token bundle for a given color mode. */
export function tokensFor(mode: ColorMode): SemanticTokens {
  return {
    color: semanticByMode[mode],
    space,
    radius,
    spacingUnit: '4px',
    type,
    motion,
    shadow,
  };
}

/** Default tokens (dark mode — product default per master plan §4). */
export const tokens: SemanticTokens = tokensFor('dark');

/** Convenience: CSS custom-properties block for direct injection. */
export function toCssVariables(mode: ColorMode = 'dark'): string {
  const t = tokensFor(mode);
  const lines: string[] = [':root {'];
  for (const [k, v] of Object.entries(t.color))        lines.push(`  --color-${k}: ${v};`);
  for (const [k, v] of Object.entries(t.space))        lines.push(`  --space-${k}: ${v};`);
  for (const [k, v] of Object.entries(t.radius))       lines.push(`  --radius-${k}: ${v};`);
  for (const [k, v] of Object.entries(t.type.fontSize))  lines.push(`  --text-${k}: ${v};`);
  for (const [k, v] of Object.entries(t.motion.duration)) lines.push(`  --dur-${k}: ${v};`);
  for (const [k, v] of Object.entries(t.motion.ease))     lines.push(`  --ease-${k}: ${v};`);
  for (const [k, v] of Object.entries(t.shadow))           lines.push(`  --shadow-${k}: ${v};`);
  lines.push('}');
  return lines.join('\n');
}
