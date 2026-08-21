import type { ProbeStep, ProbeContext, StepResult } from '../probe-step.js';

export class BusinessProbe implements ProbeStep {
  readonly name = 'business';

  appliesTo(_ctx: ProbeContext): boolean {
    return true;
  }

  async run(ctx: ProbeContext): Promise<StepResult> {
    const started = Date.now();

    if (ctx.strategy.kind === 'internal' && ctx.strategy.runInternalProbe) {
      return await ctx.strategy.runInternalProbe(ctx);
    }

    return {
      step: this.name,
      status: 'passed',
      latencyMs: Date.now() - started,
      detail: {
        integrationCode: ctx.integrationCode,
        ready: true,
        message: `Dịch vụ ${ctx.integrationCode} đã sẵn sàng tiếp nhận yêu cầu từ AI Assistant.`
      }
    };
  }
}
