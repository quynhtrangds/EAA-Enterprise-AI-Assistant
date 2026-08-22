import type { IntegrationTestStrategy, TestRequestSpec } from './strategy.js';
import type { ProbeContext, StepResult } from '../probe-step.js';
import type { ProbeError } from '../errors.js';
import { query } from '../../../db/pool.js';

export class PostgresStrategy implements IntegrationTestStrategy {
  readonly code = 'postgres' as const;
  readonly kind = 'internal' as const;

  buildTestRequest(_ctx: ProbeContext): TestRequestSpec {
    return { method: 'GET', path: '/', headers: {} };
  }

  validateResponse(_status: number, _body: unknown): string | null {
    return null;
  }

  interpretAuthFailure(_statusCode: number): ProbeError {
    return {
      code: 'DB_AUTH_ERROR',
      message: 'Lỗi xác thực cơ sở dữ liệu PostgreSQL',
      hint: 'Kiểm tra biến môi trường POSTGRES_USER và POSTGRES_PASSWORD.'
    };
  }

  async runInternalProbe(_ctx: ProbeContext): Promise<StepResult> {
    const started = Date.now();
    try {
      const res = await query('SELECT 1 as ping');
      return {
        step: 'business',
        status: 'passed',
        latencyMs: Date.now() - started,
        detail: {
          database: 'PostgreSQL Core',
          status: 'connected',
          ping: res.rows[0]?.ping === 1
        }
      };
    } catch (err: any) {
      return {
        step: 'business',
        status: 'failed',
        latencyMs: Date.now() - started,
        error: {
          code: 'DB_CONNECTION_FAILED',
          message: err?.message || 'Không thể kết nối cơ sở dữ liệu PostgreSQL',
          hint: 'Kiểm tra container PostgreSQL và thông số kết nối DB trong gateway.'
        }
      };
    }
  }
}
