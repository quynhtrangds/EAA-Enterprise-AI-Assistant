import type { PlannedToolCall } from '../types/chat.js';

export interface LLMProvider {
  planToolCall(message: string): PlannedToolCall | null;
  buildAnswer(message: string, toolCall: PlannedToolCall | null, toolResult: unknown): string;
}
