import { query } from '../db/pool.js';

export interface WriteAuditLogInput {
  userId: string | null;
  sessionId: string | null;
  toolName: string | null;
  input: unknown;
  output: unknown;
  status: 'success' | 'failed';
  errorMessage: string | null;
  durationMs: number;
}

export async function writeAuditLog(input: WriteAuditLogInput): Promise<void> {
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
      JSON.stringify(input.input ?? null),
      JSON.stringify(input.output ?? null),
      input.status,
      input.errorMessage,
      input.durationMs
    ]
  );
}
