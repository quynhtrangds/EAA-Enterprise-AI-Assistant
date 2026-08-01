INSERT INTO roles (id, role_code, role_name)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin', 'Quản trị viên'),
  ('00000000-0000-0000-0000-000000000002', 'manager', 'Quản lý'),
  ('00000000-0000-0000-0000-000000000003', 'staff', 'Nhân viên'),
  ('00000000-0000-0000-0000-000000000004', 'viewer', 'Người xem')
ON CONFLICT (role_code) DO UPDATE
SET role_name = EXCLUDED.role_name;

INSERT INTO users (id, username, password_hash, display_name, email, role, status)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'admin', 'scrypt$bqJUKMa_NUkZJlHCySWKXw$R4_aNdZNjBle9AKIgR_fMl1QYGvU4bLfVNhfwqlDttReo90tZocs-FpOzO8zMg79vZyR80mu8Qdbi__v7QLa0A', 'Quản trị viên', 'admin@example.com', 'admin', 'active'),
  ('10000000-0000-0000-0000-000000000002', 'manager', 'scrypt$QO5_pQ24g7a-XKVNuAfj5w$FUQH68nxTOcgptmdumGu8vOZD3eilj88nnfkqh7nToZw8OacYyklkiOUmQ3sPb0KlQHWonc1RkLWGNGb0rz3iQ', 'Quản lý bán hàng', 'manager@example.com', 'manager', 'active'),
  ('10000000-0000-0000-0000-000000000003', 'staff', 'scrypt$qon2tc-bAWKybQgEXe6PXQ$upN6Uhb8469WDy3CUl52n2UbMjQds13vZ1aomw1V8j9e9prSocWgvOu8qNOsixYvAJESI16jzsQXccEOpl7q4w', 'Nhân viên kinh doanh', 'staff@example.com', 'staff', 'active'),
  ('10000000-0000-0000-0000-000000000004', 'viewer', 'scrypt$vNlCyKbZ3Jcx8lZVgvwMrg$X_k6MwTLVWRUdCe7L1HIWxbG8bF00t9AHr2wCSAg99iX7ufLTGaT6bamykifAkuRIfT9JSWcSwTan9hduVk7-A', 'Người xem báo cáo', 'viewer@example.com', 'viewer', 'active')
ON CONFLICT (id) DO UPDATE
SET
  password_hash = EXCLUDED.password_hash,
  display_name = EXCLUDED.display_name,
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  status = EXCLUDED.status;

INSERT INTO user_roles (user_id, role_id)
VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004')
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
ON CONFLICT (role_code, tool_name) DO UPDATE
SET can_execute = EXCLUDED.can_execute;

INSERT INTO customers (id, customer_code, full_name, phone, email, address, status)
VALUES
  ('20000000-0000-0000-0000-000000000001', 'CUS-001', 'Nguyễn Văn A', '0901000001', 'nguyenvana@example.com', 'Quận 1, TP. HCM', 'active'),
  ('20000000-0000-0000-0000-000000000002', 'CUS-002', 'Trần Thị B', '0901000002', 'tranthib@example.com', 'Quận 3, TP. HCM', 'active'),
  ('20000000-0000-0000-0000-000000000003', 'CUS-003', 'Công ty Minh Long', '0901000003', 'contact@minhlong.example.com', 'Quận Bình Thạnh, TP. HCM', 'active'),
  ('20000000-0000-0000-0000-000000000004', 'CUS-004', 'Lê Văn C', '0901000004', 'levanc@example.com', 'Quận 7, TP. HCM', 'active'),
  ('20000000-0000-0000-0000-000000000005', 'CUS-005', 'Phạm Thị D', '0901000005', 'phamthid@example.com', 'TP. Thủ Đức, TP. HCM', 'active'),
  ('20000000-0000-0000-0000-000000000006', 'CUS-006', 'Hoàng Gia Retail', '0901000006', 'sales@hoanggia.example.com', 'Hà Nội', 'active'),
  ('20000000-0000-0000-0000-000000000007', 'CUS-007', 'Nguyễn Thị Hoa', '0901000007', 'nguyenthihoa@example.com', 'Đà Nẵng', 'active'),
  ('20000000-0000-0000-0000-000000000008', 'CUS-008', 'An Phát Trading', '0901000008', 'contact@anphat.example.com', 'Cần Thơ', 'active')
ON CONFLICT (customer_code) DO UPDATE
SET
  full_name = EXCLUDED.full_name,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  address = EXCLUDED.address,
  status = EXCLUDED.status;

INSERT INTO products (id, product_code, name, category, price, status)
VALUES
  ('30000000-0000-0000-0000-000000000001', 'PRD-001', 'Máy tính xách tay Pro 14', 'Máy tính xách tay', 25000000, 'active'),
  ('30000000-0000-0000-0000-000000000002', 'PRD-002', 'Máy tính xách tay Air 13', 'Máy tính xách tay', 18000000, 'active'),
  ('30000000-0000-0000-0000-000000000003', 'PRD-003', 'Màn hình 27 inch', 'Màn hình', 6500000, 'active'),
  ('30000000-0000-0000-0000-000000000004', 'PRD-004', 'Bàn phím cơ', 'Phụ kiện', 1800000, 'active'),
  ('30000000-0000-0000-0000-000000000005', 'PRD-005', 'Chuột không dây', 'Phụ kiện', 750000, 'active'),
  ('30000000-0000-0000-0000-000000000006', 'PRD-006', 'Hub USB-C', 'Phụ kiện', 3200000, 'active'),
  ('30000000-0000-0000-0000-000000000007', 'PRD-007', 'Ghế văn phòng', 'Nội thất', 4200000, 'active'),
  ('30000000-0000-0000-0000-000000000008', 'PRD-008', 'Bàn đứng', 'Nội thất', 8900000, 'active')
ON CONFLICT (product_code) DO UPDATE
SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  price = EXCLUDED.price,
  status = EXCLUDED.status;

INSERT INTO orders (id, order_code, customer_id, order_date, status, total_amount)
VALUES
  ('40000000-0000-0000-0000-000000000001', 'ORD-001', '20000000-0000-0000-0000-000000000001', now() - INTERVAL '2 hours', 'paid', 26800000),
  ('40000000-0000-0000-0000-000000000002', 'ORD-002', '20000000-0000-0000-0000-000000000002', now() - INTERVAL '1 day', 'completed', 18750000),
  ('40000000-0000-0000-0000-000000000003', 'ORD-003', '20000000-0000-0000-0000-000000000003', now() - INTERVAL '3 days', 'paid', 51200000),
  ('40000000-0000-0000-0000-000000000004', 'ORD-004', '20000000-0000-0000-0000-000000000004', now() - INTERVAL '6 days', 'shipping', 15400000),
  ('40000000-0000-0000-0000-000000000005', 'ORD-005', '20000000-0000-0000-0000-000000000005', now() - INTERVAL '8 days', 'paid', 10700000),
  ('40000000-0000-0000-0000-000000000006', 'ORD-006', '20000000-0000-0000-0000-000000000001', now() - INTERVAL '12 days', 'completed', 33900000),
  ('40000000-0000-0000-0000-000000000007', 'ORD-007', '20000000-0000-0000-0000-000000000006', now() - INTERVAL '15 days', 'paid', 42800000),
  ('40000000-0000-0000-0000-000000000008', 'ORD-008', '20000000-0000-0000-0000-000000000007', now() - INTERVAL '20 days', 'cancelled', 6500000),
  ('40000000-0000-0000-0000-000000000009', 'ORD-009', '20000000-0000-0000-0000-000000000008', now() - INTERVAL '35 days', 'paid', 31400000),
  ('40000000-0000-0000-0000-000000000010', 'ORD-010', '20000000-0000-0000-0000-000000000003', now() - INTERVAL '45 days', 'completed', 69600000),
  ('40000000-0000-0000-0000-000000000011', 'ORD-011', '20000000-0000-0000-0000-000000000002', now() - INTERVAL '70 days', 'paid', 28600000),
  ('40000000-0000-0000-0000-000000000012', 'ORD-012', '20000000-0000-0000-0000-000000000004', now() - INTERVAL '95 days', 'paid', 9700000)
ON CONFLICT (order_code) DO UPDATE
SET
  customer_id = EXCLUDED.customer_id,
  order_date = EXCLUDED.order_date,
  status = EXCLUDED.status,
  total_amount = EXCLUDED.total_amount;

INSERT INTO order_items (id, order_id, product_id, quantity, unit_price, total_price)
VALUES
  ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 1, 25000000, 25000000),
  ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000004', 1, 1800000, 1800000),
  ('50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 1, 18000000, 18000000),
  ('50000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000005', 1, 750000, 750000),
  ('50000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 2, 25000000, 50000000),
  ('50000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000004', 1, 1200000, 1200000),
  ('50000000-0000-0000-0000-000000000007', '40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000003', 2, 6500000, 13000000),
  ('50000000-0000-0000-0000-000000000008', '40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000005', 2, 750000, 1500000),
  ('50000000-0000-0000-0000-000000000009', '40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000004', 1, 900000, 900000),
  ('50000000-0000-0000-0000-000000000010', '40000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000008', 1, 8900000, 8900000),
  ('50000000-0000-0000-0000-000000000011', '40000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000004', 1, 1800000, 1800000),
  ('50000000-0000-0000-0000-000000000012', '40000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000001', 1, 25000000, 25000000),
  ('50000000-0000-0000-0000-000000000013', '40000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000008', 1, 8900000, 8900000),
  ('50000000-0000-0000-0000-000000000014', '40000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000002', 2, 18000000, 36000000),
  ('50000000-0000-0000-0000-000000000015', '40000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000006', 2, 3200000, 6400000),
  ('50000000-0000-0000-0000-000000000016', '40000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000005', 1, 400000, 400000),
  ('50000000-0000-0000-0000-000000000017', '40000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000003', 1, 6500000, 6500000),
  ('50000000-0000-0000-0000-000000000018', '40000000-0000-0000-0000-000000000009', '30000000-0000-0000-0000-000000000001', 1, 25000000, 25000000),
  ('50000000-0000-0000-0000-000000000019', '40000000-0000-0000-0000-000000000009', '30000000-0000-0000-0000-000000000003', 1, 6400000, 6400000),
  ('50000000-0000-0000-0000-000000000020', '40000000-0000-0000-0000-000000000010', '30000000-0000-0000-0000-000000000001', 2, 25000000, 50000000),
  ('50000000-0000-0000-0000-000000000021', '40000000-0000-0000-0000-000000000010', '30000000-0000-0000-0000-000000000008', 2, 8900000, 17800000),
  ('50000000-0000-0000-0000-000000000022', '40000000-0000-0000-0000-000000000010', '30000000-0000-0000-0000-000000000004', 1, 1800000, 1800000),
  ('50000000-0000-0000-0000-000000000023', '40000000-0000-0000-0000-000000000011', '30000000-0000-0000-0000-000000000003', 4, 6500000, 26000000),
  ('50000000-0000-0000-0000-000000000024', '40000000-0000-0000-0000-000000000011', '30000000-0000-0000-0000-000000000005', 2, 750000, 1500000),
  ('50000000-0000-0000-0000-000000000025', '40000000-0000-0000-0000-000000000011', '30000000-0000-0000-0000-000000000004', 1, 1100000, 1100000),
  ('50000000-0000-0000-0000-000000000026', '40000000-0000-0000-0000-000000000012', '30000000-0000-0000-0000-000000000006', 2, 3200000, 6400000),
  ('50000000-0000-0000-0000-000000000027', '40000000-0000-0000-0000-000000000012', '30000000-0000-0000-0000-000000000005', 2, 750000, 1500000),
  ('50000000-0000-0000-0000-000000000028', '40000000-0000-0000-0000-000000000012', '30000000-0000-0000-0000-000000000004', 1, 1800000, 1800000)
ON CONFLICT (id) DO UPDATE
SET
  order_id = EXCLUDED.order_id,
  product_id = EXCLUDED.product_id,
  quantity = EXCLUDED.quantity,
  unit_price = EXCLUDED.unit_price,
  total_price = EXCLUDED.total_price;

INSERT INTO payments (id, order_id, payment_code, payment_method, amount, paid_at, status)
VALUES
  ('60000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'PAY-001', 'bank_transfer', 26800000, now() - INTERVAL '1 hour', 'paid'),
  ('60000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 'PAY-002', 'card', 18750000, now() - INTERVAL '1 day', 'paid'),
  ('60000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000003', 'PAY-003', 'bank_transfer', 51200000, now() - INTERVAL '3 days', 'paid'),
  ('60000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000004', 'PAY-004', 'cash', 15400000, NULL, 'pending'),
  ('60000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000005', 'PAY-005', 'e_wallet', 10700000, now() - INTERVAL '8 days', 'paid'),
  ('60000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000006', 'PAY-006', 'bank_transfer', 33900000, now() - INTERVAL '12 days', 'paid'),
  ('60000000-0000-0000-0000-000000000007', '40000000-0000-0000-0000-000000000007', 'PAY-007', 'card', 42800000, now() - INTERVAL '15 days', 'paid'),
  ('60000000-0000-0000-0000-000000000008', '40000000-0000-0000-0000-000000000008', 'PAY-008', 'cash', 0, NULL, 'cancelled'),
  ('60000000-0000-0000-0000-000000000009', '40000000-0000-0000-0000-000000000009', 'PAY-009', 'bank_transfer', 31400000, now() - INTERVAL '35 days', 'paid'),
  ('60000000-0000-0000-0000-000000000010', '40000000-0000-0000-0000-000000000010', 'PAY-010', 'card', 69600000, now() - INTERVAL '45 days', 'paid'),
  ('60000000-0000-0000-0000-000000000011', '40000000-0000-0000-0000-000000000011', 'PAY-011', 'e_wallet', 28600000, now() - INTERVAL '70 days', 'paid'),
  ('60000000-0000-0000-0000-000000000012', '40000000-0000-0000-0000-000000000012', 'PAY-012', 'bank_transfer', 9700000, now() - INTERVAL '95 days', 'paid')
ON CONFLICT (payment_code) DO UPDATE
SET
  order_id = EXCLUDED.order_id,
  payment_method = EXCLUDED.payment_method,
  amount = EXCLUDED.amount,
  paid_at = EXCLUDED.paid_at,
  status = EXCLUDED.status;

-- Expand demo data to target test volume:
-- 50 customers, 30 products, 300 orders, 700 order_items, 250 payments.

INSERT INTO customers (id, customer_code, full_name, phone, email, address, status)
SELECT
  ('20000000-0000-0000-0000-' || lpad(gs::text, 12, '0'))::uuid AS id,
  'CUS-' || lpad(gs::text, 3, '0') AS customer_code,
  (
    (ARRAY['Nguyễn','Trần','Lê','Phạm','Hoàng','Phan','Vũ','Võ','Đặng','Bùi'])[(gs % 10) + 1]
    || ' ' ||
    (ARRAY['Văn','Thị','Minh','Quốc','Thanh','Gia','Hữu','Ngọc'])[(gs % 8) + 1]
    || ' ' ||
    (ARRAY['An','Bình','Chi','Dũng','Hà','Hải','Hương','Khoa','Linh','Long','Mai','Nam','Phúc','Quân','Trang','Vy'])[(gs % 16) + 1]
  ) AS full_name,
  '0901' || lpad(gs::text, 6, '0') AS phone,
  'customer' || lpad(gs::text, 3, '0') || '@example.com' AS email,
  (ARRAY['Quận 1, TP. HCM','Quận 3, TP. HCM','Quận Bình Thạnh, TP. HCM','TP. Thủ Đức, TP. HCM','Hà Nội','Đà Nẵng','Cần Thơ','Hải Phòng'])[(gs % 8) + 1] AS address,
  CASE WHEN gs % 23 = 0 THEN 'inactive' ELSE 'active' END AS status
FROM generate_series(9, 50) AS gs
ON CONFLICT (customer_code) DO UPDATE
SET
  full_name = EXCLUDED.full_name,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  address = EXCLUDED.address,
  status = EXCLUDED.status;

INSERT INTO products (id, product_code, name, category, price, status)
VALUES
  ('30000000-0000-0000-0000-000000000009', 'PRD-009', 'Tai nghe chống ồn', 'Phụ kiện', 2500000, 'active'),
  ('30000000-0000-0000-0000-000000000010', 'PRD-010', 'Webcam Full HD', 'Phụ kiện', 1200000, 'active'),
  ('30000000-0000-0000-0000-000000000011', 'PRD-011', 'Ổ cứng SSD 1TB', 'Lưu trữ', 2800000, 'active'),
  ('30000000-0000-0000-0000-000000000012', 'PRD-012', 'Ổ cứng SSD 2TB', 'Lưu trữ', 5200000, 'active'),
  ('30000000-0000-0000-0000-000000000013', 'PRD-013', 'Router Wi-Fi 6', 'Mạng', 3400000, 'active'),
  ('30000000-0000-0000-0000-000000000014', 'PRD-014', 'Switch 24 port', 'Mạng', 7600000, 'active'),
  ('30000000-0000-0000-0000-000000000015', 'PRD-015', 'Máy in laser', 'Văn phòng', 4900000, 'active'),
  ('30000000-0000-0000-0000-000000000016', 'PRD-016', 'Máy scan tài liệu', 'Văn phòng', 6100000, 'active'),
  ('30000000-0000-0000-0000-000000000017', 'PRD-017', 'Bộ lưu điện UPS', 'Thiết bị điện', 3900000, 'active'),
  ('30000000-0000-0000-0000-000000000018', 'PRD-018', 'Ổ cắm thông minh', 'Thiết bị điện', 650000, 'active'),
  ('30000000-0000-0000-0000-000000000019', 'PRD-019', 'Máy chiếu mini', 'Trình chiếu', 8700000, 'active'),
  ('30000000-0000-0000-0000-000000000020', 'PRD-020', 'Màn chiếu treo tường', 'Trình chiếu', 2300000, 'active'),
  ('30000000-0000-0000-0000-000000000021', 'PRD-021', 'Micro hội nghị', 'Hội nghị', 3100000, 'active'),
  ('30000000-0000-0000-0000-000000000022', 'PRD-022', 'Loa hội nghị', 'Hội nghị', 4500000, 'active'),
  ('30000000-0000-0000-0000-000000000023', 'PRD-023', 'Máy tính để bàn Mini', 'Máy tính để bàn', 14500000, 'active'),
  ('30000000-0000-0000-0000-000000000024', 'PRD-024', 'Máy trạm đồ họa', 'Máy tính để bàn', 42500000, 'active'),
  ('30000000-0000-0000-0000-000000000025', 'PRD-025', 'RAM 32GB', 'Linh kiện', 2600000, 'active'),
  ('30000000-0000-0000-0000-000000000026', 'PRD-026', 'Card đồ họa RTX', 'Linh kiện', 18500000, 'active'),
  ('30000000-0000-0000-0000-000000000027', 'PRD-027', 'Giá đỡ màn hình', 'Phụ kiện', 950000, 'active'),
  ('30000000-0000-0000-0000-000000000028', 'PRD-028', 'Đèn bàn LED', 'Nội thất', 780000, 'active'),
  ('30000000-0000-0000-0000-000000000029', 'PRD-029', 'Tủ hồ sơ', 'Nội thất', 3600000, 'active'),
  ('30000000-0000-0000-0000-000000000030', 'PRD-030', 'Bảng kính văn phòng', 'Nội thất', 4200000, 'active')
ON CONFLICT (product_code) DO UPDATE
SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  price = EXCLUDED.price,
  status = EXCLUDED.status;

INSERT INTO orders (id, order_code, customer_id, order_date, status, total_amount)
SELECT
  ('40000000-0000-0000-0000-' || lpad(gs::text, 12, '0'))::uuid AS id,
  'ORD-' || lpad(gs::text, 3, '0') AS order_code,
  ('20000000-0000-0000-0000-' || lpad((((gs - 1) % 50) + 1)::text, 12, '0'))::uuid AS customer_id,
  now() - ((gs % 180) || ' days')::interval - ((gs % 12) || ' hours')::interval AS order_date,
  CASE
    WHEN gs % 19 = 0 THEN 'cancelled'
    WHEN gs % 13 = 0 THEN 'shipping'
    WHEN gs % 7 = 0 THEN 'completed'
    WHEN gs % 3 = 0 THEN 'paid'
    ELSE 'confirmed'
  END AS status,
  0 AS total_amount
FROM generate_series(13, 300) AS gs
ON CONFLICT (order_code) DO UPDATE
SET
  customer_id = EXCLUDED.customer_id,
  order_date = EXCLUDED.order_date,
  status = EXCLUDED.status;

INSERT INTO order_items (id, order_id, product_id, quantity, unit_price, total_price)
SELECT
  ('50000000-0000-0000-0000-' || lpad(gs::text, 12, '0'))::uuid AS id,
  ('40000000-0000-0000-0000-' || lpad((((gs - 1) % 300) + 1)::text, 12, '0'))::uuid AS order_id,
  p.id AS product_id,
  ((gs % 4) + 1)::int AS quantity,
  p.price AS unit_price,
  (((gs % 4) + 1) * p.price)::numeric(18, 2) AS total_price
FROM generate_series(29, 700) AS gs
JOIN products p ON p.product_code = 'PRD-' || lpad(((((gs * 7) + (gs / 300) * 11) % 30) + 1)::text, 3, '0')
ON CONFLICT (id) DO UPDATE
SET
  order_id = EXCLUDED.order_id,
  product_id = EXCLUDED.product_id,
  quantity = EXCLUDED.quantity,
  unit_price = EXCLUDED.unit_price,
  total_price = EXCLUDED.total_price;

UPDATE orders o
SET total_amount = totals.total_amount
FROM (
  SELECT order_id, COALESCE(SUM(total_price), 0)::numeric(18, 2) AS total_amount
  FROM order_items
  GROUP BY order_id
) totals
WHERE o.id = totals.order_id;

INSERT INTO payments (id, order_id, payment_code, payment_method, amount, paid_at, status)
SELECT
  ('60000000-0000-0000-0000-' || lpad(gs::text, 12, '0'))::uuid AS id,
  o.id AS order_id,
  'PAY-' || lpad(gs::text, 3, '0') AS payment_code,
  (ARRAY['cash','bank_transfer','card','e_wallet'])[(gs % 4) + 1] AS payment_method,
  CASE WHEN o.status = 'cancelled' THEN 0 ELSE o.total_amount END AS amount,
  CASE
    WHEN o.status = 'cancelled' OR gs % 11 = 0 THEN NULL
    ELSE o.order_date + INTERVAL '2 hours'
  END AS paid_at,
  CASE
    WHEN o.status = 'cancelled' THEN 'cancelled'
    WHEN gs % 11 = 0 THEN 'pending'
    ELSE 'paid'
  END AS status
FROM generate_series(13, 250) AS gs
JOIN orders o ON o.order_code = 'ORD-' || lpad(gs::text, 3, '0')
ON CONFLICT (payment_code) DO UPDATE
SET
  order_id = EXCLUDED.order_id,
  payment_method = EXCLUDED.payment_method,
  amount = EXCLUDED.amount,
  paid_at = EXCLUDED.paid_at,
  status = EXCLUDED.status;
