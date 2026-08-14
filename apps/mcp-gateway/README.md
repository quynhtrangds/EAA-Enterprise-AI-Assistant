# MCP Gateway

Backend service cung cấp MCP Runtime, quản lý tool permissions, gọi PostgreSQL Connector và ghi audit log.  
Xây dựng bằng **Node.js + TypeScript + Express + Zod + pg**.

## Chức năng chính

- Xác thực Bearer token qua bảng `auth_sessions`
- Trả danh sách tools theo quyền của role user (`GET /api/tools`)
- Thực thi tool call và trả kết quả (`POST /api/tools/call`)
- Ghi audit log mọi lần gọi tool
- Cung cấp API audit logs cho admin (`GET /api/audit-logs`)

## MCP Business Tools (read-only)

| Tool                        | Mô tả                                       |
|-----------------------------|---------------------------------------------|
| `search_customer`           | Tìm khách hàng theo tên, SĐT, email, mã KH |
| `get_customer_orders`       | Lấy đơn hàng của một khách hàng             |
| `get_order_detail`          | Chi tiết đơn hàng (items + payments)        |
| `get_revenue_summary`       | Tổng hợp doanh thu theo ngày/tháng/PTTT     |
| `get_top_customers`         | Xếp hạng khách hàng theo doanh thu          |
| `get_product_sales_summary` | Thống kê sản phẩm bán chạy                  |

## Biến môi trường

| Biến               | Mặc định              | Mô tả                |
|--------------------|-----------------------|----------------------|
| `PORT`             | `8081`                | Cổng service         |
| `POSTGRES_HOST`    | `localhost`           | Host PostgreSQL (`postgres` trong Docker) |
| `POSTGRES_PORT`    | `55432`               | Cổng PostgreSQL      |
| `POSTGRES_DB`      | `enterprise_ai_demo`  | Tên database         |
| `POSTGRES_USER`    | `postgres`            | User PostgreSQL      |
| `POSTGRES_PASSWORD`| `postgres`            | Mật khẩu PostgreSQL  |

## Chạy local

```powershell
npm install
npm run dev      # http://localhost:8081
```

## API Endpoints

```http
GET  /health              # Kiểm tra service
GET  /api/tools           # Lấy danh sách tools theo quyền user
POST /api/tools/call      # Thực thi một tool
GET  /api/audit-logs      # Xem audit log (chỉ admin)
```

Xem chi tiết request/response tại [../../docs/api.md](../../docs/api.md).
