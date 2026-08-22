import type { ProbeStep, ProbeContext, StepResult } from '../probe-step.js';
import dns from 'node:dns/promises';
import { mapNetworkError } from '../errors.js';
import { isRemoteStrategy } from '../strategies/strategy.js';

export class DnsProbe implements ProbeStep {
  readonly name = 'dns';

  appliesTo(ctx: ProbeContext): boolean {
    return isRemoteStrategy(ctx.strategy, ctx) && Boolean(ctx.apiUrl);
  }

  async run(ctx: ProbeContext): Promise<StepResult> {
    const started = Date.now();
    const hostname = ctx.apiUrl!.hostname;

    try {
      // Check if hostname is already an IP address
      if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.includes(':')) {
        ctx.resolvedIp = hostname;
        return {
          step: this.name,
          status: 'passed',
          latencyMs: Date.now() - started,
          detail: {
            hostname,
            ip: hostname,
            type: 'direct_ip'
          }
        };
      }

      const lookupRes = await dns.lookup(hostname, { all: true });
      if (!lookupRes || lookupRes.length === 0) {
        return {
          step: this.name,
          status: 'failed',
          latencyMs: Date.now() - started,
          error: {
            code: 'DNS_FAILURE',
            message: `Không tìm thấy bản ghi DNS cho hostname: ${hostname}`,
            hint: 'Kiểm tra lại chính tả tên miền hoặc cấu hình DNS trong hệ thống.'
          }
        };
      }

      const primary = lookupRes[0]; if (primary) { ctx.resolvedIp = primary.address; }

      return {
        step: this.name,
        status: 'passed',
        latencyMs: Date.now() - started,
        detail: {
          hostname,
          resolvedIps: lookupRes.map((r) => r.address),
          primaryIp: ctx.resolvedIp
        }
      };
    } catch (err) {
      return mapNetworkError(this.name, err, Date.now() - started);
    }
  }
}
