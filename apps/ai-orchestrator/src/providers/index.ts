import { env } from '../config/env.js';
import type { LLMProvider } from './llm-provider.js';
import { MockLLMProvider } from './mock-llm-provider.js';
import { OpenAILLMProvider } from './openai-llm-provider.js';
import { GeminiLLMProvider } from './gemini-llm-provider.js';
import { LocalLLMProvider } from './local-llm-provider.js';

export * from './llm-provider.js';
export * from './mock-llm-provider.js';
export * from './openai-llm-provider.js';
export * from './gemini-llm-provider.js';
export * from './local-llm-provider.js';

export function createLLMProvider(providerType?: string): LLMProvider {
  const provider = providerType || env.LLM_PROVIDER;

  switch (provider) {
    case 'gemini':
      return new GeminiLLMProvider({
        apiKey: env.GEMINI_API_KEY || env.OPENAI_API_KEY,
        model: env.GEMINI_MODEL || 'gemini-2.0-flash'
      });

    case 'openai':
      return new OpenAILLMProvider({
        apiKey: env.OPENAI_API_KEY,
        baseURL: env.OPENAI_BASE_URL,
        model: env.OPENAI_MODEL || 'gpt-4.1-mini'
      });

    case 'local':
      return new LocalLLMProvider({
        apiKey: env.OPENAI_API_KEY || 'local-key',
        baseURL: env.LOCAL_LLM_BASE_URL,
        model: env.OPENAI_MODEL || 'local-model'
      });

    case 'mock':
    default:
      return new MockLLMProvider();
  }
}
