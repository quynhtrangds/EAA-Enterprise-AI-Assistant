import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8081),
  POSTGRES_HOST: z.string().default('localhost'),
  POSTGRES_PORT: z.coerce.number().int().positive().default(55432),
  POSTGRES_DB: z.string().default('enterprise_ai_demo'),
  POSTGRES_USER: z.string().default('postgres'),
  POSTGRES_PASSWORD: z.string().default('postgres'),
  TOOL_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  GOOGLE_CLIENT_ID: z.string().optional(),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  VAULT_ADDR: z.string().default('http://vault:8200'),
  VAULT_TOKEN: z.string().default('root')
});

export const env = EnvSchema.parse(process.env);
