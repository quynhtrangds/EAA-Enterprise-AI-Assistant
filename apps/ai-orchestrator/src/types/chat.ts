export interface PlannedToolCall {
  toolName: string;
  arguments: Record<string, unknown>;
}

export interface ToolCallTrace extends PlannedToolCall {
  success: boolean;
  durationMs?: number;
  data?: unknown;
  errorCode?: string;
  message?: string;
}

export interface ChatInput {
  sessionId: string;
  message: string;
  authToken: string;
  userId?: string;
  tenantId?: string;
}

export interface ChatOutput {
  sessionId: string;
  answer: string;
  toolCalls: ToolCallTrace[];
}
