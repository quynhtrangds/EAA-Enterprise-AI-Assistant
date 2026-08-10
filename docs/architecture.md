# Architecture

> Cập nhật cho nhánh `extended_phase`. Bản MVP ban đầu (auth bằng header `x-user`, 1 connector Postgres duy nhất, 4 service Docker) đã được thay thế bởi kiến trúc dưới đây.

Luồng xử lý:

```text
User Chat
-> Chat UI (đăng nhập username/password, Google SSO, hoặc guest)
-> AI Orchestrator (giữ Bearer token của user, gọi lại MCP Gateway)
-> MockLLMProvider / OpenAI Provider / Local LLM Provider (Ollama...)
-> MCP Gateway (xác thực Bearer token, kiểm tra RBAC, rate-limit)
-> McpClientManager (spawn + gọi các MCP server con qua giao thức MCP chuẩn - stdio)
-> mcp-server-postgres / mcp-server-crm / mcp-server-erpnext / mcp-server-zammad / mcp-server-gitea / mcp-server-rag
-> PostgreSQL Database / hệ thống bên thứ 3 tương ứng
```

Ranh giới quan trọng:

- LLM không kết nối database hay hệ thống nghiệp vụ trực tiếp.
- LLM không tự sinh SQL để chạy.
- Gateway chỉ expose các tool đã khai báo tường minh (`config/tools-config.ts`), phần lớn read-only.
- Mọi tool call đều phải qua xác thực Bearer token, kiểm tra permission (`tool_permissions`) và được ghi vào `audit_logs`.
- Gateway không tự thực thi nghiệp vụ — nó chỉ là lớp trung gian gọi các MCP server con qua `McpClientManager`.

## Chat UI

`apps/chat-ui` gồm:

- React/Vite TypeScript app.
- Màn hình đăng nhập (`components/auth/LoginScreen.tsx`) hỗ trợ 3 cách: username/password (`POST /api/login`), Google SSO (`@react-oauth/google` → `POST /api/auth/google`), và đăng nhập khách (`POST /api/auth/guest`).
- `AuthContext` lưu Bearer token trong bộ nhớ phiên làm việc của trình duyệt và đính kèm vào mọi request tới Orchestrator.
- Gọi `POST /api/chat` (qua Vite proxy) tới AI Orchestrator kèm header `Authorization: Bearer <token>`.
- Hiển thị hội thoại, quick prompts, loading/error, collapsible tool trace, danh sách phiên chat (`/api/chat/sessions`) và tìm kiếm lịch sử chat.
- Có bộ test E2E bằng Playwright (`e2e/`, chạy bằng `npm run test:e2e`).

## MCP Gateway

`apps/mcp-gateway` gồm:

- `routes/tools.ts`: các API xác thực (`/api/login`, `/api/auth/guest`, `/api/auth/google`, `/api/me`) và API tool (`/api/tools`, `/api/tools/call`, `/api/audit-logs`).
- `routes/chat.ts`: API lưu/đọc lịch sử hội thoại (`/api/chat/sessions`, `/api/chat/messages`).
- `routes/admin.ts`: API quản trị, chỉ dành cho role `admin` — quản lý user (`/api/admin/users`) và cấu hình integration bên thứ 3 (`/api/admin/integrations`, secret lưu qua Vault).
- `routes/mcp.ts`: kênh transport MCP chuẩn qua SSE (`/api/mcp/sse`, `/api/mcp/message`) cho client MCP bên ngoài kết nối trực tiếp.
- `connectors/mcp-client-manager.ts`: đọc `connector.json`, spawn từng MCP server con dưới dạng **subprocess riêng** (giao thức MCP chuẩn qua stdio, dùng `@modelcontextprotocol/sdk`), tổng hợp danh sách tool và định tuyến tool call tới đúng server.
- `auth/current-user.ts` + `auth/auth-sessions.ts`: xác thực bằng **Bearer token**, tra cứu phiên đăng nhập trong bảng `auth_sessions` (đã thay thế hoàn toàn header `x-user` của bản MVP cũ).
- `auth/passwords.ts`: hash mật khẩu bằng `scrypt` (không dùng plaintext hay bcrypt).
- `policies/tool-permissions.ts`: kiểm permission theo `role_code` + `tool_name` trong bảng `tool_permissions`; nếu tool chưa có bản ghi permission tường minh thì mặc định chỉ `admin` được phép.
- `policies/rate-limiter.ts`: giới hạn tần suất gọi tool theo user/tool.
- `masking/masking-service.ts`: che dữ liệu nhạy cảm (ví dụ secret) trước khi trả về client.
- `services/vault.ts`: đọc/ghi secret của integration trong HashiCorp Vault.
- `audit/audit-log.ts`: ghi mọi tool call (kể cả `request-start`, `success`, `failed`) vào bảng `audit_logs`.

> Note: Class `McpRuntime` (code cũ từ bản MVP 1.0) đã được dọn dẹp khỏi codebase. Toàn bộ tool hiện tại đều chạy qua `McpClientManager` (subprocess riêng theo giao thức MCP chuẩn).

## Permission theo seed mặc định

Dữ liệu mẫu trong `database/seed/seed.sql` (bảng `tool_permissions`) chỉ cấp quyền tường minh cho 6 tool của `mcp-server-postgres`:

- `admin`: toàn bộ 6 tool + xem audit log (`view_audit_logs`).
- `manager`: toàn bộ 6 tool nghiệp vụ (không có quyền xem audit log).
- `staff`: `search_customer`, `get_customer_orders`, `get_order_detail`.
- `viewer`: `get_revenue_summary`, `get_product_sales_summary`.

Tool của các MCP server con khác (`crm`, `erpnext`, `zammad`, `gitea`, `rag`) **chưa có bản ghi permission mẫu** — theo logic mặc định trong `canExecuteTool()`, chỉ `admin` gọi được các tool này cho đến khi bổ sung permission tương ứng.

## AI Orchestrator

`apps/ai-orchestrator` gồm:

- `routes/chat.ts`: API `/api/chat`, `/api/chat/edit`, `/api/chat/sessions`, `/api/chat/search`, `/api/chat/sessions/:sessionId`.
- `providers/mock-llm-provider.ts`: rule-based planner cho demo tiếng Việt, không cần API key.
- Provider OpenAI-compatible: dùng cho cả `LLM_PROVIDER=openai` lẫn `LLM_PROVIDER=local` (trỏ `LOCAL_LLM_BASE_URL` tới LLM chạy nội bộ, ví dụ Ollama).
- `gateway/mcp-gateway-client.ts`: gọi MCP Gateway để list/call tools, luôn forward Bearer token của user hiện tại.
- `services/chat-service.ts`: chọn provider theo `LLM_PROVIDER`, điều phối vòng lặp gọi tool (agentic loop, có giới hạn số vòng) và tạo câu trả lời cuối cùng.

Provider modes:

- `LLM_PROVIDER=mock`: dùng `MockLLMProvider`, giữ flow demo offline, không cần API key.
- `LLM_PROVIDER=openai`: khởi tạo client OpenAI bằng `OPENAI_API_KEY`, lấy tools thật từ MCP Gateway, chuyển `inputSchema` thành OpenAI Function Tools, thực thi `tool_calls` qua Gateway (nhiều vòng liên tiếp nếu cần), rồi đưa kết quả về LLM để tổng hợp câu trả lời tiếng Việt.
- `LLM_PROVIDER=local`: giống chế độ `openai` nhưng trỏ tới endpoint tương thích OpenAI chạy nội bộ (`LOCAL_LLM_BASE_URL`), phù hợp khi dùng LLM on-premise/offline (ví dụ Ollama).

Trong cả ba mode, Orchestrator không truy cập PostgreSQL hay hệ thống nghiệp vụ trực tiếp. Mọi dữ liệu đều đi qua MCP Gateway, permission và audit log.

## Bảo mật secret (Vault)

API key/URL của từng integration bên thứ 3 theo từng tenant (CRM, ERPNext, Zammad, Gitea...) được lưu trong **HashiCorp Vault**, PostgreSQL chỉ giữ `vault_path` tham chiếu tới secret. Response API luôn che secret (chỉ hiện 4 ký tự cuối). Admin cấu hình qua `POST /api/admin/integrations`.

## Multi-tenant

Bảng `users`, `tenant_integrations`, `chat_sessions`... đều có `tenant_id`. Mỗi user thuộc một tenant; các API list (`/api/admin/users`, `/api/admin/integrations`, `/api/chat/sessions`...) đều lọc theo `tenant_id` của user hiện tại.

## Runtime local

`docker-compose.yml` có **6 service**:

- `postgres` — cơ sở dữ liệu chính (users, chat history, audit logs, dữ liệu nghiệp vụ mẫu).
- `mcp-gateway` — lớp trung gian RBAC + audit + kết nối MCP.
- `ai-orchestrator` — điều phối LLM + tool calling.
- `chat-ui` — giao diện người dùng.
- `vault` — HashiCorp Vault, lưu secret của integration (chế độ dev-server, không dùng cấu hình dev cho production).
- `gitea` — git server nội bộ, dùng bởi `mcp-server-gitea` để demo tool đọc repo/issue thật.
