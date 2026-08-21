import type { ProbeStep, ProbeContext, StepResult } from '../probe-step.js';
import net from 'node:net';
import { mapNetworkError } from '../errors.js';

export class TcpProbe implements ProbeStep {
  readonly name = 'tcp';

  appliesTo(ctx: ProbeContext): boolean {
    return ctx.strategy.kind === 'remote' && Boolean(ctx.apiUrl);
  }

  async run(ctx: ProbeContext): Promise<StepResult> {
    const started = Date.now();
    const url = ctx.apiUrl!;
    const port = url.port ? parseInt(url.port, 10) : (url.protocol === 'https:' ? 443 : 80);
    const host = ctx.resolvedIp || url.hostname;

    return new Promise<StepResult>((resolve) => {
      const socket = new net.Socket();
      let isResolved = false;

      const finish = (result: StepResult) => {
        if (!isResolved) {
          isResolved = true;
          socket.destroy();
          resolve(result);
        }
      };

      socket.setTimeout(5000);

      socket.on('connect', () => {
        finish({
          step: this.name,
          status: 'passed',
          latencyMs: Date.now() - started,
          detail: {
            host,
            port,
            protocol: 'TCP'
          }
        });
      });

      socket.on('timeout', () => {
        finish({
          step: this.name,
          status: 'failed',
          latencyMs: Date.now() - started,
          error: {
            code: 'TCP_TIMEOUT',
            message: `Hết thời gian chờ kết nối cổng TCP ${port} sau 5s`,
            hint: 'Kiểm tra xem cổng dịch vụ đích có bị tường lửa (Firewall/Security Group) chặn không.'
          }
        });
      });

      socket.on('error', (err: any) => {
        finish(mapNetworkError(this.name, err, Date.now() - started));
      });

      socket.connect(port, host);
    });
  }
}
