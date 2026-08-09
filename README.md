# Trợ lý AI Doanh nghiệp (Enterprise AI Assistant)

Nền tảng Trợ lý AI doanh nghiệp bằng tiếng Việt, dựa trên kiến trúc **MCP (Model Context Protocol)**. Mô hình ngôn ngữ lớn (LLM) và AI Orchestrator **không bao giờ** truy cập trực tiếp vào cơ sở dữ liệu hay các hệ thống nghiệp vụ (CRM, ERP, Ticketing...). Mọi thao tác dữ liệu đều phải đi qua **MCP Gateway** dưới dạng các *tool* (công cụ) được kiểm soát quyền (RBAC), rate-limit và ghi audit log đầy đủ.

> 📌 Tài liệu này mô tả nhánh `extended_phase` — đã mở rộng nhiều so với bản MVP ban đầu (thêm xác thực bằng token/Google SSO, multi-tenant, quản lý secret bằng Vault, nhiều connector MCP, lưu lịch sử chat...).

---

## 🏗️ Kiến trúc tổng quan

```text
User (Chat UI)
   │  Bearer token
   ▼
AI Orchestrator  ──(mock / openai / local-LLM)──┐
   │  HTTP (không SQL)                          │
   ▼                                            │
MCP Gateway  (RBAC + rate-limit + audit log)    │
   │                                            │
   ├─▶ mcp-server-postgres  (đọc DB nghiệp vụ)  │
   ├─▶ mcp-server-crm       (mock CRM)          │
   ├─▶ mcp-server-erpnext   (mock ERPNext)      │
   ├─▶ mcp-server-zammad    (mock Zammad)       │
   ├─▶ mcp-server-gitea     (Gitea thật)        │
   └─▶ mcp-server-rag       (tìm kiếm tài liệu) │
                                                 │
PostgreSQL ◀── users, sessions, chat history, tenants, audit_logs
HashiCorp Vault ◀── lưu secret/API key cho từng tenant integration
Gitea ◀── git server nội bộ (dùng bởi mcp-server-gitea)
```

Nguyên tắc bất biến:
- LLM **không** kết nối database trực tiếp và **không** tự sinh SQL để chạy.
- Gateway chỉ expose các tool nghiệp vụ đã khai báo trong `tools-config.json`, phần lớn là **read-only**.
- Mọi tool call đều phải qua kiểm tra quyền (`tool_permissions`) và được ghi vào `audit_logs`.
- Gateway kết nối tới các MCP server con (trong `packages/`) qua `mcp-client-manager`, không tự thực thi nghiệp vụ trực tiếp.

---

## 📋 Yêu cầu hệ thống

1. **Node.js 20+**
2. **Docker Desktop** (đã khởi động)
3. **npm**

---

## 🚀 Chạy dự án

### Cách 1: Docker Compose (khuyến nghị)

`docker-compose.yml` khởi chạy **6 service**: `postgres`, `mcp-gateway`, `ai-orchestrator`, `chat-ui`, `vault` (quản lý secret) và `gitea` (git server nội bộ dùng cho connector Gitea).

```bash
cd EAA-Enterprise-AI-Assistant
docker compose up -d
docker compose ps
```

Địa chỉ mặc định:

| Service          | URL                          |
|------------------|-------------------------------|
| Chat UI          | http://127.0.0.1:3000        |
| MCP Gateway      | http://127.0.0.1:8081        |
| AI Orchestrator  | http://127.0.0.1:8082        |
| PostgreSQL       | localhost:55432               |
| Vault            | http://127.0.0.1:8200 (token: `root`, chỉ dùng cho dev) |
| Gitea            | http://127.0.0.1:3001         |

### Cách 2: Chạy local từng service (dev/debug, hot-reload)

```bash
# 1) Chỉ chạy database (+ Vault nếu cần đọc secret integration)
cd EAA-Enterprise-AI-Assistant
docker compose up -d postgres vault

# 2) MCP Gateway
cd apps/mcp-gateway
cp .env.example .env      # chỉnh JWT_SECRET, VAULT_ADDR... nếu cần
npm install
npm run dev                # http://127.0.0.1:8081/health

# 3) AI Orchestrator (cần Gateway chạy trước)
cd apps/ai-orchestrator
cp .env.example .env
npm install
npm run dev                # http://127.0.0.1:8082/health

# 4) Chat UI (cần Orchestrator chạy trước)
cd apps/chat-ui
npm install
npm run dev                # http://127.0.0.1:3000
```

Biến môi trường quan trọng — xem chi tiết trong `apps/mcp-gateway/.env.example` và `apps/ai-orchestrator/.env.example` (bao gồm `JWT_SECRET`, `VAULT_ADDR`, `VAULT_TOKEN`, `CORS_ORIGINS`, `LLM_PROVIDER`...).

---

## 🔐 Xác thực (Authentication)

Hệ thống **không còn** dùng header `x-user` như bản MVP đầu tiên. Toàn bộ API (trừ `/health` và `/login`, `/auth/*`) yêu cầu header:

```
Authorization: Bearer <token>
```

Token lấy được bằng 1 trong 3 cách:

**1. Đăng nhập username/password**
```bash
curl -X POST http://127.0.0.1:8081/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```
Trả về `{ success, token, tokenType: "Bearer", expiresAt, user }`.

**2. Đăng nhập khách (guest, quyền `viewer`)**
```bash
curl -X POST http://127.0.0.1:8081/api/auth/guest
```

**3. Đăng nhập Google SSO**
```bash
curl -X POST http://127.0.0.1:8081/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{"idToken":"<google_id_token>"}'
```
Cần cấu hình `GOOGLE_CLIENT_ID`.

Tài khoản demo có sẵn trong `database/seed/seed.sql` (mật khẩu theo quy ước `<username>123`):

| Username  | Password    | Vai trò |
|-----------|-------------|---------|
| admin     | admin123    | admin   |
| manager   | manager123  | manager |
| staff     | staff123    | staff   |
| viewer    | viewer123   | viewer  |

Kiểm tra thông tin user hiện tại:
```bash
curl http://127.0.0.1:8081/api/me -H "Authorization: Bearer <token>"
```

### Phân quyền (RBAC)

Quyền thực thi từng tool được lưu trong bảng `tool_permissions` (theo `role_code` + `tool_name`), không hard-code trong app. Vai trò `admin` mặc định được phép tất cả nếu không có bản ghi permission tường minh.

---

## 🔌 Các API chính

### MCP Gateway (`:8081`)

| Method | Endpoint | Mô tả | Quyền |
|---|---|---|---|
| POST | `/api/login` | Đăng nhập username/password | public |
| POST | `/api/auth/guest` | Đăng nhập khách | public |
| POST | `/api/auth/google` | Đăng nhập Google SSO | public |
| GET  | `/api/me` | Thông tin user hiện tại | đã login |
| GET  | `/api/tools` | Danh sách tool theo quyền của user | đã login |
| POST | `/api/tools/call` | Gọi 1 tool | đã login + đúng quyền |
| GET  | `/api/audit-logs` | Xem lịch sử audit log | admin |
| GET  | `/api/chat/sessions` | Danh sách phiên chat | đã login |
| GET  | `/api/chat/sessions/:sessionCode` | Chi tiết 1 phiên chat | đã login |
| POST | `/api/chat/messages` | Lưu 1 lượt hội thoại | đã login |
| GET  | `/api/admin/integrations` | Danh sách integration của tenant | admin |
| POST | `/api/admin/integrations` | Thêm/sửa integration (lưu secret vào Vault) | admin |
| GET  | `/api/admin/users` | Danh sách user trong tenant | admin |
| POST | `/api/admin/users` | Tạo user mới | admin |
| DELETE | `/api/admin/users/:userId` | Xoá user | admin |
| GET/POST | `/api/mcp/sse`, `/api/mcp/message` | Kênh MCP transport (SSE) cho client MCP chuẩn | đã login |

Gọi tool trực tiếp:
```bash
curl -X POST http://127.0.0.1:8081/api/tools/call \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"toolName":"search_customer","arguments":{"keyword":"Nguyen","limit":5},"sessionId":"session-001"}'
```

### AI Orchestrator (`:8082`)

| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/api/login` | Proxy đăng nhập tới MCP Gateway |
| POST | `/api/auth/google` | Proxy đăng nhập Google tới MCP Gateway |
| POST | `/api/chat` | Gửi câu hỏi, nhận câu trả lời (agentic loop tool-calling) |
| POST | `/api/chat/edit` | Sửa 1 lượt hội thoại đã gửi |
| GET  | `/api/chat/sessions` | Danh sách phiên chat của user |
| GET  | `/api/chat/search` | Tìm kiếm trong lịch sử chat |
| GET  | `/api/chat/sessions/:sessionId` | Lấy toàn bộ tin nhắn 1 phiên |

```bash
curl -X POST http://127.0.0.1:8082/api/chat \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"chat-001","message":"Hôm nay doanh thu bao nhiêu?"}'
```

---

## ⚙️ Cấu hình LLM Provider

`LLM_PROVIDER` hỗ trợ 3 giá trị:

```env
# 1) Mock — chạy offline, không cần API key, dùng rule-based planner
LLM_PROVIDER=mock

# 2) OpenAI (hoặc API tương thích OpenAI, ví dụ Gemini OpenAI-compatible endpoint)
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini

# 3) Local LLM (ví dụ Ollama)
LLM_PROVIDER=local
LOCAL_LLM_BASE_URL=http://localhost:1234/v1
```

Ở chế độ `openai`/`local`, Orchestrator lấy danh sách tool từ MCP Gateway (`GET /api/tools`), chuyển `inputSchema` sang OpenAI Function Tools, cho phép LLM thực hiện **nhiều vòng gọi tool liên tiếp** (agentic loop, giới hạn bởi `MAX_TOOL_CALL_ROUNDS`) trước khi tổng hợp câu trả lời tiếng Việt cuối cùng.

---

## 🔑 Quản lý secret (Vault) & tích hợp bên thứ 3

Các API key/URL của từng integration (CRM, ERPNext, Zammad, Gitea...) theo từng tenant được lưu trong **HashiCorp Vault**, không lưu plaintext trong DB (DB chỉ giữ `vault_path`). Admin cấu hình qua `POST /api/admin/integrations`; response luôn che (mask) secret, chỉ hiển thị 4 ký tự cuối.

Trong dev, Vault chạy ở chế độ dev-server (`VAULT_DEV_ROOT_TOKEN_ID=root`) — **không dùng cấu hình này cho production**.

---

## 🧩 Các MCP Server con (`packages/`)

| Package | Vai trò |
|---|---|
| `mcp-server-postgres` | Đọc dữ liệu nghiệp vụ (khách hàng, đơn hàng, doanh thu...) từ PostgreSQL |
| `mcp-server-crm` | Mock CRM |
| `mcp-server-erpnext` | Mock ERPNext |
| `mcp-server-zammad` | Mock Zammad (helpdesk/ticket) |
| `mcp-server-gitea` | Kết nối Gitea thật (repo, issue...) |
| `mcp-server-rag` | Tìm kiếm tài liệu nội bộ (RAG) |

Danh sách chi tiết 6 tool đọc PostgreSQL (search_customer, get_customer_orders, get_order_detail, get_revenue_summary, get_top_customers, get_product_sales_summary) xem tại [`docs/tools.md`](docs/tools.md). *(Lưu ý: tài liệu này hiện chỉ mô tả connector Postgres — cần bổ sung tool của các connector còn lại.)*

---

## 🧪 Build & Test

```bash
# Từng app
cd apps/mcp-gateway && npm run typecheck && npm run build && npm run test
cd apps/ai-orchestrator && npm run typecheck && npm run build && npm run test
cd apps/chat-ui && npm run typecheck && npm run build && npm run test

# E2E (Playwright) cho Chat UI
cd apps/chat-ui && npm run test:e2e

# Chạy toàn bộ test từ root
npm test
```

---

## 🚢 Triển khai Production

Đã có sẵn script và cấu hình triển khai production, dùng `docker-compose.prod.yml`:

```bash
cp .env.production.example .env   # nhớ đổi POSTGRES_PASSWORD, VAULT_TOKEN, GOOGLE_CLIENT_ID...
./deploy.sh          # Linux/macOS
# hoặc
./deploy.ps1          # Windows PowerShell
```

Xem chi tiết tại [`docs/DEPLOYMENT_GUIDE.md`](docs/DEPLOYMENT_GUIDE.md).

---

## 📌 Việc tiếp theo / nợ kỹ thuật

1. Cập nhật `docs/architecture.md`, `docs/project-guide.md`, `docs/setup.md`, `docs/tools.md` cho khớp với auth Bearer token, 6 service Docker và kiến trúc multi-connector hiện tại (các tài liệu này hiện vẫn mô tả bản MVP cũ).
2. Bổ sung tài liệu tool cho `mcp-server-crm`, `mcp-server-erpnext`, `mcp-server-zammad`, `mcp-server-gitea`, `mcp-server-rag`.
3. Dọn dẹp các file `.patch` ở thư mục gốc (đã merge thì xoá, chưa thì áp dụng hoặc lưu trong `docs/changelogs/`).
4. Xoá file rác không rõ nguồn gốc ở thư mục gốc repo (tên file trông giống commit message bị lưu nhầm).
5. Đổi `VAULT_TOKEN=root` / cấu hình Vault dev-mode trước khi dùng thật cho production.