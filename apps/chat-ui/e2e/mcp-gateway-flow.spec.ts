import { test, expect } from '@playwright/test';
import { Client } from 'pg';

const dbConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '55432', 10),
  database: process.env.POSTGRES_DB || 'enterprise_ai_demo',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
};

test.describe('MCP Gateway Flow Sequence E2E', () => {
  let dbClient: Client;

  test.beforeAll(async () => {
    dbClient = new Client(dbConfig);
    await dbClient.connect();
  });

  test.afterAll(async () => {
    await dbClient.end();
  });

  test('TC1: Xác minh luồng thành công và Audit Log', async ({ page }) => {
    // 1. [UI] Login
    await page.goto('/login');
    await page.fill('input[placeholder="Nhập tên đăng nhập"]', 'admin');
    await page.fill('input[placeholder="Nhập mật khẩu"]', 'admin123'); // seed.sql uses this usually? Or let's just bypass if it's admin
    await page.click('button:has-text("Đăng nhập")');
    // Wait for the new chat button to appear instead of URL change
    await page.waitForSelector('button:has-text("Cuộc trò chuyện mới")');

    // 2. [UI] Create a new session and ask a question
    await page.click('button:has-text("Cuộc trò chuyện mới")', { timeout: 10000 }).catch(() => {}); // might not be needed if already on new chat
    await page.fill('input[placeholder="Nhập câu hỏi..."]', 'Khách hàng Nguyễn Văn A có những đơn hàng nào?');
    await page.click('button[type="submit"]');

    // 3. [UI Assert] Wait for AI response
    // The response should contain some order information
    await expect(page.locator('.prose').last()).toContainText('đơn hàng', { timeout: 30000 });

    // 4. [Database Assert] Query audit_logs
    const query = `
      SELECT * FROM audit_logs 
      WHERE tool_name = 'get_customer_orders'
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    // Wait a bit for db insert
    await page.waitForTimeout(2000);
    const res = await dbClient.query(query);
    
    expect(res.rows.length).toBeGreaterThan(0);
    const log = res.rows[0];
    expect(log.status).toBe('success');
    
    // Verify 90 days rule (from date and to date exist in cleanInput)
    const inputJson = log.input_json;
    expect(inputJson).toHaveProperty('fromDate');
    expect(inputJson).toHaveProperty('toDate');
    
    // Ensure fromDate is roughly 90 days ago
    const fromDate = new Date(inputJson.fromDate);
    const toDate = new Date(inputJson.toDate);
    const diffTime = Math.abs(toDate.getTime() - fromDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    expect(diffDays).toBeGreaterThanOrEqual(89);
    expect(diffDays).toBeLessThanOrEqual(91);
  });

  test('TC2: Xác minh luồng Kiểm tra quyền (tool_permissions)', async ({ page }) => {
    // Temporarily revoke permission for admin
    await dbClient.query(`UPDATE tool_permissions SET can_execute = false WHERE role_code = 'admin' AND tool_name = 'get_customer_orders'`);
    
    try {
      await page.goto('/login');
      await page.fill('input[placeholder="Nhập tên đăng nhập"]', 'admin');
      await page.fill('input[placeholder="Nhập mật khẩu"]', 'admin123');
      await page.click('button:has-text("Đăng nhập")');
      await page.waitForSelector('button:has-text("Cuộc trò chuyện mới")');
      await page.click('button:has-text("Cuộc trò chuyện mới")', { timeout: 5000 }).catch(() => {});
      await page.fill('input[placeholder="Nhập câu hỏi..."]', 'Khách hàng Nguyễn Văn A có những đơn hàng nào?');
      await page.click('button[type="submit"]');

      // The backend should return permission denied in the chat UI or at least it's logged as failed
      let status = '';
      for (let i = 0; i < 15; i++) {
        const res = await dbClient.query(`
          SELECT status FROM audit_logs 
          WHERE tool_name = 'get_customer_orders'
          ORDER BY created_at DESC 
          LIMIT 1
        `);
        if (res.rows.length > 0 && res.rows[0].status === 'failed') {
          status = 'failed';
          break;
        }
        await page.waitForTimeout(1000);
      }
      expect(status).toBe('failed');

    } finally {
      // Restore permission
      await dbClient.query(`UPDATE tool_permissions SET can_execute = true WHERE role_code = 'admin' AND tool_name = 'get_customer_orders'`);
    }
  });

});
