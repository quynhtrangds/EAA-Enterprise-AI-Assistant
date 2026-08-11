-- 010_tenant_isolation_indexes.sql
-- Ensure tenant_id column exists on business tables & create composite indexes for multi-tenant isolation

-- 1. Ensure tenant_id defaults to default tenant
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE products ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

-- 2. Create composite indexes for fast tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_customers_tenant_created ON customers (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_customer ON orders (tenant_id, customer_id, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_code ON orders (tenant_id, UPPER(order_code));
CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products (tenant_id, id);
