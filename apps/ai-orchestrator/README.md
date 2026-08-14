# AI Orchestrator

Express service nhận câu hỏi chat, gọi MCP Gateway để lấy/gọi tools, và tổng hợp câu trả lời tiếng Việt bằng LLM.

## Cấu hình LLM Provider

Chỉnh sửa file `.env` (copy từ `.env.example`):

### Mock (mặc định — không cần API key)

```env
LLM_PROVIDER=mock
```

Dùng để phát triển local, trả lời cứng không gọi API bên ngoài.

### Google Gemini (khuyên dùng)

```env
LLM_PROVIDER=gemini
GEMINI_API_KEY=AIzaSy...         # Lấy tại https://aistudio.google.com/app/apikey
GEMINI_MODEL=gemini-2.0-flash    # Hoặc: gemini-1.5-flash
```

### OpenAI

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini
```

### LLM cục bộ (Ollama, LM Studio, v.v.)

```env
LLM_PROVIDER=local
LOCAL_LLM_BASE_URL=http://localhost:1234/v1
OPENAI_MODEL=tên-model-local
```

## Luồng xử lý (Gemini/OpenAI/Local)

1. Nhận `POST /api/chat` với `message` và `sessionId` từ Chat UI
2. Gọi `GET /api/tools` lên MCP Gateway để lấy danh sách tools theo quyền user
3. Chuyển `inputSchema` của mỗi tool thành Function Tool tương thích OpenAI
4. Gửi câu hỏi + danh sách tools lên LLM
5. Nếu LLM trả về `tool_calls`, gọi `POST /api/tools/call` trên MCP Gateway
6. Gửi kết quả tool về LLM để tổng hợp câu trả lời cuối bằng tiếng Việt
7. Trả kết quả về Chat UI

Lỗi API key / mạng / LLM sẽ được trả về qua error code `LLM_ERROR`.

## Biến môi trường

| Biến                  | Mặc định                    | Mô tả                              |
|-----------------------|-----------------------------|------------------------------------|
| `PORT`                | `8082`                      | Cổng service                       |
| `MCP_GATEWAY_URL`     | `http://127.0.0.1:8081`     | URL MCP Gateway                    |
| `LLM_PROVIDER`        | `mock`                      | `mock`, `gemini`, `openai`, `local`|
| `GEMINI_API_KEY`      | —                           | API key Google AI Studio           |
| `GEMINI_MODEL`        | `gemini-2.0-flash`          | Tên model Gemini                   |
| `OPENAI_API_KEY`      | —                           | API key OpenAI                     |
| `OPENAI_MODEL`        | `gpt-4.1-mini`              | Tên model OpenAI                   |
| `LOCAL_LLM_BASE_URL`  | —                           | Base URL cho LLM cục bộ            |
| `MAX_TOOL_CALL_ROUNDS`| `5`                         | Số vòng tool call tối đa           |
| `POSTGRES_HOST`       | `localhost`                 | Host DB (dùng `postgres` trong Docker) |

## Chạy local

```powershell
npm install
npm run dev
```

## API

```http
GET  /health     # Kiểm tra service
POST /api/chat   # Gửi câu hỏi chat
```

Xem chi tiết tại [../../docs/api.md](../../docs/api.md).
