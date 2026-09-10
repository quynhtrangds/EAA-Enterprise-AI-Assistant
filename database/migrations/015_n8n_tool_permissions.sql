-- Migration 015: Seed explicit tool permissions for trigger_n8n_webhook
-- Ensures RBAC controls apply explicitly rather than falling back to default

INSERT INTO tool_permissions (role_code, tool_name, can_execute)
VALUES
  ('admin', 'trigger_n8n_webhook', true),
  ('manager', 'trigger_n8n_webhook', true),
  ('staff', 'trigger_n8n_webhook', true),
  ('viewer', 'trigger_n8n_webhook', false)
ON CONFLICT (role_code, tool_name) DO UPDATE
SET can_execute = EXCLUDED.can_execute;
