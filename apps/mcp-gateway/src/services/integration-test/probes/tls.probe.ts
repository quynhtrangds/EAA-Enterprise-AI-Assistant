import type { ProbeStep, ProbeContext, StepResult } from '../probe-step.js';
import tls from 'node:tls';
import { mapNetworkError } from '../errors.js';
import { isRemoteStrategy } from '../strategies/strategy.js';
import { isPrivateOrRestrictedIP } from '../../../policies/url-validator.js';

/**
 * Host "nội bộ" = tên service Docker (không có dấu chấm), localhost,
 * *.docker.internal, *.local/*.internal, hoặc IP private.
 * HTTP tới host nội bộ là bình thường trong môi trường Docker — không cảnh báo.
 */
function isInternalHost(hostname: string): boolean {
  const h = (hostname || '').toLowerCase();
  if (!h.includes('.')) return true;
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (h === 'host.docker.internal' || h.endsWith('.docker.internal')) return true;
  if (h.endsWith('.local') || h.endsWith('.internal')) return true;
  return isPrivateOrRestrictedIP(h);
}

export class TlsProbe implements ProbeStep {
  readonly name = 'tls';

  appliesTo(ctx: ProbeContext): boolean {
    return isRemoteStrategy(ctx.strategy, ctx) && Boolean(ctx.apiUrl);
  }

  async run(ctx: ProbeContext): Promise<StepResult> {
    const started = Date.now();
    const url = ctx.apiUrl!;

    if (url.protocol !== 'https:') {
      // HTTP tới host NỘI BỘ (service Docker, host.docker.internal, IP private)
      // là bình thường — không warning. HTTP tới host BÊN NGOÀI mới cảnh báo,
      // vì dữ liệu đi qua mạng không mã hóa.
      const internal = isInternalHost(url.hostname);
      return {
        step: this.name,
        status: 'passed',
        latencyMs: Date.now() - started,
        detail: {
          protocol: 'http (không mã hóa SSL/TLS)',
          host_scope: internal ? 'internal' : 'external',
          ...(internal ? {} : {
            warning: 'API URL dùng HTTP không mã hóa tới host BÊN NGOÀI — nên chuyển sang HTTPS để bảo vệ dữ liệu.'
          })
        }
      };
    }

    const port = url.port ? parseInt(url.port, 10) : 443;
    const host = url.hostname;

    return new Promise<StepResult>((resolve) => {
      let isResolved = false;

      const finish = (result: StepResult) => {
        if (!isResolved) {
          isResolved = true;
          socket.destroy();
          resolve(result);
        }
      };

      const socket = tls.connect(
        {
          host,
          port,
          servername: host,
          timeout: 5000
        },
        () => {
          const cert = socket.getPeerCertificate();
          const validTo = cert?.valid_to ? new Date(cert.valid_to).toISOString() : undefined;
          const issuer = cert?.issuer ? (cert.issuer.O || cert.issuer.CN || 'Unknown') : undefined;

          finish({
            step: this.name,
            status: 'passed',
            latencyMs: Date.now() - started,
            detail: {
              protocol: socket.getProtocol(),
              cipher: socket.getCipher()?.name,
              certIssuer: issuer,
              certValidTo: validTo
            }
          });
        }
      );

      socket.on('timeout', () => {
        finish({
          step: this.name,
          status: 'failed',
          latencyMs: Date.now() - started,
          error: {
            code: 'TLS_TIMEOUT',
            message: 'Hết thời gian chờ bắt tay bảo mật TLS (Timeout 5s)',
            hint: 'Kiểm tra xem máy chủ đích có hỗ trợ giao thức HTTPS/TLS trên cổng này không.'
          }
        });
      });

      socket.on('error', (err: any) => {
        finish(mapNetworkError(this.name, err, Date.now() - started));
      });
    });
  }
}
