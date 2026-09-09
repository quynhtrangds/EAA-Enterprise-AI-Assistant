import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  testSaved: vi.fn(),
  dispatchHealthEvent: vi.fn()
}));

vi.mock('../../db/pool.js', () => ({ query: mocks.query }));
vi.mock('../integration-test/integration-test.service.js', () => ({
  IntegrationTestService: { testSaved: mocks.testSaved }
}));
vi.mock('./notifiers.js', () => ({ dispatchHealthEvent: mocks.dispatchHealthEvent }));

import { runHealthCheckTick } from './scheduler.js';

describe('runHealthCheckTick — health-check scheduler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('thực hiện query giới hạn 50 integrations và ưu tiên last_tested_at ASC NULLS FIRST', async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [
        { tenant_id: 't-1', integration_code: 'gitea', last_test_status: 'passed' }
      ]
    });
    mocks.testSaved.mockResolvedValueOnce({
      overallStatus: 'passed',
      steps: []
    });

    await runHealthCheckTick();

    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY last_tested_at ASC NULLS FIRST, tenant_id, integration_code')
    );
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining('LIMIT 50')
    );

    expect(mocks.testSaved).toHaveBeenCalledWith('t-1', 'gitea', 'health-check', { skipAudit: true });
  });

  it('không làm gián đoạn toàn bộ batch khi 1 integration bị lỗi kết nối', async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [
        { tenant_id: 't-1', integration_code: 'gitea', last_test_status: 'passed' },
        { tenant_id: 't-1', integration_code: 'erpnext', last_test_status: 'passed' }
      ]
    });

    mocks.testSaved.mockRejectedValueOnce(new Error('Network unreachable'));
    mocks.testSaved.mockResolvedValueOnce({
      overallStatus: 'passed',
      steps: []
    });

    await runHealthCheckTick();

    expect(mocks.testSaved).toHaveBeenCalledTimes(2);
  });
});
