/**
 * Closeout report — pure function.
 */

import type { Issue, CloseoutReport } from './types.js';

function countBy<T>(items: readonly T[], key: (item: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const k = key(item);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

function averageHours(items: readonly Issue[]): number {
  const resolved = items.filter((i) => i.resolvedAt !== null);
  if (resolved.length === 0) return 0;
  const totalMs = resolved.reduce((sum, i) => {
    const r = i.resolvedAt!.getTime();
    const c = i.createdAt.getTime();
    return sum + Math.max(0, r - c);
  }, 0);
  return Math.round((totalMs / resolved.length / 3600000) * 1000) / 1000;
}

export function computeCloseoutReport(items: readonly Issue[]): CloseoutReport {
  const byStatus = countBy(items, (i) => i.status);
  const byTrade = countBy(
    items.filter((i) => i.punchData !== null),
    (i) => i.punchData!.trade,
  );
  const total = items.length;
  const closed = byStatus['closed'] ?? 0;
  const completionPct = total === 0 ? 100 : Math.round((closed / total) * 100);
  return {
 total,
 byStatus,
 byTrade,
 completionPct,
 averageResolutionHours: averageHours(items),
 };
}
