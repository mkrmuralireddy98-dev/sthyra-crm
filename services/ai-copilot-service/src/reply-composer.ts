/**
 * Reply composer — deterministic assembly from tool outputs.
 *
 * Per spec.md NFR-8: no external LLM. The reply is composed from
 * tool outputs using simple templates.
 */

import type { Intent, ToolCall, ToolError } from './types.js';

export interface ReplyOutput {
 readonly text: string;
 readonly toolCalls: readonly ToolCall[];
 readonly toolErrors: readonly ToolError[];
}

function toolResult<T>(calls: readonly ToolCall[], toolName: string): T | null {
 const call = calls.find((c) => c.tool === toolName);
 if (!call) return null;
 return (call.output ?? null) as T | null;
}

function pluralize(count: number, singular: string, plural: string): string {
 return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

export function composeReply(
 intent: Intent,
 toolCalls: readonly ToolCall[],
 toolErrors: readonly ToolError[],
): ReplyOutput {
 const errorNote = toolErrors.length > 0
 ? ` Note: ${toolErrors.length} tool call(s) failed.`
 : '';

 switch (intent.type) {
 case 'list_issues': {
 const result = toolResult<{ items?: unknown[]; total?: number }>(toolCalls, 'issue.list') ?? {};
 const items = result.items ?? [];
 const total = result.total ?? items.length;
 const status = intent.slots['status'];
 const severity = intent.slots['severity'];
 const filterDesc = status && severity ? `${severity} ${status}` : status ? `${status}` : severity ? `${severity}` : '';
 const text = `Found ${pluralize(total, 'issue', 'issues')}${filterDesc ? ` matching ${filterDesc}` : ''}.${errorNote}`;
 return { text, toolCalls, toolErrors };
 }

 case 'list_captures': {
 const result = toolResult<{ items?: unknown[]; total?: number }>(toolCalls, 'capture.list') ?? {};
 const items = result.items ?? [];
 const total = result.total ?? items.length;
 const text = `Found ${pluralize(total, 'capture', 'captures')} in this project.${errorNote}`;
 return { text, toolCalls, toolErrors };
 }

 case 'lookup_element': {
 const element = toolResult<{ elementId: string | null; elementName: string | null; elementType: string | null; distance: number }>(toolCalls, 'bim.lookup_element') ?? null;
 if (!element || element.elementId === null) {
 const x = intent.slots['x'] ?? '?';
 const y = intent.slots['y'] ?? '?';
 const z = intent.slots['z'] ?? '?';
 return {
 text: `No BIM element found at world point (${x}, ${y}, ${z}). The point is more than 0.5m from any element.${errorNote}`,
 toolCalls,
 toolErrors,
 };
 }
 return {
 text: `That point is inside element ${element.elementId} (${element.elementName}, ${element.elementType}). Distance from element edge: ${element.distance.toFixed(2)}m.${errorNote}`,
 toolCalls,
 toolErrors,
 };
 }

 case 'summarize_project': {
 const issues = toolResult<{ total?: number }>(toolCalls, 'issue.list') ?? {};
 const captures = toolResult<{ items?: unknown[]; total?: number }>(toolCalls, 'capture.list') ?? {};
 const deviations = toolResult<{ items?: unknown[]; total?: number }>(toolCalls, 'bim.diff_summary') ?? {};
 const text = `Project summary: ${issues.total ?? 0} issue(s), ${captures.total ?? 0} capture(s), ${deviations.total ?? 0} BIM deviation(s).${errorNote}`;
 return { text, toolCalls, toolErrors };
 }

 case 'find_blockers': {
 const blocked = toolResult<{ items?: unknown[] }>(toolCalls, 'issue.list') ?? {};
 const items = (blocked.items ?? []) as unknown[];
 const text = `Found ${items.length} blocking item(s).${errorNote}`;
 return { text, toolCalls, toolErrors };
 }

 case 'clarify': {
 return {
 text: `I didn't understand that. Try: "show open high-severity issues" or "what is at x=1.5, y=2.5, z=0.5".${errorNote}`,
 toolCalls,
 toolErrors,
 };
 }
 }
}
