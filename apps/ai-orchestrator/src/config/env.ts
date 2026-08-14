import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8082),
  MCP_GATEWAY_URL: z.string().url().default('http://127.0.0.1:8081'),
  POSTGRES_HOST: z.string().default('localhost'),
  POSTGRES_PORT: z.coerce.number().int().positive().default(55432),
  POSTGRES_DB: z.string().default('enterprise_ai_demo'),
  POSTGRES_USER: z.string().default('postgres'),
  POSTGRES_PASSWORD: z.string().default('postgres'),
  LLM_PROVIDER: z.enum(['mock', 'openai', 'gemini', 'local']).default('mock'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4.1-mini'),
  OPENAI_BASE_URL: z.string().url().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.0-flash'),
  LOCAL_LLM_BASE_URL: z.string().url().optional(),
  MAX_TOOL_CALL_ROUNDS: z.coerce.number().int().min(1).max(10).default(5)
});

export const env = EnvSchema.parse(process.env);
