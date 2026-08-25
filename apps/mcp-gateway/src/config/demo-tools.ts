// ============================================================================
// Bản đồ "tool demo → tích hợp thật thay thế".
//
// Các tool dưới đây đọc dữ liệu từ DB demo nội bộ (mcp-server-postgres). Khi
// tích hợp thật đảm nhiệm cùng miền dữ liệu đang BẬT cho tenant, tool demo bị
// ẨN khỏi danh sách tool của AI và bị đánh dấu không cho phép — để mỗi miền
// dữ liệu chỉ còn MỘT nguồn trả lời, hết cảnh hai tool cho hai kết quả lệch nhau.
// Khi tích hợp tương ứng TẮT/chưa cấu hình, tool demo hiện lại (chế độ dữ liệu mẫu).
// ============================================================================
import { query } from '../db/pool.js';

export const DEMO_TOOL_SUPERSEDED_BY: Record<string, string> = {
  search_customer: 'crm',
  get_customer_orders: 'erpnext',
  get_order_detail: 'erpnext',
  get_revenue_summary: 'erpnext',
  get_top_customers: 'erpnext',
  get_product_sales_summary: 'erpnext'
};

/** Các integration_code đang BẬT của tenant. */
export async function getActiveIntegrationCodes(tenantId: string): Promise<Set<string>> {
  const res = await query<{ integration_code: string }>(
    `SELECT integration_code FROM tenant_integrations WHERE tenant_id = $1 AND is_active = true`,
    [tenantId]
  );
  return new Set(res.rows.map(r => r.integration_code));
}

/** Tool demo này đã bị tích hợp thật (đang bật) thay thế chưa? */
export function isSupersededDemoTool(toolName: string, activeCodes: Set<string>): boolean {
  const owner = DEMO_TOOL_SUPERSEDED_BY[toolName];
  return Boolean(owner && activeCodes.has(owner));
}
