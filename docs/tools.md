# MCP Business Tools

Tất cả tools hiện tại đều **read-only**, validate input bằng Zod và chạy SQL parameterized.

---

## search_customer

Tìm khách hàng theo tên, số điện thoại, email hoặc mã khách hàng.

Input:

```json
{
  "keyword": "Nguyễn",
  "limit": 5
}
```

`limit` tối đa 20.

---

## get_customer_orders

Lấy danh sách đơn hàng của một khách hàng.

Input:

```json
{
  "customerId": "20000000-0000-0000-0000-000000000001",
  "fromDate": "2026-07-01",
  "toDate": "2026-07-31",
  "limit": 10
}
```

Nếu không truyền ngày thì lấy 90 ngày gần nhất. `limit` tối đa 50.

---

## get_order_detail

Lấy chi tiết đơn hàng bao gồm thông tin khách hàng, danh sách sản phẩm và thanh toán.

Input:

```json
{
  "orderCode": "ORD-001"
}
```

---

## get_revenue_summary

Tổng hợp doanh thu theo các đơn có `payment.status = paid`.

Input:

```json
{
  "fromDate": "2026-07-01",
  "toDate": "2026-07-31",
  "groupBy": "day"
}
```

`groupBy`: `day`, `month`, `payment_method`. Khoảng ngày tối đa 1 năm.

---

## get_top_customers

Xếp hạng khách hàng theo doanh thu đã thanh toán.

Input:

```json
{
  "fromDate": "2026-07-01",
  "toDate": "2026-07-31",
  "limit": 5
}
```

`limit` tối đa 20.

---

## get_product_sales_summary

Thống kê sản phẩm bán chạy theo các đơn có payment đã thanh toán.

Input:

```json
{
  "fromDate": "2026-07-01",
  "toDate": "2026-07-31",
  "limit": 10
}
```

`limit` tối đa 30.
