# Huong dan thuc hien du an Enterprise AI Assistant MCP PostgreSQL

## 1. Muc tieu du an

Xay dung MVP cho mot Enterprise AI Assistant co kha nang nhan cau hoi tieng Viet tu nguoi dung, goi tool thong qua kien truc MCP de truy van du lieu PostgreSQL, sau do tra loi dua tren du lieu that.

MVP chi ho tro doc du lieu. Khong ho tro them, sua, xoa.

Luong tong the:

```text
User Chat
-> Chat UI
-> AI Orchestrator
-> MCP Gateway
-> MCP Runtime
-> PostgreSQL Connector
-> PostgreSQL Database
```

Nguyen tac quan trong nhat:

```text
LLM khong truy cap database truc tiep.
LLM khong duoc sinh SQL de chay.
LLM chi duoc goi cac business tools da duoc kiem soat.
Moi tool call phai co permission va audit log.
```

## 2. Tech stack du kien

Stack chinh:

```text
Backend: Node.js 20+ + TypeScript
API framework: Express
Validation: Zod
Database: PostgreSQL 15+
Database client: pg
Frontend: React + Vite + TypeScript
CSS: Tailwind CSS
LLM: MockLLMProvider truoc, OpenAIProvider sau
Runtime: Docker Compose
Testing: Vitest
```

Ly do chon stack:

```text
Express de hoc va de demo.
TypeScript giup ro kieu du lieu.
Zod phu hop validate input tool.
pg giup kiem soat SQL read-only va parameterized query.
MockLLMProvider giup test end-to-end khong can API key.
```

## 3. Cau truc thu muc

Project nam tai:

```text
C:\2025-2026\SPEC_MPV
```

Cau truc:

```text
SPEC_MPV
├── apps
│   ├── chat-ui
│   ├── ai-orchestrator
│   └── mcp-gateway
├── database
│   ├── migrations
│   ├── seed
│   └── schema.sql
├── docs
│   ├── architecture.md
│   ├── api.md
│   ├── tools.md
│   ├── setup.md
│   └── project-guide.md
├── docker-compose.yml
├── .env.example
└── README.md
```

## 4. Phan cong cho 2 thanh vien

### Thanh vien 1: Database + PostgreSQL Connector + MCP Runtime + MCP Gateway

Pham vi:

```text
database/schema.sql
database/seed/seed.sql
apps/mcp-gateway
```

Nhiem vu:

```text
1. Thiet ke PostgreSQL schema.
2. Tao seed data.
3. Implement PostgreSQL Connector.
4. Implement 6 tools read-only.
5. Implement MCP Runtime.
6. Implement MCP Gateway API.
7. Implement permission theo role.
8. Implement audit log.
9. Viet test co ban cho tools va gateway.
```

Ket qua ban giao:

```text
PostgreSQL schema chay duoc.
Seed data du de demo.
6 tools read-only hoat dong.
Gateway API list/call tools hoat dong.
Permission va audit log hoat dong.
```

### Thanh vien 2: AI Orchestrator + Chat UI + Demo Flow

Pham vi:

```text
apps/ai-orchestrator
apps/chat-ui
```

Nhiem vu:

```text
1. Tao AI Orchestrator API.
2. Tao LLMProvider interface.
3. Implement MockLLMProvider.
4. Sau do implement OpenAIProvider neu co API key.
5. Goi MCP Gateway de lay tool list.
6. Goi MCP Gateway de execute tool.
7. Tao React Chat UI.
8. Hien thi hoi thoai, loading, error, tool call trace.
9. Test flow chat end-to-end.
```

Ket qua ban giao:

```text
POST /api/chat hoat dong.
UI gui cau hoi va hien thi cau tra loi.
UI hien thi tool call trace.
MockLLMProvider demo duoc cac cau hoi mau.
```

## 5. Database

File schema:

```text
database/schema.sql
```

Da co cac bang:

```text
customers
products
orders
order_items
payments
users
roles
user_roles
tool_permissions
audit_logs
```

Can tao seed data tai:

```text
database/seed/seed.sql
```

Seed data toi thieu de test nhanh:

```text
4 users: admin, manager, staff, viewer
4 roles: admin, manager, staff, viewer
permissions cho tung role
5 customers
5 products
10 orders
20 order_items
10 payments
```

Seed data muc tieu theo spec:

```text
50 customers
30 products
300 orders
700 order_items
250 payments
4 users
4 roles
tool permissions theo role
```

Trang thai don hang mau:

```text
draft
confirmed
paid
shipping
completed
cancelled
```

Phuong thuc thanh toan mau:

```text
cash
bank_transfer
card
e_wallet
```

## 6. PostgreSQL Connector

Connector chi expose business tools an toan. Khong expose raw SQL.

Khong duoc lam:

```text
run_sql(query)
execute_query(sql)
raw_database_access
```

6 tools MVP:

```text
search_customer
get_customer_orders
get_order_detail
get_revenue_summary
get_top_customers
get_product_sales_summary
```

Moi tool can co:

```text
name
title
description
inputSchema
outputSchema
riskLevel
readOnly
requiresConfirmation
execute()
```

Interface de xuat:

```ts
export interface McpTool {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  outputSchema?: object;
  riskLevel: 'low' | 'medium' | 'high';
  readOnly: boolean;
  requiresConfirmation: boolean;
  execute(input: unknown, context: ToolContext): Promise<unknown>;
}

export interface ToolContext {
  userId: string;
  username: string;
  roles: string[];
  sessionId: string;
  requestId: string;
}
```

Nguyen tac query:

```text
Chi dung SELECT.
Dung parameterized query.
Khong string concat SQL voi input nguoi dung.
Moi tool co input schema.
Moi tool validate input.
Moi tool co limit mac dinh va limit toi da.
Tool loi khong tra stack trace ra UI.
```

Vi du dung:

```ts
const result = await db.query(
  `
  SELECT id, customer_code, full_name, phone, email, status
  FROM customers
  WHERE full_name ILIKE $1
     OR phone ILIKE $1
     OR customer_code ILIKE $1
  LIMIT $2
  `,
  [`%${keyword}%`, limit]
);
```

## 7. Tool details

### search_customer

Muc dich:

```text
Tim khach hang theo ten, so dien thoai hoac ma khach hang.
```

Input:

```json
{
  "keyword": "string",
  "limit": 5
}
```

Rule:

```text
limit mac dinh 5
limit toi da 20
```

### get_customer_orders

Muc dich:

```text
Lay danh sach don hang cua mot khach hang.
```

Input:

```json
{
  "customerId": "uuid",
  "fromDate": "yyyy-mm-dd",
  "toDate": "yyyy-mm-dd",
  "limit": 10
}
```

Rule:

```text
Neu khong truyen fromDate/toDate thi lay 90 ngay gan nhat.
limit mac dinh 10
limit toi da 50
```

### get_order_detail

Muc dich:

```text
Xem chi tiet don hang theo ma don hang.
```

Input:

```json
{
  "orderCode": "ORD-001"
}
```

Can tra:

```text
Thong tin don hang
Thong tin khach hang
Danh sach items
Danh sach payments
```

### get_revenue_summary

Muc dich:

```text
Tong hop doanh thu theo khoang ngay.
```

Input:

```json
{
  "fromDate": "yyyy-mm-dd",
  "toDate": "yyyy-mm-dd",
  "groupBy": "day"
}
```

groupBy hop le:

```text
day
month
payment_method
```

Rule:

```text
Chi tinh payment status = paid.
Khong cho query qua 1 nam trong MVP.
```

### get_top_customers

Muc dich:

```text
Lay danh sach khach hang mua nhieu nhat theo doanh thu.
```

Input:

```json
{
  "fromDate": "yyyy-mm-dd",
  "toDate": "yyyy-mm-dd",
  "limit": 5
}
```

Rule:

```text
limit mac dinh 5
limit toi da 20
```

### get_product_sales_summary

Muc dich:

```text
Thong ke san pham ban chay.
```

Input:

```json
{
  "fromDate": "yyyy-mm-dd",
  "toDate": "yyyy-mm-dd",
  "limit": 10
}
```

## 8. MCP Runtime

Runtime quan ly va thuc thi tool.

Can implement:

```text
registerConnector(connector)
listTools()
getTool(toolName)
callTool(toolName, input, context)
validateInput(tool.inputSchema, input)
validateOutput(tool.outputSchema, output)
handleError(error)
```

Loi chuan:

```text
TOOL_NOT_FOUND
INVALID_TOOL_INPUT
PERMISSION_DENIED
CONNECTOR_ERROR
TOOL_TIMEOUT
```

Luong callTool:

```text
1. Nhan toolName, input, context.
2. Kiem tra tool ton tai.
3. Validate input schema.
4. Goi execute() cua tool.
5. Validate output neu co schema.
6. Tra output chuan hoa.
7. Neu loi, map sang errorCode chuan.
```

## 9. MCP Gateway

Gateway la API layer de AI Orchestrator goi.

API can co:

```http
GET /api/tools
POST /api/tools/call
GET /api/audit-logs
```

### GET /api/tools

Muc dich:

```text
Tra danh sach tool ma user hien tai co quyen goi.
```

Response mau:

```json
{
  "tools": [
    {
      "name": "search_customer",
      "title": "Search Customer",
      "description": "Find customer by name, phone or customer code",
      "riskLevel": "low",
      "readOnly": true,
      "requiresConfirmation": false,
      "inputSchema": {}
    }
  ]
}
```

### POST /api/tools/call

Request:

```json
{
  "toolName": "search_customer",
  "arguments": {
    "keyword": "Nguyen Van A",
    "limit": 5
  },
  "sessionId": "session-001"
}
```

Response thanh cong:

```json
{
  "success": true,
  "toolName": "search_customer",
  "data": {
    "customers": []
  },
  "durationMs": 35
}
```

Response loi:

```json
{
  "success": false,
  "toolName": "search_customer",
  "errorCode": "INVALID_TOOL_INPUT",
  "message": "limit must be less than or equal to 20"
}
```

Luong xu ly:

```text
1. Nhan toolName, arguments, sessionId.
2. Lay user hien tai.
3. Kiem tra user co dang nhap khong.
4. Lay roles cua user.
5. Kiem tra role co quyen execute tool khong.
6. Goi MCP Runtime.
7. Ghi audit log success hoac failed.
8. Tra response chuan hoa.
```

### GET /api/audit-logs

Query params:

```text
fromDate
toDate
toolName
userId
status
```

Chi admin duoc xem audit log trong MVP.

## 10. Authentication va permission MVP

Dang nhap gia lap.

Users:

```text
admin / admin123
manager / manager123
staff / staff123
viewer / viewer123
```

Trong MVP co the truyen user qua header:

```http
x-user: admin
```

Hoac:

```http
x-user-id: <uuid>
```

Permission:

```text
admin:
- tat ca read-only tools
- xem audit log

manager:
- search_customer
- get_customer_orders
- get_order_detail
- get_revenue_summary
- get_top_customers
- get_product_sales_summary

staff:
- search_customer
- get_customer_orders
- get_order_detail

viewer:
- get_revenue_summary
- get_product_sales_summary
```

Neu khong co quyen:

```json
{
  "success": false,
  "errorCode": "PERMISSION_DENIED",
  "message": "Ban khong co quyen goi tool nay."
}
```

## 11. Audit log

Moi tool call phai ghi audit log.

Thong tin can luu:

```text
user_id
session_id
tool_name
input_json
output_json
status
error_message
duration_ms
created_at
```

Thanh cong:

```text
status = success
error_message = null
```

That bai:

```text
status = failed
error_message = noi dung loi da chuan hoa
```

Luu y:

```text
MVP co the luu full input/output.
Ban enterprise sau nay can masking phone, email, CCCD, tai khoan, luong, hop dong.
```

## 12. AI Orchestrator

API:

```http
POST /api/chat
GET /api/chat/sessions
GET /api/chat/sessions/:sessionId
```

Luong POST /api/chat:

```text
1. Nhan sessionId va message.
2. Goi Gateway GET /api/tools de lay danh sach tool user co quyen.
3. Gui prompt + tool definitions cho LLM.
4. Neu LLM can goi tool, Orchestrator goi Gateway POST /api/tools/call.
5. Lay ket qua tool.
6. Gui ket qua tool ve LLM de tong hop cau tra loi cuoi.
7. Tra answer + toolCalls ve Chat UI.
```

Request:

```json
{
  "sessionId": "session-001",
  "message": "Hom nay doanh thu bao nhieu?"
}
```

Response:

```json
{
  "sessionId": "session-001",
  "answer": "Hom nay doanh thu la 12.500.000 VND.",
  "toolCalls": [
    {
      "toolName": "get_revenue_summary",
      "arguments": {
        "fromDate": "2026-07-06",
        "toDate": "2026-07-06",
        "groupBy": "day"
      },
      "success": true,
      "durationMs": 42
    }
  ]
}
```

LLMProvider interface:

```ts
export interface LLMProvider {
  chat(input: ChatInput): Promise<ChatOutput>;
}
```

Nen lam MockLLMProvider truoc:

```text
Neu message co "doanh thu" -> get_revenue_summary
Neu message co "top" va "khach hang" -> get_top_customers
Neu message co "ORD-" -> get_order_detail
Neu message co "san pham ban chay" -> get_product_sales_summary
Neu message co "khach hang" -> search_customer
```

Sau khi flow chay on, moi tich hop OpenAIProvider.

## 13. Chat UI

Can co:

```text
Sidebar danh sach session
Khung hoi thoai
O nhap message
Nut gui
Quick prompts
Loading state
Error state
Vung hien thi tool call trace
```

Quick prompts:

```text
Hom nay doanh thu bao nhieu?
Top 5 khach hang mua nhieu nhat thang nay la ai?
Don hang ORD-001 co trang thai gi?
Khach hang Nguyen Van A co nhung don hang nao?
San pham nao ban chay nhat thang nay?
```

Tool trace dang collapsible:

```text
Tool called: get_revenue_summary
Input: {...}
Status: success
Duration: 42ms
```

## 14. Docker Compose

Can co cac service:

```text
postgres
mcp-gateway
ai-orchestrator
chat-ui
```

.env.example can co:

```env
POSTGRES_HOST=localhost
POSTGRES_PORT=55432
POSTGRES_DB=enterprise_ai_demo
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

MCP_GATEWAY_PORT=8081
AI_ORCHESTRATOR_PORT=8082
CHAT_UI_PORT=3000

LLM_PROVIDER=mock
OPENAI_API_KEY=your_api_key_here
LOCAL_LLM_BASE_URL=http://localhost:1234/v1
```

## 15. Thu tu thuc hien de xuat

### Ngay 1

```text
1. Tao project structure.
2. Chot tech stack.
3. Chot API contract.
4. Viet schema.sql.
5. Tao README ban dau.
```

### Ngay 2

Thanh vien 1:

```text
1. Tao seed.sql ban nho.
2. Setup PostgreSQL local hoac Docker.
3. Chay schema va seed.
4. Viet db connection cho mcp-gateway.
```

Thanh vien 2:

```text
1. Setup ai-orchestrator.
2. Setup chat-ui.
3. Tao mock /api/chat tra response gia.
4. UI goi duoc /api/chat.
```

### Ngay 3

Thanh vien 1:

```text
1. Implement PostgreSQL Connector.
2. Implement search_customer.
3. Implement get_order_detail.
4. Test query bang API hoac script.
```

Thanh vien 2:

```text
1. Implement MockLLMProvider.
2. Implement tool call planning don gian.
3. Chuan bi UI tool trace.
```

### Ngay 4

Thanh vien 1:

```text
1. Implement du 6 tools.
2. Implement MCP Runtime.
3. Validate input bang Zod.
```

Thanh vien 2:

```text
1. Orchestrator goi GET /api/tools.
2. Orchestrator goi POST /api/tools/call.
3. Tra answer + toolCalls ve UI.
```

### Ngay 5

Thanh vien 1:

```text
1. Implement permission.
2. Implement audit log.
3. Implement GET /api/audit-logs.
```

Thanh vien 2:

```text
1. Hoan thien Chat UI.
2. Hien thi loading/error/tool trace.
3. Them quick prompts.
```

### Ngay 6

Ca nhom:

```text
1. Tich hop end-to-end.
2. Fix loi API contract.
3. Them Docker Compose.
4. Viet docs setup/api/tools.
```

### Ngay 7

Ca nhom:

```text
1. Chay test cases.
2. Chuan bi demo.
3. Polish UI vua du.
4. Hoan thien README.
```

## 16. Test cases bat buoc

### search_customer

Input:

```json
{
  "keyword": "Nguyen",
  "limit": 5
}
```

Ky vong:

```text
Tra toi da 5 customers.
Khong loi.
Co audit log success.
```

### Limit vuot muc

Input:

```json
{
  "keyword": "Nguyen",
  "limit": 999
}
```

Ky vong:

```text
Tra INVALID_TOOL_INPUT hoac clamp ve 20.
Khong query qua 20 dong.
```

Quyet dinh hien tai:

```text
Uu tien tra INVALID_TOOL_INPUT de loi ro rang.
```

### User khong co quyen

```text
User: viewer
Tool: search_customer
```

Ky vong:

```text
Tra PERMISSION_DENIED.
Co audit log status failed.
```

### get_revenue_summary

Input:

```json
{
  "fromDate": "2026-07-01",
  "toDate": "2026-07-31",
  "groupBy": "day"
}
```

Ky vong:

```text
Co totalRevenue.
Co totalOrders.
Co groups theo ngay.
Chi tinh payment status = paid.
```

### Chat UI

Cau hoi:

```text
Hom nay doanh thu bao nhieu?
```

Ky vong:

```text
AI goi get_revenue_summary.
UI hien thi cau tra loi.
UI hien thi tool call trace.
Audit log duoc ghi.
```

## 17. Checklist hoan thanh MVP

```text
[ ] Chay duoc bang docker compose hoac setup ro rang.
[ ] Co PostgreSQL schema.
[ ] Co seed data.
[ ] Co 6 tools read-only.
[ ] Khong co raw SQL tool.
[ ] Co MCP Runtime.
[ ] Co MCP Gateway API.
[ ] Co permission theo role.
[ ] Co audit log cho moi tool call.
[ ] Co AI Orchestrator.
[ ] Co Chat UI.
[ ] User hoi bang tieng Viet.
[ ] AI tra loi dua tren PostgreSQL.
[ ] UI hien thi tool call trace.
[ ] Co README.
[ ] Co docs/tools.md.
[ ] Co docs/api.md.
[ ] Co test co ban.
```

## 18. Cac cau hoi can chot them

Can hoi va update vao file nay khi co cau tra loi:

```text
1. Nhom se dung npm workspace, pnpm workspace, hay tung app rieng le?
2. Backend se chot Express hay Fastify?
3. Database chay bang Docker hay cai PostgreSQL local?
4. MVP co can login UI that khong, hay chi dung header x-user?
5. LLM demo se dung MockLLMProvider, OpenAI API, hay local LLM?
6. Co bat buoc docker compose chay full 4 service trong demo dau tien khong?
7. Quy uoc ngay "hom nay" trong seed/demo la ngay hien tai hay ngay co data co dinh?
```

## 19. Quyet dinh tam thoi

Da chot cho MVP:

```text
Backend framework: Express.
Database: PostgreSQL chay bang Docker.
Auth MVP: dung header x-user.
LLM giai doan dau: MockLLMProvider.
LLM demo cuoi: OpenAIProvider neu co API key.
Validation: Zod.
Database client: pg.
Frontend: React + Vite + TypeScript + Tailwind CSS.
Limit vuot muc: tra INVALID_TOOL_INPUT.
Ngay demo: dung ngay hien tai cua he thong.
```

Ly do chon:

```text
Express de hoc, nhanh lam MVP, nhieu tai lieu.
Docker PostgreSQL giup 2 may co moi truong giong nhau va de demo bang docker-compose.
Header x-user giup tap trung vao permission/tool/audit thay vi mat thoi gian lam auth that.
MockLLMProvider giup test end-to-end on dinh, khong can API key va khong phu thuoc mang.
OpenAIProvider chi them sau khi core flow da chay on.
```

Lo trinh theo quyet dinh nay:

```text
Phase 1: Express + Docker PostgreSQL + x-user + MockLLMProvider.
Phase 2: Hoan thien schema, seed, 6 tools, MCP Runtime, Gateway.
Phase 3: Hoan thien AI Orchestrator va Chat UI voi tool trace.
Phase 4: Tich hop OpenAIProvider neu co API key.
Phase 5: Neu con thoi gian moi them login UI that.
```
