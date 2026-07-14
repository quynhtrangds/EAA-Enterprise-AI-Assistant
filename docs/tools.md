# MCP Tools

Tat ca tools hien tai deu read-only, validate input bang Zod va chay SQL parameterized.

## search_customer

Tim khach hang theo ten, phone, email hoac ma khach hang.

Input:

```json
{
  "keyword": "Nguyen",
  "limit": 5
}
```

`limit` toi da 20.

## get_customer_orders

Lay don hang cua mot khach hang.

Input:

```json
{
  "customerId": "20000000-0000-0000-0000-000000000001",
  "fromDate": "2026-07-01",
  "toDate": "2026-07-06",
  "limit": 10
}
```

Neu khong truyen ngay thi lay 90 ngay gan nhat. `limit` toi da 50.

## get_order_detail

Lay chi tiet don hang, customer, items va payments.

Input:

```json
{
  "orderCode": "ORD-001"
}
```

## get_revenue_summary

Tong hop doanh thu theo payment `status = paid`.

Input:

```json
{
  "fromDate": "2026-07-01",
  "toDate": "2026-07-31",
  "groupBy": "day"
}
```

`groupBy`: `day`, `month`, `payment_method`. Khoang ngay toi da 1 nam.

## get_top_customers

Xep hang khach hang theo paid revenue.

Input:

```json
{
  "fromDate": "2026-07-01",
  "toDate": "2026-07-31",
  "limit": 5
}
```

`limit` toi da 20.

## get_product_sales_summary

Thong ke san pham ban chay theo cac don co payment paid.

Input:

```json
{
  "fromDate": "2026-07-01",
  "toDate": "2026-07-31",
  "limit": 10
}
```
