/**
 * Sthyra CRM AI Copilot — domain types.
 */

export const MESSAGE_ROLES = ['user', 'assistant'] as const;
export type MessageRole = (typeof MESSAGE_ROLES)[number];

export const INTENTS = ['list_captures', 'list_issues', 'lookup_element', 'summarize_project', 'find_blockers', 'clarify'] as const;
export type IntentType = (typeof INTENTS)[number];

export const TOOL_NAMES = ['capture.list', 'capture.by_id', 'issue.list', 'issue.by_id', 'bim.lookup_element', 'bim.diff_summary'] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

export const CONVERSATION_STATES = ['active', 'archived'] as const;
export type ConversationState = (typeof CONVERSATION_STATES)[number];

export interface Conversation {
 readonly id: string;
 readonly orgId: string;
 readonly userId: string;
 readonly title: string;
 readonly state: ConversationState;
 readonly createdAt: Date;
 readonly archivedAt: Date | null;
}

export interface ToolCall {
 readonly tool: ToolName;
 readonly input: Record<string, unknown>;
 readonly output: unknown;
}

export interface ToolError {
 readonly tool: ToolName;
 readonly error: string;
}

export interface Intent {
 readonly type: IntentType;
 readonly slots: Record<string, string | number>;
 readonly confidence: number;
}

export interface Message {
 readonly id: string;
 readonly orgId: string;
 readonly conversationId: string;
 readonly userId: string;
 readonly role: MessageRole;
 readonly text: string;
 readonly intent: Intent | null;
 readonly toolCalls: readonly ToolCall[];
 readonly toolErrors: readonly ToolError[];
 readonly pinned: boolean;
 readonly pinnedAt: Date | null;
 readonly createdAt: Date;
}

export interface CreateMessageInput {
 readonly conversationId: string;
 readonly userId: string;
 readonly role: MessageRole;
 readonly text: string;
 readonly intent?: Intent | null;
 readonly toolCalls?: readonly ToolCall[];
 readonly toolErrors?: readonly ToolError[];
}

export interface CreateConversationInput {
 readonly orgId: string;
 readonly userId: string;
 readonly title: string;
}

export interface PaginationCursor {
 readonly createdAt: string;
 readonly id: string;
 readonly dir: 'next' | 'prev';
}
