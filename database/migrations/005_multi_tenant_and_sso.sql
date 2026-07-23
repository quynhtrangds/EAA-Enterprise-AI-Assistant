-- 005_multi_tenant_and_sso.sql

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert a default tenant for existing data
INSERT INTO tenants (id, name, domain) VALUES ('00000000-0000-0000-0000-000000000000', 'Default Tenant', 'example.com') ON CONFLICT DO NOTHING;

-- Add tenant_id to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_tenant;
ALTER TABLE users ADD CONSTRAINT fk_users_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;

-- Add SSO fields to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS sso_provider VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS sso_id VARCHAR(255);

-- Add tenant_id to customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE customers DROP CONSTRAINT IF EXISTS fk_customers_tenant;
ALTER TABLE customers ADD CONSTRAINT fk_customers_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;

-- Add tenant_id to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE products DROP CONSTRAINT IF EXISTS fk_products_tenant;
ALTER TABLE products ADD CONSTRAINT fk_products_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;

-- Add tenant_id to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE orders DROP CONSTRAINT IF EXISTS fk_orders_tenant;
ALTER TABLE orders ADD CONSTRAINT fk_orders_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;

-- Add tenant_id to chat_sessions
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE chat_sessions DROP CONSTRAINT IF EXISTS fk_chat_sessions_tenant;
ALTER TABLE chat_sessions ADD CONSTRAINT fk_chat_sessions_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
