import { OpenAILLMProvider } from './openai-llm-provider.js';
import { AppError } from '../errors/app-error.js';

export interface GeminiProviderOptions {
  apiKey?: string;
  model: string;
}

export class GeminiLLMProvider extends OpenAILLMProvider {
  constructor(options: GeminiProviderOptions) {
    if (!options.apiKey) {
      throw new AppError('LLM_ERROR', 'GEMINI_API_KEY hoặc OPENAI_API_KEY là bắt buộc khi LLM_PROVIDER=gemini.', 500);
    }

    super({
      apiKey: options.apiKey,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      model: options.model,
      providerName: 'gemini'
    });
  }
}
