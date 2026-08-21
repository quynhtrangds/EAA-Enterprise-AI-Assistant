import type { ProbeStep, ProbeContext, StepResult } from '../probe-step.js';
import tls from 'node:tls';
import { mapNetworkError } from '../errors.js';

export class TlsProbe implements ProbeStep {
  readonly name = 'tls';

  appliesTo(ctx: ProbeContext): boolean {
    return ctx.strategy.kind === 'remote' && Boolean(ctx.apiUrl);
  }

  async run(ctx: ProbeContext): Promise<StepResult> {
    const started = Date.now();
    const url = ctx.apiUrl!;

    if (url.protocol !== 'https:') {
      return {
        step: this.name,
        status: 'passed',
        latencyMs: Date.now() - started,
        detail: {
          protocol: 'http (không mã hóa SSL/TLS)',
          warning: 'API URL đang dùng giao thức HTTP thường không mã hóa bảo mật.'
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
