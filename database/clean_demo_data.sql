-- clean_demo_data.sql
-- Run this script to purge all demo/mock customer, product, and order records in Production.

DELETE FROM payments WHERE order_id IN (SELECT id FROM orders WHERE order_code LIKE 'ORD-%');
DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE order_code LIKE 'ORD-%');
DELETE FROM orders WHERE order_code LIKE 'ORD-%';
DELETE FROM products WHERE product_code LIKE 'PRD-%';
DELETE FROM customers WHERE customer_code LIKE 'CUS-%';

-- Optional: Reset default demo user passwords or remove guest/test accounts if needed
-- DELETE FROM users WHERE username IN ('staff', 'viewer');
