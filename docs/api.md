# API Contract

Base URL local:

```text
MCP Gateway: http://127.0.0.1:8081
AI Orchestrator: http://127.0.0.1:8082
```

Auth MVP dung header:

```http
x-user: admin | manager | staff | viewer
```

Neu khong truyen `x-user`, gateway tam thoi dung `admin` de tien demo local.

## GET /health

Response:

```json
{
  "status": "ok",
  "service": "mcp-gateway"
}
```

## GET /api/tools

Tra danh sach tool user hien tai co quyen goi. Moi tool gom metadata va `inputSchema` dang JSON Schema de AI Orchestrator co the nap truc tiep lam OpenAI Function Tool `parameters`.

```powershell
Invoke-RestMethod -Headers @{ 'x-user'='manager' } http://127.0.0.1:8081/api/tools
```

Response mau:

```json
{
  "tools": [
    {
      "name": "search_customer",
      "title": "Search Customer",
      "description": "Find customer by name, phone, email or customer code.",
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

## POST /api/tools/call

Request:

```json
{
  "toolName": "search_customer",
  "arguments": {
    "keyword": "Nguyen",
    "limit": 5
  },
  "sessionId": "session-001"
}
```

Success:

```json
{
  "success": true,
  "toolName": "search_customer",
  "data": {},
  "durationMs": 35
}
```

Error:

```json
{
  "success": false,
  "errorCode": "PERMISSION_DENIED",
  "message": "Ban khong co quyen goi tool nay."
}
```

## GET /api/audit-logs

Chi role `admin` co permission `view_audit_logs` moi xem duoc.

Query params:

```text
fromDate
toDate
toolName
userId
status=success|failed
```

## POST /api/chat

Service: AI Orchestrator.

Provider mac dinh la `LLM_PROVIDER=mock`. Khi cau hinh `LLM_PROVIDER=openai`, Orchestrator se:

1. Goi `GET /api/tools` de lay tool user duoc phep dung.
2. Chuyen `inputSchema` thanh OpenAI Function Tool `parameters`.
3. Xu ly `tool_calls` cua OpenAI bang `POST /api/tools/call`.
4. Gui ket qua tool ve OpenAI de tao cau tra loi tieng Viet.

Loi OpenAI/API key/mang duoc tra qua app error code `LLM_ERROR`.

Request:

```json
{
  "sessionId": "chat-001",
  "message": "Hom nay doanh thu bao nhieu?"
}
```

Response:

```json
{
  "sessionId": "chat-001",
  "answer": "Tong doanh thu trong khoang da chon la 26.800.000 VND voi 1 don hang da thanh toan.",
  "toolCalls": [
    {
      "toolName": "get_revenue_summary",
      "arguments": {
        "fromDate": "2026-07-06",
        "toDate": "2026-07-06",
        "groupBy": "day"
      },
      "success": true,
      "durationMs": 81
    }
  ]
}
```
