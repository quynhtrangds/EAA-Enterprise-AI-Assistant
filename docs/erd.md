# Sơ Đồ Thực Thể - Liên Kết (ERD) - Enterprise AI Assistant

Tài liệu này lưu trữ sơ đồ ERD chuẩn của hệ thống cơ sở dữ liệu PostgreSQL (gồm 16 bảng thực thể). Bạn có thể xem trực tiếp trên GitHub, VS Code (với Markdown Preview Mermaid Support) hoặc copy mã nguồn bên dưới vào [Mermaid Live Editor](https://mermaid.live).

```mermaid
erDiagram
    %% ===================================================
    %% 1. MULTI-TENANCY & IAM / RBAC
    %% ===================================================
    tenants ||--o{ users : "has"
    tenants ||--o{ tenant_integrations : "configures"
    tenants ||--o{ integration_health_events : "monitors"
    tenants ||--o{ customers : "owns"
    tenants ||--o{ products : "owns"
    tenants ||--o{ orders : "owns"
    tenants ||--o{ chat_sessions : "owns"

    users ||--o{ user_roles : "assigned"
    roles ||--o{ user_roles : "assigned"
    roles ||--o{ tool_permissions : "grants"
    users ||--o{ auth_sessions : "creates"
    users ||--o{ audit_logs : "executes"
    users ||--o{ chat_sessions : "creates"

    %% ===================================================
    %% 2. CHAT & AI CONTEXT
    %% ===================================================
    chat_sessions ||--o{ chat_messages : "contains"

    %% ===================================================
    %% 3. BUSINESS CORE (E-COMMERCE / ERP)
    %% ===================================================
    customers ||--o{ orders : "places"
    orders ||--o{ order_items : "contains"
    products ||--o{ order_items : "includes"
    orders ||--o{ payments : "paid_with"

    %% ===================================================
    %% TABLE SPECIFICATIONS
    %% ===================================================

    tenants {
        uuid id PK
        varchar name
        varchar domain
        varchar status
        timestamptz created_at
    }

    users {
        uuid id PK
        uuid tenant_id FK
        varchar username
        varchar password_hash
        varchar display_name
        varchar email
        varchar role
        int failed_login_attempts
        timestamptz locked_until
        varchar sso_provider
        varchar sso_id
        varchar status
        timestamptz created_at
    }

    roles {
        uuid id PK
        varchar role_code UK
        varchar role_name
    }

    user_roles {
        uuid user_id PK,FK
        uuid role_id PK,FK
    }

    tool_permissions {
        uuid id PK
        varchar role_code FK
        varchar tool_name
        boolean can_execute
        timestamptz created_at
    }

    auth_sessions {
        uuid id PK
        uuid user_id FK
        text token UK
        text_array roles
        timestamptz expires_at
        timestamptz revoked_at
        timestamptz created_at
    }

    audit_logs {
        uuid id PK
        uuid user_id FK
        varchar session_id
        varchar tool_name
        jsonb input_json
        jsonb output_json
        varchar status
        text error_message
        int duration_ms
        timestamptz created_at
    }

    chat_sessions {
        varchar session_id PK
        uuid user_id FK
        uuid tenant_id FK
        varchar title
        boolean is_starred
        timestamptz created_at
        timestamptz updated_at
    }

    chat_messages {
        uuid message_id PK
        varchar session_id FK
        varchar role
        text content
        jsonb tool_calls
        timestamptz created_at
    }

    customers {
        uuid id PK
        uuid tenant_id FK
        varchar customer_code UK
        varchar full_name
        varchar phone
        varchar email
        text address
        varchar status
        timestamptz created_at
    }

    products {
        uuid id PK
        uuid tenant_id FK
        varchar product_code UK
        varchar name
        varchar category
        numeric price
        varchar status
        timestamptz created_at
    }

    orders {
        uuid id PK
        uuid tenant_id FK
        uuid customer_id FK
        varchar order_code UK
        timestamptz order_date
        varchar status
        numeric total_amount
        timestamptz created_at
    }

    order_items {
        uuid id PK
        uuid order_id FK
        uuid product_id FK
        int quantity
        numeric unit_price
        numeric total_price
    }

    payments {
        uuid id PK
        uuid order_id FK
        varchar payment_code UK
        varchar payment_method
        numeric amount
        varchar status
        timestamptz paid_at
        timestamptz created_at
    }

    tenant_integrations {
        uuid id PK
        uuid tenant_id FK
        varchar integration_code
        varchar vault_path
        text api_url
        text api_key
        boolean is_active
        timestamptz last_tested_at
        varchar last_test_status
        jsonb last_test_detail
        timestamptz created_at
        timestamptz updated_at
    }

    integration_health_events {
        uuid id PK
        uuid tenant_id FK
        varchar integration_code
        varchar event_type
        varchar from_status
        varchar to_status
        varchar failed_step
        varchar error_code
        jsonb detail
        timestamptz created_at
    }
```
