import OpenAI from 'openai';
import type { LLMCompletionResult, LLMMessage, LLMProvider, LLMToolDefinition } from './llm-provider.js';
import { AppError } from '../errors/app-error.js';

export interface OpenAIProviderOptions {
  apiKey?: string;
  baseURL?: string;
  model: string;
  providerName?: string;
}

export class OpenAILLMProvider implements LLMProvider {
  protected client: OpenAI;
  protected model: string;
  protected providerName: string;

  constructor(options: OpenAIProviderOptions) {
    this.model = options.model;
    this.providerName = options.providerName ?? 'openai';

    if (!options.apiKey && this.providerName === 'openai') {
      throw new AppError('LLM_ERROR', 'OPENAI_API_KEY is required when LLM_PROVIDER=openai.', 500);
    }

    this.client = new OpenAI({
      apiKey: options.apiKey || 'dummy-key',
      ...(options.baseURL ? { baseURL: options.baseURL } : {})
    });
  }

  async generateCompletion(
    messages: LLMMessage[],
    tools: LLMToolDefinition[]
  ): Promise<LLMCompletionResult> {
    const formattedMessages = messages.map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'tool' as const,
          tool_call_id: m.tool_call_id || 'call_0',
          content: m.content || ''
        };
      }
      if (m.role === 'assistant') {
        return {
          role: 'assistant' as const,
          content: m.content || null
        };
      }
      if (m.role === 'system') {
        return {
          role: 'system' as const,
          content: m.content || ''
        };
      }
      return {
        role: 'user' as const,
        content: m.content || ''
      };
    });

    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: formattedMessages,
      ...(tools.length > 0 ? { tools, tool_choice: 'auto' as const } : {})
    });

    const choice = completion.choices[0];
    if (!choice?.message) {
      throw new AppError('LLM_ERROR', `${this.providerName} did not return a valid message.`, 502);
    }

    const rawToolCalls = choice.message.tool_calls || [];
    const toolCalls = rawToolCalls
      .filter((tc) => tc.type === 'function')
      .map((tc) => {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments || '{}');
        } catch {
          args = {};
        }
        return {
          id: tc.id,
          name: tc.function.name,
          arguments: args
        };
      });

    return {
      content: choice.message.content,
      toolCalls
    };
  }
}
