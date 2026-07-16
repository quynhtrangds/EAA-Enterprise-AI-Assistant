# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: mcp-gateway-flow.spec.ts >> MCP Gateway Flow Sequence E2E >> TC2: Xác minh luồng Kiểm tra quyền (tool_permissions)
- Location: e2e\mcp-gateway-flow.spec.ts:71:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "failed"
Received: ""
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import { Client } from 'pg';
  3   | 
  4   | const dbConfig = {
  5   |   host: process.env.POSTGRES_HOST || 'localhost',
  6   |   port: parseInt(process.env.POSTGRES_PORT || '55432', 10),
  7   |   database: process.env.POSTGRES_DB || 'enterprise_ai_demo',
  8   |   user: process.env.POSTGRES_USER || 'postgres',
  9   |   password: process.env.POSTGRES_PASSWORD || 'postgres',
  10  | };
  11  | 
  12  | test.describe('MCP Gateway Flow Sequence E2E', () => {
  13  |   let dbClient: Client;
  14  | 
  15  |   test.beforeAll(async () => {
  16  |     dbClient = new Client(dbConfig);
  17  |     await dbClient.connect();
  18  |   });
  19  | 
  20  |   test.afterAll(async () => {
  21  |     await dbClient.end();
  22  |   });
  23  | 
  24  |   test('TC1: Xác minh luồng thành công và Audit Log', async ({ page }) => {
  25  |     // 1. [UI] Login
  26  |     await page.goto('/login');
  27  |     await page.fill('input[placeholder="Nhập tên đăng nhập"]', 'admin');
  28  |     await page.fill('input[placeholder="Nhập mật khẩu"]', 'admin123'); // seed.sql uses this usually? Or let's just bypass if it's admin
  29  |     await page.click('button:has-text("Đăng nhập")');
  30  |     // Wait for the new chat button to appear instead of URL change
  31  |     await page.waitForSelector('button:has-text("Cuộc trò chuyện mới")');
  32  | 
  33  |     // 2. [UI] Create a new session and ask a question
  34  |     await page.click('button:has-text("Cuộc trò chuyện mới")', { timeout: 10000 }).catch(() => {}); // might not be needed if already on new chat
  35  |     await page.fill('input[placeholder="Nhập câu hỏi..."]', 'Khách hàng Nguyễn Văn A có những đơn hàng nào?');
  36  |     await page.click('button[type="submit"]');
  37  | 
  38  |     // 3. [UI Assert] Wait for AI response
  39  |     // The response should contain some order information
  40  |     await expect(page.locator('.prose').last()).toContainText('đơn hàng', { timeout: 30000 });
  41  | 
  42  |     // 4. [Database Assert] Query audit_logs
  43  |     const query = `
  44  |       SELECT * FROM audit_logs 
  45  |       WHERE tool_name = 'get_customer_orders'
  46  |       ORDER BY created_at DESC 
  47  |       LIMIT 1
  48  |     `;
  49  |     // Wait a bit for db insert
  50  |     await page.waitForTimeout(2000);
  51  |     const res = await dbClient.query(query);
  52  |     
  53  |     expect(res.rows.length).toBeGreaterThan(0);
  54  |     const log = res.rows[0];
  55  |     expect(log.status).toBe('success');
  56  |     
  57  |     // Verify 90 days rule (from date and to date exist in cleanInput)
  58  |     const inputJson = log.input_json;
  59  |     expect(inputJson).toHaveProperty('fromDate');
  60  |     expect(inputJson).toHaveProperty('toDate');
  61  |     
  62  |     // Ensure fromDate is roughly 90 days ago
  63  |     const fromDate = new Date(inputJson.fromDate);
  64  |     const toDate = new Date(inputJson.toDate);
  65  |     const diffTime = Math.abs(toDate.getTime() - fromDate.getTime());
  66  |     const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  67  |     expect(diffDays).toBeGreaterThanOrEqual(89);
  68  |     expect(diffDays).toBeLessThanOrEqual(91);
  69  |   });
  70  | 
  71  |   test('TC2: Xác minh luồng Kiểm tra quyền (tool_permissions)', async ({ page }) => {
  72  |     // Temporarily revoke permission for admin
  73  |     await dbClient.query(`UPDATE tool_permissions SET can_execute = false WHERE role_code = 'admin' AND tool_name = 'get_customer_orders'`);
  74  |     
  75  |     try {
  76  |       await page.goto('/login');
  77  |       await page.fill('input[placeholder="Nhập tên đăng nhập"]', 'admin');
  78  |       await page.fill('input[placeholder="Nhập mật khẩu"]', 'admin123');
  79  |       await page.click('button:has-text("Đăng nhập")');
  80  |       await page.waitForSelector('button:has-text("Cuộc trò chuyện mới")');
  81  |       await page.click('button:has-text("Cuộc trò chuyện mới")', { timeout: 5000 }).catch(() => {});
  82  |       await page.fill('input[placeholder="Nhập câu hỏi..."]', 'Khách hàng Nguyễn Văn A có những đơn hàng nào?');
  83  |       await page.click('button[type="submit"]');
  84  | 
  85  |       // The backend should return permission denied in the chat UI or at least it's logged as failed
  86  |       let status = '';
  87  |       for (let i = 0; i < 15; i++) {
  88  |         const res = await dbClient.query(`
  89  |           SELECT status FROM audit_logs 
  90  |           WHERE tool_name = 'get_customer_orders'
  91  |           ORDER BY created_at DESC 
  92  |           LIMIT 1
  93  |         `);
  94  |         if (res.rows.length > 0 && res.rows[0].status === 'failed') {
  95  |           status = 'failed';
  96  |           break;
  97  |         }
  98  |         await page.waitForTimeout(1000);
  99  |       }
> 100 |       expect(status).toBe('failed');
      |                      ^ Error: expect(received).toBe(expected) // Object.is equality
  101 | 
  102 |     } finally {
  103 |       // Restore permission
  104 |       await dbClient.query(`UPDATE tool_permissions SET can_execute = true WHERE role_code = 'admin' AND tool_name = 'get_customer_orders'`);
  105 |     }
  106 |   });
  107 | 
  108 | });
  109 | 
```