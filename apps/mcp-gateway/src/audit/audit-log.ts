import { query } from '../db/pool.js';

export interface WriteAuditLogInput {
  userId: string | null;
  sessionId: string | null;
  toolName: string | null;
  input: unknown;
  output: unknown;
  status: 'success' | 'failed' | 'request-start';
  errorMessage: string | null;
  durationMs: number;
}

const SENSITIVE_KEYS = new Set([
  'apikey',
  'api_key',
  'token',
  'authtoken',
  'auth_token',
  'secret',
  'password',
  'authorization',
  'access_token',
  'id_token'
]);

export function sanitizeForLog(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeForLog);

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === '_integrationCredentials') {
      continue; // Omit credentials completely
    }
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeForLog(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export async function writeAuditLog(input: WriteAuditLogInput): Promise<void> {
  const sanitizedInput = sanitizeForLog(input.input);
  const sanitizedOutput = sanitizeForLog(input.output);

  await query(
    `
    INSERT INTO audit_logs (
      user_id,
      session_id,
      tool_name,
      input_json,
      output_json,
      status,
      error_message,
      duration_ms
    )
    VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8)
    `,
    [
      input.userId,
      input.sessionId,
      input.toolName,
      JSON.stringify(sanitizedInput ?? null),
      JSON.stringify(sanitizedOutput ?? null),
      input.status,
      input.errorMessage,
      input.durationMs
    ]
  );
}
