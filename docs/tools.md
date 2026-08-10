# MCP Tools

Danh sách toàn bộ tool mà MCP Gateway expose ra cho AI Orchestrator/LLM, chia theo từng MCP server con (`packages/mcp-server-*`). Gateway đăng ký các server này qua `apps/mcp-gateway/connector.json` và định tuyến tool call bằng `McpClientManager`.

Có 2 nhóm khác nhau về bản chất:

- **`postgres`** và **`rag`**: dữ liệu **có sẵn/mock**, không cần cấu hình tích hợp — chạy được ngay sau khi `docker compose up`.
- **`crm` (Frappe CRM), `erpnext`, `zammad`, `gitea`**: đây **không phải mock** — mỗi tool gọi HTTP thật tới hệ thống bên ngoài tương ứng (Frappe/ERPNext, Zammad, Gitea...). Muốn dùng được, admin phải cấu hình URL + API key qua `POST /api/admin/integrations` (secret lưu trong Vault tại đường dẫn `integrations/<tenantId>/<integration_code>`); nếu tenant chưa cấu hình, Gateway sẽ dùng URL mặc định khai báo sẵn (xem bảng bên dưới) hoặc trả lỗi yêu cầu cấu hình.
- Quyền gọi tool được kiểm tra qua bảng `tool_permissions`. Hiện tại **chỉ 6 tool của `postgres` có permission mẫu sẵn** trong `database/seed/seed.sql`; tool của `crm`, `erpnext`, `zammad`, `gitea`, `rag` **mặc định chỉ role `admin` gọi được** cho tới khi bổ sung thêm bản ghi permission tương ứng.

---

## 1. `mcp-server-postgres` — dữ liệu nghiệp vụ mẫu

Tất cả tool đều read-only, validate input bằng Zod và chạy SQL parameterized. Không cần cấu hình tích hợp.

### search_customer

Tìm khách hàng theo tên, phone, email hoặc mã khách hàng.

```json
{ "keyword": "Nguyen", "limit": 5 }
```
`limit` tối đa 20.

### get_customer_orders

Lấy đơn hàng của một khách hàng.

```json
{
  "customerId": "20000000-0000-0000-0000-000000000001",
  "fromDate": "2026-07-01",
  "toDate": "2026-07-06",
  "limit": 10
}
```
Nếu không truyền ngày thì lấy 90 ngày gần nhất (Gateway tự điền mặc định). `limit` tối đa 50.

### get_order_detail

Lấy chi tiết đơn hàng, customer, items và payments.

```json
{ "orderCode": "ORD-001" }
```

### get_revenue_summary

Tổng hợp doanh thu theo payment `status = paid`.

```json
{ "fromDate": "2026-07-01", "toDate": "2026-07-31", "groupBy": "day" }
```
`groupBy`: `day`, `month`, `payment_method`. Khoảng ngày tối đa 1 năm.

### get_top_customers

Xếp hạng khách hàng theo paid revenue.

```json
{ "fromDate": "2026-07-01", "toDate": "2026-07-31", "limit": 5 }
```
`limit` tối đa 20.

### get_product_sales_summary

Thống kê sản phẩm bán chạy theo các đơn có payment `paid`.

```json
{ "fromDate": "2026-07-01", "toDate": "2026-07-31", "limit": 10 }
```

---

## 2. `mcp-server-crm` — Frappe/ERPNext CRM (gọi API thật)

Không có sẵn mặc định — bắt buộc cấu hình `apiUrl` (endpoint Frappe CRM) qua trang cấu hình tích hợp; `apiKey` tuỳ chọn (định dạng `token <key>:<secret>` hoặc Bearer token).

### crm_get_customer_status

Lấy danh sách khách hàng (Customer) và tiềm năng (Lead) từ Frappe CRM.

```json
{ "keyword": "Nguyen" }
```
`keyword` tuỳ chọn — tìm theo tên khách hàng/lead. Nếu bỏ trống, trả toàn bộ Customer + Lead. Trả về mảng `contacts` gồm cả 2 loại, phân biệt bằng field `type` (`Customer` | `Lead`).

### crm_get_opportunities

Lấy danh sách cơ hội kinh doanh (Opportunity/Deal).

```json
{ "status": "Open" }
```
`status` tuỳ chọn (ví dụ: `Open`, `Quotation`, `Converted`, `Lost`).

---

## 3. `mcp-server-erpnext` — ERPNext (gọi API thật)

Bắt buộc cấu hình `apiUrl`; nếu tenant chưa cấu hình, Gateway dùng mặc định `https://eaa-enterprise-demo.s.frappe.cloud`. `apiKey` theo định dạng Frappe token (`token <api_key>:<api_secret>`).

### get_inventory_status

Lấy trạng thái tồn kho các mặt hàng (Item), gộp thêm số lượng tồn thực tế từ Bin.

```json
{ "keyword": "laptop" }
```
`keyword` tuỳ chọn, tìm theo mã hoặc tên mặt hàng.

### get_sales_invoices

Lấy danh sách Hoá đơn bán hàng (Sales Invoice).

```json
{ "keyword": "", "status": "Unpaid", "limit": 20 }
```
`status`: `Paid`, `Unpaid`, `Overdue`, `Draft` (tuỳ chọn). `limit` mặc định 20, tối đa 100. Kết quả trả về bằng tiếng Việt (`maHoaDon`, `doiTac`, `tongTien`, `trangThai`...).

### get_purchase_invoices

Lấy danh sách Hoá đơn mua hàng (Purchase Invoice) — cùng cấu trúc tham số và output như `get_sales_invoices`, đối tác là nhà cung cấp thay vì khách hàng.

---

## 4. `mcp-server-zammad` — Zammad Helpdesk (gọi API thật)

Bắt buộc cấu hình cả `apiUrl` **và** `apiKey` (Zammad Access Token) — tool sẽ báo lỗi tường minh nếu thiếu 1 trong 2. Nếu tenant chưa cấu hình, Gateway dùng mặc định `http://host.docker.internal:8080`.

### get_open_tickets

Lấy danh sách ticket đang mở (open/new) từ Zammad.

```json
{}
```
Không có tham số đầu vào. Trả về `{ total, tickets: [{ id, number, title, state, created_at }] }`.

---

## 5. `mcp-server-gitea` — Gitea (gọi API thật)

Bắt buộc cấu hình `apiUrl`; nếu tenant chưa cấu hình, Gateway dùng mặc định `http://host.docker.internal:3001` (chính là service `gitea` trong `docker-compose.yml`). `apiKey` tuỳ chọn (Gitea access token).

### search_repositories

Tìm kiếm repository trên Gitea.

```json
{ "keyword": "eaa" }
```
`keyword` tuỳ chọn. Trả về `{ total_repos, repositories: [{ id, name, url, status, issues, description }] }`. URL trả về tự động đổi `host.docker.internal` → `localhost` để mở được trực tiếp từ trình duyệt trên máy host.

---

## 6. `mcp-server-rag` — Tìm kiếm tài liệu nội bộ (mock)

Không cần cấu hình tích hợp. Dữ liệu là **danh sách tài liệu mock cố định trong code** (`MOCK_DOCUMENTS`, 4 tài liệu mẫu: chính sách nghỉ phép, hướng dẫn VPN, quy trình xử lý sự cố, chính sách bảo mật) — chưa kết nối tới kho tài liệu thật hay vector DB nào.

### search_internal_documents

```json
{ "keyword": "nghỉ phép" }
```
`keyword` **bắt buộc**. Tìm kiếm khớp chuỗi con (không phân biệt hoa/thường, không dấu) trong tiêu đề và nội dung tài liệu mock. Trả về `{ total_results, documents: [...] }`.

> ⚠️ Đây là nơi cần nâng cấp trước khi dùng thật: thay `MOCK_DOCUMENTS` bằng kết nối tới kho tài liệu thật (vector search / embeddings) nếu muốn RAG hoạt động đúng nghĩa.