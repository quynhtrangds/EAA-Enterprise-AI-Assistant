export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_call_id?: string;
}

export interface LLMToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface LLMToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface LLMCompletionResult {
  content: string | null;
  toolCalls: LLMToolCall[];
}

export interface LLMProvider {
  generateCompletion(
    messages: LLMMessage[],
    tools: LLMToolDefinition[]
  ): Promise<LLMCompletionResult>;
}
