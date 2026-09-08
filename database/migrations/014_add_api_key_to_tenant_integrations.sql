-- Migration: 014_add_api_key_to_tenant_integrations.sql
-- Description: Bổ sung cột api_key cho bảng tenant_integrations (hỗ trợ tương thích ngược với vault-sync và query tra cứu, giá trị mặc định NULL do secret lưu trữ tại HashiCorp Vault)

ALTER TABLE tenant_integrations ADD COLUMN IF NOT EXISTS api_key TEXT;
