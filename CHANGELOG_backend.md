# Tổng hợp các thay đổi Backend (nhánh ui-session-management)

Dưới đây là chi tiết các thành phần đã được cập nhật và chỉnh sửa trên Backend của hệ thống (bao gồm **AI Orchestrator**, **MCP Gateway** và **Database**):

## 1. ⚙️ AI Orchestrator (Backend)
- **Tích hợp Local LLM (Ollama)**:
  - Cập nhật file `apps/ai-orchestrator/src/config/env.ts` để cấu hình hỗ trợ Local LLM (thông qua các biến `LLM_PROVIDER`, `OPENAI_MODEL`, `LOCAL_LLM_BASE_URL`).
  - Thêm cấu hình số lượt gọi tool cho mỗi session: `MAX_TOOL_CALL_ROUNDS`.
- **Cải tiến Chat Service (Agentic Loop)**:
  - Sửa đổi cơ chế tại `apps/ai-orchestrator/src/services/chat-service.ts` từ việc gọi 1 tool tĩnh thành **vòng lặp đa lượt (Agentic Loop)**. Điều này cho phép LLM quyết định việc gọi nhiều công cụ (như lấy nhiều đơn hàng) trong cùng một chuỗi suy luận cho đến khi đủ thông tin thì mới đưa ra câu trả lời cuối.
- **Tối ưu System Prompt**:
  - Viết lại System Prompt để giảm hiện tượng "hallucination" cho các mô hình ngôn ngữ kích thước nhỏ (như `qwen2.5:3b`).
  - Đặt quy tắc nghiêm ngặt: Tuyệt đối chỉ dùng Tiếng Việt, nghiêm cấm sử dụng từ ngữ Tiếng Trung (như "吗", "的") hoặc Tiếng Anh, giúp hạn chế việc bị lẫn lộn token.
  - Bổ sung hướng dẫn LLM cách gọi nhiều tool liên tiếp để trích xuất thông tin chéo giữa nhiều đối tượng.
- **Quản lý lịch sử hội thoại (Chat History Repository)**:
  - Tạo mới `apps/ai-orchestrator/src/repositories/chat-history-repository.ts` để lưu trữ dữ liệu thông qua thư viện `pg`.
  - Tích hợp logic lưu tự động (`userMessage`, `assistantMessage`, `toolCalls`) vào cơ sở dữ liệu sau mỗi lượt gọi thành công thông qua API tại `apps/ai-orchestrator/src/routes/chat.ts`.

## 2. 🛡️ MCP Gateway (Backend)
- **Chuẩn hoá Tool Query**:
  - Tại `apps/mcp-gateway/src/connectors/postgres/tools/index.ts`: Khắc phục lỗi phân biệt hoa/thường cho biến `order_code` trong tool `get_order_detail` (sử dụng hàm SQL `UPPER()`). Nhờ vậy, từ khoá đầu vào `"ord-002"`, `"Ord-002"` hay `"ORD-002"` đều mang lại kết quả đúng.
  - Bổ sung việc trích xuất và hiển thị dữ liệu `address` (địa chỉ của khách hàng) cho các tool `search_customer` và `get_order_detail`.
- **Bảo mật, Phân quyền & Quản lý Log**:
  - Áp dụng cơ chế quản lý Session Authentication ở cấp Database thay cho hardcode token (tại file `apps/mcp-gateway/src/auth/auth-sessions.ts`).
  - Khắc phục và hoàn thiện tiến trình Audit Log tự động tại `apps/mcp-gateway/src/audit/audit-log.ts` để theo dõi các hành vi query.
  - Tối ưu middleware Rate Limit trong `app.ts` để đảm bảo hệ thống không bị request spam.

## 3. 🗄️ Database (Lược đồ & Migration)
- Thêm mới hai tệp migration để khởi tạo cấu trúc bảng SQL phục vụ tính năng lưu chat & session:
  - `database/migrations/003_auth_sessions.sql`: Bảng quản lý và duy trì token phiên đăng nhập.
  - `database/migrations/004_chat_history.sql`: Định nghĩa hai bảng `chat_sessions` và `chat_messages` để lưu trữ chuỗi hội thoại.
