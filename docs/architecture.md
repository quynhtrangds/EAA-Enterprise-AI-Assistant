# Architecture

Luong MVP:

```text
User Chat
-> Chat UI
-> AI Orchestrator
-> MockLLMProvider hoac OpenAI Provider
-> MCP Gateway
-> MCP Runtime
-> PostgreSQL Connector
-> PostgreSQL Database
```

Ranh gioi quan trong:

- LLM khong ket noi database truc tiep.
- LLM khong sinh SQL de chay.
- Gateway chi expose business tools read-only.
- Moi tool call phai qua permission va audit log.

## Chat UI

`apps/chat-ui` gom:

- React/Vite TypeScript app.
- Chon user MVP: `admin`, `manager`, `staff`, `viewer`.
- Goi `POST /api/chat` qua Vite proxy toi AI Orchestrator.
- Hien thi hoi thoai, quick prompts, loading/error va collapsible tool trace.

## MCP Gateway

`apps/mcp-gateway` gom:

- `routes/tools.ts`: HTTP API `/api/tools`, `/api/tools/call`, `/api/audit-logs`.
- `runtime/mcp-runtime.ts`: dang ky va thuc thi tool.
- `connectors/postgres/tools/index.ts`: 6 PostgreSQL tools read-only.
- `auth/current-user.ts`: auth MVP bang header `x-user`.
- `policies/tool-permissions.ts`: kiem permission bang bang `tool_permissions`.
- `audit/audit-log.ts`: ghi bang `audit_logs`.

## Permission MVP

- `admin`: all tools va audit logs.
- `manager`: all business read-only tools.
- `staff`: customer/order lookup tools.
- `viewer`: revenue/product summary tools.

## AI Orchestrator

`apps/ai-orchestrator` gom:

- `routes/chat.ts`: API `/api/chat`, `/api/chat/sessions`, `/api/chat/sessions/:sessionId`.
- `providers/mock-llm-provider.ts`: rule-based planner cho demo tieng Viet.
- `gateway/mcp-gateway-client.ts`: goi MCP Gateway de list/call tools.
- `services/chat-service.ts`: chon provider theo `LLM_PROVIDER`, dieu phoi tool calls va tao answer.

Provider modes:

- `LLM_PROVIDER=mock`: dung `MockLLMProvider`, giu flow demo offline va khong can API key.
- `LLM_PROVIDER=openai`: khoi tao OpenAI client bang `OPENAI_API_KEY`, lay tools that tu MCP Gateway, chuyen `inputSchema` thanh OpenAI Function Tools, thuc thi `tool_calls` qua Gateway, roi dua ket qua ve OpenAI de tong hop cau tra loi tieng Viet.

Trong ca hai mode, Orchestrator khong truy cap PostgreSQL truc tiep. Moi du lieu nghiep vu deu di qua MCP Gateway, permission va audit log.

## Runtime local

`docker-compose.yml` co 4 service:

- `postgres`
- `mcp-gateway`
- `ai-orchestrator`
- `chat-ui`
