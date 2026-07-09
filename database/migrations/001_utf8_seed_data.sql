CREATE EXTENSION IF NOT EXISTS unaccent;

UPDATE roles SET role_name = CASE role_code
  WHEN 'admin' THEN 'Quản trị viên'
  WHEN 'manager' THEN 'Quản lý'
  WHEN 'staff' THEN 'Nhân viên'
  WHEN 'viewer' THEN 'Người xem'
  ELSE role_name
END;

UPDATE users SET display_name = CASE username
  WHEN 'admin' THEN 'Quản trị viên'
  WHEN 'manager' THEN 'Quản lý bán hàng'
  WHEN 'staff' THEN 'Nhân viên kinh doanh'
  WHEN 'viewer' THEN 'Người xem báo cáo'
  ELSE display_name
END;

UPDATE customers SET full_name = v.full_name, address = v.address
FROM (VALUES
  ('CUS-001', 'Nguyễn Văn A', 'Quận 1, TP. HCM'),
  ('CUS-002', 'Trần Thị B', 'Quận 3, TP. HCM'),
  ('CUS-003', 'Công ty Minh Long', 'Quận Bình Thạnh, TP. HCM'),
  ('CUS-004', 'Lê Văn C', 'Quận 7, TP. HCM'),
  ('CUS-005', 'Phạm Thị D', 'TP. Thủ Đức, TP. HCM'),
  ('CUS-006', 'Hoàng Gia Retail', 'Hà Nội'),
  ('CUS-007', 'Nguyễn Thị Hoa', 'Đà Nẵng'),
  ('CUS-008', 'An Phát Trading', 'Cần Thơ')
) AS v(customer_code, full_name, address)
WHERE customers.customer_code = v.customer_code;

UPDATE products SET name = v.name, category = v.category
FROM (VALUES
  ('PRD-001', 'Máy tính xách tay Pro 14', 'Máy tính xách tay'),
  ('PRD-002', 'Máy tính xách tay Air 13', 'Máy tính xách tay'),
  ('PRD-003', 'Màn hình 27 inch', 'Màn hình'),
  ('PRD-004', 'Bàn phím cơ', 'Phụ kiện'),
  ('PRD-005', 'Chuột không dây', 'Phụ kiện'),
  ('PRD-006', 'Hub USB-C', 'Phụ kiện'),
  ('PRD-007', 'Ghế văn phòng', 'Nội thất'),
  ('PRD-008', 'Bàn đứng', 'Nội thất')
) AS v(product_code, name, category)
WHERE products.product_code = v.product_code;