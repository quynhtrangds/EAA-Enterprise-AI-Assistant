# API Contract

Base URL local:

```text
MCP Gateway:     http://127.0.0.1:8081
AI Orchestrator: http://127.0.0.1:8082
```

Xác thực dùng Bearer token (lấy qua `/api/auth/login`):

```http
Authorization: Bearer <token>
```

---

## Auth (AI Orchestrator)

### POST /api/auth/login

```json
{
  "username": "admin",
  "password": "admin123"
}
```

Response:

```json
{
  "token": "...",
  "user": { "username": "admin", "displayName": "...", "roles": ["admin"] }
}
```

### POST /api/auth/logout

Huỷ session hiện tại. Header: `Authorization: Bearer <token>`.

---

## MCP Gateway

### GET /health

```json
{ "status": "ok", "service": "mcp-gateway" }
```

### GET /api/tools

Trả danh sách tools user hiện tại có quyền gọi. Mỗi tool gồm metadata và `inputSchema` (JSON Schema) để AI Orchestrator chuyển thành Function Tool.

```powershell
Invoke-RestMethod -Headers @{ 'Authorization'='Bearer <token>' } http://127.0.0.1:8081/api/tools
```

Response mẫu:

```json
{
  "tools": [
    {
      "name": "search_customer",
      "title": "Tìm khách hàng",
      "description": "Tìm khách hàng theo tên, SĐT, email hoặc mã khách hàng.",
      "riskLevel": "low",
      "readOnly": true,
      "requiresConfirmation": false,
      "inputSchema": {
        "type": "object",
        "properties": {
          "keyword": { "type": "string", "minLength": 1 },
          "limit": { "type": "integer", "minimum": 1, "maximum": 20 }
        },
        "required": ["keyword"],
        "additionalProperties": false
      }
    }
  ]
}
```

### POST /api/tools/call

Request:

```json
{
  "toolName": "search_customer",
  "arguments": { "keyword": "Nguyễn", "limit": 5 },
  "sessionId": "session-001"
}
```

Response thành công:

```json
{
  "success": true,
  "toolName": "search_customer",
  "data": { "customers": [...] },
  "durationMs": 35
}
```

Response lỗi:

```json
{
  "success": false,
  "errorCode": "PERMISSION_DENIED",
  "message": "Bạn không có quyền gọi tool này."
}
```

### GET /api/audit-logs

Chỉ role `admin` có permission `view_audit_logs` mới xem được.

Query params: `fromDate`, `toDate`, `toolName`, `userId`, `status=success|failed`

---

## AI Orchestrator

### GET /health

```json
{ "status": "ok", "service": "ai-orchestrator" }
```

### POST /api/chat

Request:

```json
{
  "sessionId": "chat-001",
  "message": "Hôm nay doanh thu bao nhiêu?"
}
```

Response:

```json
{
  "sessionId": "chat-001",
  "answer": "Tổng doanh thu hôm nay là 26.800.000 VND với 1 đơn hàng đã thanh toán.",
  "toolCalls": [
    {
      "toolName": "get_revenue_summary",
      "arguments": { "fromDate": "2026-08-14", "toDate": "2026-08-14", "groupBy": "day" },
      "success": true,
      "durationMs": 81
    }
  ]
}
```

Lỗi LLM (API key sai, hết quota, mạng...):

```json
{
  "errorCode": "LLM_ERROR",
  "message": "Không thể kết nối đến LLM provider."
}
```
