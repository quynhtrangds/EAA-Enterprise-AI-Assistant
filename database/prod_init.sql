-- prod_init.sql
-- Production System Initialization: Creates system roles, admin user, and tool permissions without demo customer/order data.

INSERT INTO roles (id, role_code, role_name)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin', 'Quản trị viên'),
  ('00000000-0000-0000-0000-000000000002', 'manager', 'Quản lý'),
  ('00000000-0000-0000-0000-000000000003', 'staff', 'Nhân viên'),
  ('00000000-0000-0000-0000-000000000004', 'viewer', 'Người xem')
ON CONFLICT (role_code) DO UPDATE SET role_name = EXCLUDED.role_name;

INSERT INTO users (id, username, password_hash, display_name, email, role, status)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'admin', 'scrypt$bqJUKMa_NUkZJlHCySWKXw$R4_aNdZNjBle9AKIgR_fMl1QYGvU4bLfVNhfwqlDttReo90tZocs-FpOzO8zMg79vZyR80mu8Qdbi__v7QLa0A', 'Quản trị viên', 'admin@example.com', 'admin', 'active')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;

INSERT INTO user_roles (user_id, role_id)
VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (user_id, role_id) DO NOTHING;

INSERT INTO tool_permissions (role_code, tool_name, can_execute)
VALUES
  ('admin', 'search_customer', true),
  ('admin', 'get_customer_orders', true),
  ('admin', 'get_order_detail', true),
  ('admin', 'get_revenue_summary', true),
  ('admin', 'get_top_customers', true),
  ('admin', 'get_product_sales_summary', true),
  ('admin', 'view_audit_logs', true),
  ('manager', 'search_customer', true),
  ('manager', 'get_customer_orders', true),
  ('manager', 'get_order_detail', true),
  ('manager', 'get_revenue_summary', true),
  ('manager', 'get_top_customers', true),
  ('manager', 'get_product_sales_summary', true),
  ('staff', 'search_customer', true),
  ('staff', 'get_customer_orders', true),
  ('staff', 'get_order_detail', true),
  ('viewer', 'get_revenue_summary', true),
  ('viewer', 'get_product_sales_summary', true)
ON CONFLICT (role_code, tool_name) DO UPDATE SET can_execute = EXCLUDED.can_execute;
