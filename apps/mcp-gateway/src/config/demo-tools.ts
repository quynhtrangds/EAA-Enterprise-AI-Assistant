// ============================================================================
// Bản đồ "tool demo -> tích hợp thật thay thế".
//
// Các tool nghiệp vụ cốt lõi (get_revenue_summary, get_product_sales_summary,
// search_customer, get_customer_orders, get_order_detail, get_top_customers)
// hiện đã được mcp-server-erpnext hỗ trợ trực tiếp từ Frappe REST API thời gian thực.
// Do đó không còn bị coi là tool demo bị thay thế nữa.
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
export function isSupersededDemoTool(toolName: string, activeCodes: Set<string>, userRoles?: string[]): boolean {
  return false;
}
