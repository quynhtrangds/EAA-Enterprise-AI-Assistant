import { OpenAILLMProvider } from './openai-llm-provider.js';

export interface LocalLLMProviderOptions {
  baseURL?: string;
  model: string;
  apiKey?: string;
}

export class LocalLLMProvider extends OpenAILLMProvider {
  constructor(options: LocalLLMProviderOptions) {
    super({
      apiKey: options.apiKey || 'local-key',
      baseURL: options.baseURL || 'http://localhost:1234/v1',
      model: options.model,
      providerName: 'local'
    });
  }
}
