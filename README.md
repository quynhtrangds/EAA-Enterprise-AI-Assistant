# Trợ lý AI Doanh nghiệp với MCP PostgreSQL (Enterprise AI Assistant MCP PostgreSQL)

Bản demo MVP cho Trợ lý AI doanh nghiệp bằng tiếng Việt. Mô hình ngôn ngữ lớn (LLM) và Bộ điều phối (AI Orchestrator) không truy cập trực tiếp vào cơ sở dữ liệu. Mọi truy vấn dữ liệu đều phải đi qua MCP Gateway và các công cụ nghiệp vụ (business tools) ở chế độ chỉ đọc (read-only) để đảm bảo an toàn thông tin.

---

##  Yêu cầu hệ thống trước khi cài đặt

Đảm bảo máy tính của bạn đã được cài đặt đầy đủ các công cụ sau:
1. **Node.js 20+**
2. **Docker Desktop** (đã được khởi động)
3. **npm** (thường đi kèm khi cài đặt Node.js)

---

##  Hướng dẫn chạy dự án từ đầu

Có hai cách để khởi chạy dự án: sử dụng **Docker Compose** để chạy nhanh toàn bộ các dịch vụ hoặc **chạy cục bộ (local)** từng ứng dụng để phục vụ mục đích phát triển và debug.

### Cách 1: Chạy nhanh toàn bộ bằng Docker Compose

Cách này sẽ tự động khởi dựng cơ sở dữ liệu PostgreSQL (đã được tạo bảng và nạp dữ liệu mẫu), MCP Gateway, AI Orchestrator và giao diện Chat UI.

1. Mở terminal (ví dụ: PowerShell hoặc Command Prompt) và di chuyển vào thư mục dự án:
   ```powershell
   cd C:\2025-2026\SPEC_MPV
   ```

2. Khởi chạy toàn bộ hệ thống bằng Docker Compose:
   ```powershell
   docker compose up -d
   ```

3. Kiểm tra xem tất cả các container đã chạy thành công chưa:
   ```powershell
   docker compose ps
   ```

4. Các địa chỉ URL mặc định để truy cập:
   * **Chat UI (Giao diện người dùng):** [http://127.0.0.1:3000](http://127.0.0.1:3000)
   * **MCP Gateway:** [http://127.0.0.1:8081](http://127.0.0.1:8081)
   * **AI Orchestrator:** [http://127.0.0.1:8082](http://127.0.0.1:8082)
   * **PostgreSQL (Cổng kết nối):** `localhost:55432`

---

### Cách 2: Chạy cục bộ (local) từng ứng dụng

Sử dụng cách này khi bạn muốn chỉnh sửa mã nguồn và kiểm tra các thay đổi ngay lập tức nhờ chế độ hot-reload.

#### Bước 1: Khởi động cơ sở dữ liệu PostgreSQL bằng Docker
Chạy lệnh sau tại thư mục gốc của dự án để khởi động cơ sở dữ liệu cùng với các file cấu hình bảng (`schema.sql`) và dữ liệu mẫu (`seed.sql`):
```powershell
cd C:\2025-2026\SPEC_MPV
docker compose up -d postgres
```

#### Bước 2: Cài đặt và chạy ứng dụng MCP Gateway
Mở cửa sổ terminal mới và thực hiện:
```powershell
cd C:\2025-2026\SPEC_MPV\apps\mcp-gateway
npm install
npm run dev
```
*Bạn có thể kiểm tra xem Gateway hoạt động chưa bằng cách truy cập: [http://127.0.0.1:8081/health](http://127.0.0.1:8081/health).*

#### Bước 3: Cài đặt và chạy ứng dụng AI Orchestrator
Mở cửa sổ terminal mới thứ hai và thực hiện:
```powershell
cd C:\2025-2026\SPEC_MPV\apps\ai-orchestrator
npm install
npm run dev
```
*Bạn có thể kiểm tra xem Orchestrator hoạt động chưa bằng cách truy cập: [http://127.0.0.1:8082/health](http://127.0.0.1:8082/health).*

#### Bước 4: Cài đặt và chạy giao diện Chat UI
Mở cửa sổ terminal mới thứ ba và thực hiện:
```powershell
cd C:\2025-2026\SPEC_MPV\apps\chat-ui
npm install
npm run dev
```
*Mở trình duyệt và truy cập giao diện chat tại: [http://127.0.0.1:3000](http://127.0.0.1:3000).*

---

##  Cấu hình mô hình ngôn ngữ lớn (LLM)

Mặc định, AI Orchestrator sử dụng **Mock Provider** để chạy demo offline không cần kết nối internet và không mất phí:
```env
LLM_PROVIDER=mock
```

Nếu muốn kết nối với mô hình **OpenAI** thực tế:
1. Tạo một file `.env` tại đường dẫn `apps/ai-orchestrator/.env`.
2. Điền khóa API và cấu hình như sau:
   ```env
   LLM_PROVIDER=openai
   OPENAI_API_KEY=sk-tên_khóa_api_của_bạn_ở_đây
   OPENAI_MODEL=gpt-4o-mini
   ```

Ở chế độ OpenAI, Orchestrator sẽ lấy danh sách các công cụ khả dụng từ MCP Gateway bằng `GET /api/tools`, chuyển đổi `inputSchema` thành cấu trúc OpenAI Function Tools, thực thi các công cụ qua `POST /api/tools/call`, sau đó truyền kết quả trả về cho OpenAI để tổng hợp thành câu trả lời bằng tiếng Việt cho người dùng.

---

##  Lệnh kiểm tra nhanh API (PowerShell)

### 1. Lấy danh sách các công cụ theo quyền của từng User:
```powershell
Invoke-RestMethod -Headers @{ 'x-user'='manager' } http://127.0.0.1:8081/api/tools
```

### 2. Gọi trực tiếp một công cụ (Tool Call):
```powershell
$body = @{
  toolName='search_customer'
  arguments=@{ keyword='Nguyen'; limit=5 }
  sessionId='session-001'
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Method Post `
  -Headers @{ 'x-user'='staff' } `
  -ContentType 'application/json' `
  -Body $body `
  http://127.0.0.1:8081/api/tools/call
```

### 3. Xem lịch sử log (chỉ tài khoản Admin mới có quyền truy cập):
```powershell
Invoke-RestMethod -Headers @{ 'x-user'='admin' } http://127.0.0.1:8081/api/audit-logs
```

### 4. Gửi câu hỏi chat đến Orchestrator:
```powershell
$body = @{
  sessionId='chat-001'
  message='Hôm nay doanh thu bao nhiêu?'
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Headers @{ 'x-user'='manager' } `
  -ContentType 'application/json' `
  -Body $body `
  http://127.0.0.1:8082/api/chat
```

---

##  Kiểm tra mã nguồn (Build & Test)

Dự án sử dụng TypeScript và Vitest để thực hiện kiểm tra lỗi kiểu dữ liệu và chạy các test case tự động.

### 1. Kiểm tra kiểu dữ liệu (Typecheck) và Build:
```powershell
# Cho MCP Gateway
cd C:\2025-2026\SPEC_MPV\apps\mcp-gateway
npm run typecheck
npm run build

# Cho AI Orchestrator
cd C:\2025-2026\SPEC_MPV\apps\ai-orchestrator
npm run typecheck
npm run build

# Cho Chat UI
cd C:\2025-2026\SPEC_MPV\apps\chat-ui
npm run typecheck
npm run build
```
*(Trên PowerShell, nếu gặp lỗi về phân quyền thực thi của npm, hãy đổi lệnh thành `npm.cmd run typecheck`)*

### 2. Chạy test case tự động:
```powershell
cd C:\2025-2026\SPEC_MPV\apps\mcp-gateway
npm run test
```

---


