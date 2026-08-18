import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8082),
  MCP_GATEWAY_URL: z.string().url().default('http://127.0.0.1:8081'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  POSTGRES_HOST: z.string().default('localhost'),
  POSTGRES_PORT: z.coerce.number().int().positive().default(55432),
  POSTGRES_DB: z.string().default('enterprise_ai_demo'),
  POSTGRES_USER: z.string().default('postgres'),
  POSTGRES_PASSWORD: z.string().default('postgres'),
  LLM_PROVIDER: z.enum(['openai', 'local', 'gemini', 'anthropic']).default('local'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4.1-mini'),
  LOCAL_LLM_BASE_URL: z.string().url().optional(),
  MAX_TOOL_CALL_ROUNDS: z.coerce.number().int().min(1).max(10).default(5)
});

export const env = EnvSchema.parse(process.env);
