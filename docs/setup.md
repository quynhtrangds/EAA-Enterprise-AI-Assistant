# Setup

## Yeu cau

- Node.js 20+
- Docker Desktop
- npm

## Chay full stack bang Docker Compose

```powershell
cd C:\2025-2026\SPEC_MPV
docker compose up -d
```

Kiem tra container:

```powershell
docker compose ps
```

URL mac dinh:

```text
Chat UI: http://127.0.0.1:3000
MCP Gateway: http://127.0.0.1:8081
AI Orchestrator: http://127.0.0.1:8082
PostgreSQL: localhost:55432
```

## Chay local tung app

Neu muon chay backend/UI truc tiep tren host, chay database truoc:

```powershell
cd C:\2025-2026\SPEC_MPV
docker compose up -d postgres
```

### MCP Gateway

```powershell
cd C:\2025-2026\SPEC_MPV\apps\mcp-gateway
npm install
npm run dev
```

Kiem tra:

```powershell
Invoke-RestMethod http://127.0.0.1:8081/health
```

### AI Orchestrator

Can chay MCP Gateway truoc.

```powershell
cd C:\2025-2026\SPEC_MPV\apps\ai-orchestrator
npm install
npm run dev
```

Mac dinh Orchestrator dung mock provider:

```env
LLM_PROVIDER=mock
```

Neu muon dung OpenAI provider that, them bien moi truong:

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini
```

Khi `LLM_PROVIDER=openai`, Orchestrator lay tools tu MCP Gateway, goi OpenAI Function Calling, thuc thi tool qua Gateway va tong hop cau tra loi tieng Viet. Neu thieu API key hoac loi OpenAI/mang, API tra `LLM_ERROR`.

Kiem tra:

```powershell
Invoke-RestMethod http://127.0.0.1:8082/health
```

### Chat UI

Can chay AI Orchestrator truoc.

```powershell
cd C:\2025-2026\SPEC_MPV\apps\chat-ui
npm install
npm run dev
```

Mo UI tai:

```text
http://127.0.0.1:3000
```

## Test chat API

```powershell
$body = @{ sessionId='chat-001'; message='Hom nay doanh thu bao nhieu?' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Headers @{ 'x-user'='manager' } -ContentType 'application/json' -Body $body http://127.0.0.1:8082/api/chat
```

## Lenh kiem tra code

Chay trong tung app:

```powershell
npm run typecheck
npm run build
```

Tren PowerShell neu gap loi execution policy voi `npm`, dung `npm.cmd`:

```powershell
npm.cmd run typecheck
```
