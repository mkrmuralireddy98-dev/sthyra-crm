/**
 * Intent classifier — pure function.
 */

import type { Intent } from './types.js';

interface Pattern {
 readonly intent: Intent['type'];
 readonly keywords: readonly string[];
 readonly slotExtractors: Readonly<Record<string, RegExp>>;
}

const PATTERNS: readonly Pattern[] = [
 {
 intent: 'list_issues',
 keywords: ['issue', 'issues', 'problem', 'problems', 'ticket', 'tickets'],
 slotExtractors: {
 status: /\b(open|in_progress|resolved|wont_fix)\b/,
 severity: /\b(low|medium|high|critical)\b/,
 },
 },
 {
 intent: 'list_captures',
 keywords: ['capture', 'captures', 'walk', 'walkthrough', 'site visit'],
 slotExtractors: {
 status: /\b(processing|ready|failed|archived)\b/,
 },
 },
 {
 intent: 'lookup_element',
 keywords: ['element', 'lookup', 'where is', 'what is at', 'find element'],
 slotExtractors: {
 x: /x\s*[=:]\s*(-?\d+(?:\.\d+)?)/,
 y: /y\s*[=:]\s*(-?\d+(?:\.\d+)?)/,
 z: /z\s*[=:]\s*(-?\d+(?:\.\d+)?)/,
 },
 },
 {
 intent: 'summarize_project',
 keywords: ['summary', 'summarize', 'overview', 'how is', 'how\'s', 'status of', 'progress', 'going'],
 slotExtractors: {},
 },
 {
 intent: 'find_blockers',
 keywords: ['blocker', 'blockers', 'blocking', 'blocked', 'stuck', 'preventing'],
 slotExtractors: {},
 },
];

const DEFAULT_CONFIDENCE = 0.3;

function normalize(text: string): string {
 return text.toLowerCase().trim();
}

export function classifyIntent(text: string): Intent {
 const normalized = normalize(text);
 const matches: Array<{ intent: Intent['type']; score: number }> = [];

 for (const pattern of PATTERNS) {
 let score = 0;
 for (const kw of pattern.keywords) {
 if (normalized.includes(kw.toLowerCase())) score += 1;
 }
 if (score > 0) matches.push({ intent: pattern.intent, score });
 }

 if (matches.length === 0) {
 return { type: 'clarify', slots: {}, confidence: DEFAULT_CONFIDENCE };
 }

 matches.sort((a, b) => b.score - a.score);
 const best = matches[0]!;

 const slots: Record<string, string | number> = {};
 const pattern = PATTERNS.find((p) => p.intent === best.intent)!;
 for (const [name, regex] of Object.entries(pattern.slotExtractors)) {
 const m = normalized.match(regex);
 if (m && m[1]) {
 const raw = m[1];
 const num = Number(raw);
 slots[name] = Number.isFinite(num) && raw.match(/^-?\d/) ? num : raw;
 }
 }

 const confidence = Math.min(1, best.score / 3);
 return { type: best.intent, slots, confidence };
}
