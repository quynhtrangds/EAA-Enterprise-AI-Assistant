# AI Orchestrator

Express service nhan cau hoi chat, goi MCP Gateway de lay/call tools, va tong hop cau tra loi tieng Viet.

## LLM provider

Mac dinh service dung `MockLLMProvider`:

```env
LLM_PROVIDER=mock
```

De dung OpenAI provider that:

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini
```

OpenAI flow:

1. Goi MCP Gateway `GET /api/tools` theo header `x-user`.
2. Chuyen moi tool thanh OpenAI Function Tool, dung `inputSchema` cua Gateway lam `parameters`.
3. Gui cau hoi va danh sach tools len OpenAI.
4. Neu OpenAI tra `tool_calls`, Orchestrator goi Gateway `POST /api/tools/call`.
5. Gui ket qua tool ve OpenAI de tong hop cau tra loi cuoi bang tieng Viet.

Neu thieu `OPENAI_API_KEY`, loi mang, hoac OpenAI API loi, service nem `LLM_ERROR`.

```powershell
npm install
npm run dev
```

Health:

```http
GET /health
```

Chat:

```http
POST /api/chat
```
