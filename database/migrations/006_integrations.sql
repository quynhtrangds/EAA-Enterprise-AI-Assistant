-- Migration: 006_integrations.sql
-- Description: Tạo bảng tenant_integrations để lưu danh sách tích hợp của mỗi tenant

CREATE TABLE IF NOT EXISTS tenant_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    integration_code VARCHAR(50) NOT NULL,
    vault_path VARCHAR(255),
    api_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, integration_code)
);


