import type { ProbeContext, StepResult } from '../probe-step.js';
import type { ProbeError } from '../errors.js';
import { GiteaStrategy } from './gitea.strategy.js';
import { ErpNextStrategy } from './erpnext.strategy.js';
import { ZammadStrategy } from './zammad.strategy.js';
import { CrmStrategy } from './crm.strategy.js';
import { RagStrategy } from './rag.strategy.js';
import { PostgresStrategy } from './postgres.strategy.js';

export interface TestRequestSpec {
  method: 'GET' | 'POST' | 'HEAD';
  path: string;
  headers: Record<string, string>;
  body?: string;
}

export interface IntegrationTestStrategy {
  readonly code: string;
  /** Loại mặc định. Connector lai (vd RAG) nên đặt 'internal' và override isRemote(). */
  readonly kind: 'remote' | 'internal';
  readonly defaultPort?: number;
  /**
   * Quyết định tại thời điểm chạy: connector có gọi API bên ngoài theo cấu hình
   * hiện tại không? Dùng cho connector lai — vd CRM/RAG có apiUrl thì test như
   * dịch vụ remote, không có thì chỉ kiểm tra MCP server nội bộ.
   * Không override → suy ra từ kind.
   */
  isRemote?(ctx: ProbeContext): boolean;
  buildTestRequest(ctx: ProbeContext): TestRequestSpec;
  validateResponse(status: number, body: unknown): string | null;
  interpretAuthFailure(statusCode: number): ProbeError;
  runInternalProbe?(ctx: ProbeContext): Promise<StepResult>;
}

/**
 * Nguồn sự thật duy nhất để probe quyết định có chạy các bước mạng hay không.
 */
export function isRemoteStrategy(strategy: IntegrationTestStrategy, ctx: ProbeContext): boolean {
  if (strategy.isRemote) return strategy.isRemote(ctx);
  return strategy.kind === 'remote';
}

const strategyRegistry = new Map<string, IntegrationTestStrategy>();

// Register default strategies
const defaultStrategies: IntegrationTestStrategy[] = [
  new GiteaStrategy(),
  new ErpNextStrategy(),
  new ZammadStrategy(),
  new CrmStrategy(),
  new RagStrategy(),
  new PostgresStrategy()
];

for (const strat of defaultStrategies) {
  strategyRegistry.set(strat.code.toLowerCase(), strat);
}

export function getStrategy(integrationCode: string): IntegrationTestStrategy {
  const code = (integrationCode || '').toLowerCase().trim();
  const strategy = strategyRegistry.get(code);
  if (!strategy) {
    // Default fallback strategy for custom/generic HTTP services
    return {
      code,
      kind: 'remote',
      buildTestRequest(ctx: ProbeContext): TestRequestSpec {
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (ctx.apiKey) {
          headers.Authorization = ctx.apiKey.startsWith('Bearer ') || ctx.apiKey.startsWith('token ')
            ? ctx.apiKey
            : `Bearer ${ctx.apiKey}`;
        }
        return { method: 'GET', path: '/', headers };
      },
      validateResponse(_status: number, _body: unknown): string | null {
        return null;
      },
      interpretAuthFailure(statusCode: number): ProbeError {
        return {
          code: statusCode === 401 ? 'AUTH_INVALID_CREDENTIALS' : 'AUTH_FORBIDDEN',
          message: `Dịch vụ trả về mã lỗi xác thực HTTP ${statusCode}`,
          hint: 'Kiểm tra lại API Key/Token và phạm vi quyền (scopes) được cấp cho token.'
        };
      }
    };
  }
  return strategy;
}
