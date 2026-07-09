# Enterprise AI Assistant - MCP PostgreSQL MVP

Bản demo MVP của Trợ lý AI Doanh nghiệp bằng tiếng Việt. Dự án giải quyết bài toán truy xuất dữ liệu doanh nghiệp an toàn thông qua AI. Với kiến trúc an ninh nghiêm ngặt, mô hình ngôn ngữ lớn (LLM) và Bộ điều phối (AI Orchestrator) không kết nối trực tiếp vào cơ sở dữ liệu. Mọi hoạt động truy vấn bắt buộc phải đi qua MCP Gateway và các công cụ nghiệp vụ nghiệp vụ chỉ đọc (read-only) để bảo vệ dữ liệu doanh nghiệp tối đa.

---

## Các tính năng nổi bật (Features)

* **Kiến trúc An toàn Tuyệt đối**: AI Orchestrator hoàn toàn tách biệt khỏi Database. Dữ liệu chỉ được truy xuất gián tiếp qua cổng MCP Gateway sử dụng các công cụ chỉ đọc (Read-only Tools).
* **6 Công cụ nghiệp vụ cốt lõi (MVP Tools)**: 
  * `search_customer`: Tìm kiếm khách hàng theo từ khóa (giới hạn tối đa 20 dòng).
  * `get_customer_orders`: Xem danh sách đơn hàng của khách hàng (giới hạn tối đa 50 dòng).
  * `get_order_detail`: Chi tiết đơn hàng gồm thông tin lồng nhau (nested items & payments).
  * `get_revenue_summary`: Tổng hợp doanh thu theo ngày/tháng/năm (kiểm tra khoảng ngày tối đa 1 năm).
  * `get_top_customers`: Thống kê khách hàng mang lại doanh thu cao nhất (tối đa 20 dòng).
  * `get_product_sales_summary`: Thống kê số lượng bán và doanh thu của sản phẩm (tối đa 50 dòng).
* **Kiểm soát thời gian chờ (Timeout Control)**: Tự động ngắt kết nối và trả lỗi `TOOL_TIMEOUT` (HTTP 408) nếu việc kết nối DB hoặc thực thi công cụ vượt quá thời hạn cấu hình (`TOOL_TIMEOUT_MS`).
* **Nhật ký kiểm vết (Before/After Audit Logging)**: Lưu vết trạng thái trước khi thực hiện (`request-start`) và sau khi hoàn thành (`success`/`failed`) kèm thời gian thực thi cụ thể, giúp truy vết hoạt động của AI.
* **Phân quyền tài khoản chặt chẽ (Role-Based Access Control)**: Phân chia quyền gọi công cụ nghiệp vụ và xem nhật ký log dựa trên vai trò của người dùng (`admin`, `manager`, `staff`, `viewer`).
* **Đa dạng LLM Provider**: Hỗ trợ tích hợp OpenAI GPT hoặc các mô hình ngôn ngữ local chạy offline bảo mật (Ollama, LM Studio).
* **Giao diện Chat UI Premium**: Tích hợp màn hình đăng nhập độc lập sang trọng, duy trì trạng thái đăng nhập (`localStorage`) và tự động cá nhân hóa phiên chat riêng cho từng user để tránh xung đột session.

---

## Demo / Hình ảnh trực quan (Screenshots)

### Giao diện đăng nhập cao cấp (Màn hình khởi động khi chưa có Token)
*Giao diện đăng nhập độc lập, thân thiện với người dùng hỗ trợ chọn các tài khoản mẫu nhanh:*
![Login Interface](/docs/architecture.md)

### Khung chat hội thoại & Tool Trace
*Giao diện chat trực quan hiển thị câu trả lời bằng tiếng Việt và chi tiết quá trình AI gọi công cụ nghiệp vụ (Tool Call Trace):*
![Chat Interface](file:///C:/Users/Quynh%20Trang/.gemini/antigravity-ide/brain/217283bf-186c-4eb1-a87e-442dc8cd3097/walkthrough.md)

---

## Hướng dẫn cài đặt (Installation)

### Yêu cầu hệ thống (Prerequisites)
Đảm bảo máy tính của bạn đã được cài đặt:
1. **Node.js 20+**
2. **Docker Desktop** (đã được khởi động)

### Các bước cài đặt dưới Local

1. **Clone mã nguồn từ GitHub**:
   ```bash
   git clone https://github.com/quynhtrangds/EAA-Enterprise-AI-Assistant.git
   cd EAA-Enterprise-AI-Assistant
   ```

2. **Cài đặt thư viện cho từng phân hệ**:
   ```bash
   # Cho MCP Gateway
   cd apps/mcp-gateway
   npm install
   
   # Cho AI Orchestrator
   cd ../ai-orchestrator
   npm install
   
   # Cho Chat UI
   cd ../chat-ui
   npm install
   ```

---

## Hướng dẫn sử dụng (Usage)

### Cách 1: Khởi chạy nhanh bằng Docker Compose (Khuyên dùng)
Tại thư mục gốc của dự án, chạy lệnh sau để khởi dựng toàn bộ 4 dịch vụ (`postgres`, `mcp-gateway`, `ai-orchestrator`, `chat-ui`):
```bash
docker compose up -d
```
Sau khi khởi động xong, bạn truy cập các dịch vụ qua:
* **Giao diện Chat UI:** [http://localhost:3000](http://localhost:3000)
* **MCP Gateway:** [http://localhost:8081](http://localhost:8081)
* **AI Orchestrator:** [http://localhost:8082](http://localhost:8082)

### Cách 2: Khởi chạy cục bộ phục vụ Phát triển (Development)
1. **Khởi động database PostgreSQL**:
   ```bash
   docker compose up -d postgres
   ```
2. **Chạy MCP Gateway (Port 8081)**:
   ```bash
   cd apps/mcp-gateway
   npm run dev
   ```
3. **Chạy AI Orchestrator (Port 8082)**:
   ```bash
   cd apps/ai-orchestrator
   npm run dev
   ```
4. **Chạy Chat UI (Port 3000)**:
   ```bash
   cd apps/chat-ui
   npm run dev
   ```

### Các tài khoản đăng nhập mẫu
Hệ thống đi kèm dữ liệu tài khoản mẫu được mã hóa và phân quyền cụ thể:
* **Quản trị viên (Admin)**: `admin` / `admin123` (Có toàn quyền gọi các tool và truy vấn audit logs).
* **Quản lý (Manager)**: `manager` / `manager123` (Có quyền gọi 6 tool nghiệp vụ, không được xem audit logs).
* **Nhân viên (Staff)**: `staff` / `staff123` (Có quyền gọi một số tool nghiệp vụ cơ bản).
* **Khách (Viewer)**: `viewer` / `viewer123` (Chỉ được phép xem danh sách và gọi các công cụ không nhạy cảm).

### File cấu hình `.env` cho AI Orchestrator
Tạo file `apps/ai-orchestrator/.env` để chuyển đổi LLM Provider:
```env
# Chạy với OpenAI
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_MODEL=gpt-4o-mini

# HOẶC Chạy với mô hình Local (Ollama, LM Studio)
# LLM_PROVIDER=local
# LOCAL_LLM_BASE_URL=http://localhost:11434/v1
# OPENAI_MODEL=llama3
```

### Chạy kiểm thử tự động (Tests)
* **Chạy test tự động của MCP Gateway**:
  ```bash
  cd apps/mcp-gateway
  npm run test
  ```
* **Chạy test tự động của AI Orchestrator**:
  ```bash
  cd apps/ai-orchestrator
  npm run test
  ```

---

## Công nghệ sử dụng (Tech Stack)

* **Backend / API**:
  * Node.js, TypeScript, Express.js.
  * Model Context Protocol (MCP) SDK - Giao thức kết nối ngữ cảnh mô hình của Anthropic.
* **Database**:
  * PostgreSQL 15 (Chạy dưới Docker Container).
  * `pg` (node-postgres) - Thư viện kết nối CSDL và xử lý truy vấn tham số an toàn.
* **Frontend**:
  * React 18, TypeScript, Vite.
  * Vanilla CSS (Cho giao diện tinh tế, hiện đại và tối ưu hiệu năng).
  * Lucide React (Bộ icon thiết kế sắc nét).
* **Testing**:
  * Vitest & Supertest (Kiểm thử tích hợp API và CSDL cục bộ).
