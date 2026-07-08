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
JOIN products p ON p.product_code = 'PRD-' || lpad((((gs * 7 - 1) % 30) + 1)::text, 3, '0')
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