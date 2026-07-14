import { z } from 'zod';
import { query } from '../../../db/pool.js';
import { AppError } from '../../../errors/app-error.js';
import type { McpTool, ToolContext } from '../../../types/tool.js';

interface OrderDetailRow {
  id: string;
  order_code: string;
  order_date: Date | string;
  status: string;
  total_amount: string;
  customer_name: string;
  customer_address: string | null;
}

interface SearchCustomerRow {
  id: string;
  customer_code: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: string;
}

interface OrderItemRow {
  product_name: string;
  quantity: number;
  unit_price: string;
  total_price: string;
}

interface PaymentRow {
  payment_code: string;
  payment_method: string;
  amount: string;
  status: string;
  paid_at: Date | string | null;
}

interface CustomerOrderRow {
  id: string;
  order_code: string;
  order_date: Date | string;
  status: string;
  total_amount: string;
}

interface RevenueGroupRow {
  group_key: string;
  total_orders: number;
  total_revenue: string;
}

interface TopCustomerRow {
  id: string;
  customer_code: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  total_orders: number;
  total_revenue: string;
}

interface ProductSalesRow {
  id: string;
  product_code: string;
  name: string;
  category: string | null;
  total_quantity: number;
  total_sales: string;
  total_orders: number;
}

const DateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use yyyy-mm-dd format');

const searchCustomerInput = z.object({
  keyword: z.string().trim().min(1),
  limit: z.number().int().min(1).max(20).default(5)
});

const getCustomerOrdersInput = z.object({
  customerId: z.string().uuid(),
  fromDate: DateString.optional(),
  toDate: DateString.optional(),
  limit: z.number().int().min(1).max(50).default(10)
});

const getOrderDetailInput = z.object({
  orderCode: z.string().trim().min(1)
});

const getRevenueSummaryInput = z.object({
  fromDate: DateString,
  toDate: DateString,
  groupBy: z.enum(['day', 'month', 'payment_method']).default('day')
});

const getTopCustomersInput = z.object({
  fromDate: DateString,
  toDate: DateString,
  limit: z.number().int().min(1).max(20).default(5)
});

const getProductSalesSummaryInput = z.object({
  fromDate: DateString,
  toDate: DateString,
  limit: z.number().int().min(1).max(50).default(10)
});

const searchCustomerOutputSchema = z.object({
  customers: z.array(
    z.object({
      customerId: z.string().uuid(),
      customerCode: z.string(),
      fullName: z.string(),
      phone: z.string(),
      email: z.string(),
      address: z.string(),
      status: z.string()
    })
  )
});

const getCustomerOrdersOutputSchema = z.object({
  orders: z.array(
    z.object({
      orderId: z.string().uuid(),
      orderCode: z.string(),
      orderDate: z.string(),
      status: z.string(),
      totalAmount: z.number()
    })
  )
});

const getOrderDetailOutputSchema = z.object({
  order: z.object({
    orderId: z.string().uuid(),
    orderCode: z.string(),
    customerName: z.string(),
    customerAddress: z.string(),
    orderDate: z.string(),
    status: z.string(),
    totalAmount: z.number(),
    items: z.array(
      z.object({
        productName: z.string(),
        quantity: z.number(),
        unitPrice: z.number(),
        totalPrice: z.number()
      })
    ),
    payments: z.array(
      z.object({
        paymentCode: z.string(),
        paymentMethod: z.string(),
        amount: z.number(),
        status: z.string(),
        paidAt: z.string()
      })
    )
  })
});

const getRevenueSummaryOutputSchema = z.object({
  fromDate: DateString,
  toDate: DateString,
  totalRevenue: z.number(),
  totalOrders: z.number(),
  groups: z.array(
    z.object({
      key: z.string(),
      revenue: z.number(),
      orderCount: z.number()
    })
  )
});

const getTopCustomersOutputSchema = z.object({
  customers: z.array(
    z.object({
      customerId: z.string().uuid(),
      customerCode: z.string(),
      fullName: z.string(),
      totalRevenue: z.number(),
      orderCount: z.number()
    })
  )
});

const getProductSalesSummaryOutputSchema = z.object({
  products: z.array(
    z.object({
      productCode: z.string(),
      productName: z.string(),
      quantitySold: z.number(),
      revenue: z.number()
    })
  )
});

function assertDateRange(fromDate: string, toDate: string): void {
  const from = new Date(`${fromDate}T00:00:00.000Z`);
  const to = new Date(`${toDate}T23:59:59.999Z`);
  const maxRangeMs = 366 * 24 * 60 * 60 * 1000;

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    throw new AppError('INVALID_TOOL_INPUT', 'fromDate phải nhỏ hơn hoặc bằng toDate.', 400);
  }

  if (to.getTime() - from.getTime() > maxRangeMs) {
    throw new AppError('INVALID_TOOL_INPUT', 'Khoảng ngày không được vượt quá 1 năm.', 400);
  }
}

function toNumber(value: unknown): number {
  return Number(value ?? 0);
}

export function createPostgresTools(): McpTool[] {
  return [
    {
      name: 'search_customer',
      title: 'Search Customer',
      description: 'Find customer by name, phone, email or customer code.',
      inputSchema: searchCustomerInput,
      outputSchema: searchCustomerOutputSchema,
      async execute(parsedInput: any, context: ToolContext) {
        const { keyword, limit } = parsedInput;
        const result = await query<SearchCustomerRow>(
          `
          SELECT id, customer_code, full_name, phone, email, address, status
          FROM customers
          WHERE unaccent(full_name) ILIKE unaccent($1)
             OR phone ILIKE $1
             OR unaccent(email) ILIKE unaccent($1)
             OR customer_code ILIKE $1
          ORDER BY full_name ASC
          LIMIT $2
          `,
          [`%${keyword}%`, limit]
        );

        return {
          customers: result.rows.map((customer) => ({
            customerId: customer.id,
            customerCode: customer.customer_code,
            fullName: customer.full_name,
            phone: customer.phone ?? '',
            email: customer.email ?? '',
            address: customer.address ?? '',
            status: customer.status
          }))
        };
      }
    },
    {
      name: 'get_customer_orders',
      title: 'Get Customer Orders',
      description: 'Get recent orders for a customer. IMPORTANT: customerId MUST be a valid UUID format. If you only have the customer name, you MUST call search_customer tool first to get the correct customerId.',
      inputSchema: getCustomerOrdersInput,
      outputSchema: getCustomerOrdersOutputSchema,
      async execute(parsedInput: any, context: ToolContext) {
        const parsed = parsedInput;
        const result = await query<CustomerOrderRow>(
          `
          SELECT id, order_code, order_date, status, total_amount
          FROM orders
          WHERE customer_id = $1
            AND order_date >= COALESCE($2::timestamptz, now() - INTERVAL '90 days')
            AND order_date <= COALESCE($3::timestamptz, now())
          ORDER BY order_date DESC
          LIMIT $4
          `,
          [parsed.customerId, parsed.fromDate ?? null, parsed.toDate ?? null, parsed.limit]
        );

        return {
          orders: result.rows.map((order) => ({
            orderId: order.id,
            orderCode: order.order_code,
            orderDate: order.order_date instanceof Date ? order.order_date.toISOString() : String(order.order_date),
            status: order.status,
            totalAmount: toNumber(order.total_amount)
          }))
        };
      }
    },
    {
      name: 'get_order_detail',
      title: 'Get Order Detail',
      description: 'Get order, customer, items and payments by order code.',
      inputSchema: getOrderDetailInput,
      outputSchema: getOrderDetailOutputSchema,
      async execute(parsedInput: any, context: ToolContext) {
        const { orderCode } = parsedInput;
        const orderResult = await query<OrderDetailRow>(
          `
          SELECT
            o.id,
            o.order_code,
            o.order_date,
            o.status,
            o.total_amount,
            c.full_name AS customer_name,
            c.address AS customer_address
          FROM orders o
          JOIN customers c ON c.id = o.customer_id
          WHERE UPPER(o.order_code) = UPPER($1)
          LIMIT 1
          `,
          [orderCode]
        );

        const order = orderResult.rows[0];
        if (!order) {
          throw new AppError('CONNECTOR_ERROR', `Không tìm thấy đơn hàng ${orderCode}.`, 404);
        }

        const [itemsResult, paymentsResult] = await Promise.all([
          query<OrderItemRow>(
            `
            SELECT
              p.name AS product_name,
              oi.quantity,
              oi.unit_price,
              oi.total_price
            FROM order_items oi
            JOIN products p ON p.id = oi.product_id
            WHERE oi.order_id = $1
            ORDER BY p.name ASC
            `,
            [order.id]
          ),
          query<PaymentRow>(
            `
            SELECT payment_code, payment_method, amount, paid_at, status
            FROM payments
            WHERE order_id = $1
            ORDER BY created_at ASC
            `,
            [order.id]
          )
        ]);

        return {
          order: {
            orderId: order.id,
            orderCode: order.order_code,
            customerName: order.customer_name,
            customerAddress: order.customer_address ?? '',
            orderDate: order.order_date instanceof Date ? order.order_date.toISOString() : String(order.order_date),
            status: order.status,
            totalAmount: toNumber(order.total_amount),
            items: itemsResult.rows.map((item) => ({
              productName: item.product_name,
              quantity: item.quantity,
              unitPrice: toNumber(item.unit_price),
              totalPrice: toNumber(item.total_price)
            })),
            payments: paymentsResult.rows.map((payment) => ({
              paymentCode: payment.payment_code,
              paymentMethod: payment.payment_method,
              amount: toNumber(payment.amount),
              status: payment.status,
              paidAt: payment.paid_at instanceof Date ? payment.paid_at.toISOString() : (payment.paid_at ? String(payment.paid_at) : '')
            }))
          }
        };
      }
    },
    {
      name: 'get_revenue_summary',
      title: 'Get Revenue Summary',
      description: 'Summarize paid revenue by day, month or payment method.',
      inputSchema: getRevenueSummaryInput,
      outputSchema: getRevenueSummaryOutputSchema,
      async execute(parsedInput: any, context: ToolContext) {
        const parsed = parsedInput;
        assertDateRange(parsed.fromDate, parsed.toDate);

        const groupExpression =
          parsed.groupBy === 'payment_method'
            ? 'p.payment_method'
            : parsed.groupBy === 'month'
              ? "to_char(date_trunc('month', p.paid_at), 'YYYY-MM')"
              : "to_char(date_trunc('day', p.paid_at), 'YYYY-MM-DD')";

        const groupsResult = await query<RevenueGroupRow>(
          `
          SELECT
            ${groupExpression} AS group_key,
            COUNT(DISTINCT o.id)::int AS total_orders,
            COALESCE(SUM(p.amount), 0)::numeric AS total_revenue
          FROM payments p
          JOIN orders o ON o.id = p.order_id
          WHERE p.status = 'paid'
            AND p.paid_at >= $1::timestamptz
            AND p.paid_at < ($2::date + INTERVAL '1 day')
          GROUP BY group_key
          ORDER BY group_key ASC
          `,
          [parsed.fromDate, parsed.toDate]
        );

        const groups = groupsResult.rows.map((row) => ({
          key: row.group_key,
          revenue: toNumber(row.total_revenue),
          orderCount: toNumber(row.total_orders)
        }));

        return {
          fromDate: parsed.fromDate,
          toDate: parsed.toDate,
          totalRevenue: groups.reduce((sum, row) => sum + row.revenue, 0),
          totalOrders: groups.reduce((sum, row) => sum + row.orderCount, 0),
          groups
        };
      }
    },
    {
      name: 'get_top_customers',
      title: 'Get Top Customers',
      description: 'Rank customers by paid revenue.',
      inputSchema: getTopCustomersInput,
      outputSchema: getTopCustomersOutputSchema,
      async execute(parsedInput: any, context: ToolContext) {
        const parsed = parsedInput;
        assertDateRange(parsed.fromDate, parsed.toDate);

        const result = await query<TopCustomerRow>(
          `
          SELECT
            c.id,
            c.customer_code,
            c.full_name,
            c.phone,
            c.email,
            COUNT(DISTINCT o.id)::int AS total_orders,
            COALESCE(SUM(p.amount), 0)::numeric AS total_revenue
          FROM customers c
          JOIN orders o ON o.customer_id = c.id
          JOIN payments p ON p.order_id = o.id
          WHERE p.status = 'paid'
            AND p.paid_at >= $1::timestamptz
            AND p.paid_at < ($2::date + INTERVAL '1 day')
          GROUP BY c.id, c.customer_code, c.full_name, c.phone, c.email
          ORDER BY total_revenue DESC
          LIMIT $3
          `,
          [parsed.fromDate, parsed.toDate, parsed.limit]
        );

        return {
          customers: result.rows.map((row) => ({
            customerId: row.id,
            customerCode: row.customer_code,
            fullName: row.full_name,
            totalRevenue: toNumber(row.total_revenue),
            orderCount: toNumber(row.total_orders)
          }))
        };
      }
    },
    {
      name: 'get_product_sales_summary',
      title: 'Get Product Sales Summary',
      description: 'Rank products by paid order sales.',
      inputSchema: getProductSalesSummaryInput,
      outputSchema: getProductSalesSummaryOutputSchema,
      async execute(parsedInput: any, context: ToolContext) {
        const parsed = parsedInput;
        assertDateRange(parsed.fromDate, parsed.toDate);

        const result = await query<ProductSalesRow>(
          `
          SELECT
            p.id,
            p.product_code,
            p.name,
            p.category,
            SUM(oi.quantity)::int AS total_quantity,
            COALESCE(SUM(oi.total_price), 0)::numeric AS total_sales,
            COUNT(DISTINCT o.id)::int AS total_orders
          FROM products p
          JOIN order_items oi ON oi.product_id = p.id
          JOIN orders o ON o.id = oi.order_id
          JOIN payments pay ON pay.order_id = o.id
          WHERE pay.status = 'paid'
            AND pay.paid_at >= $1::timestamptz
            AND pay.paid_at < ($2::date + INTERVAL '1 day')
          GROUP BY p.id, p.product_code, p.name, p.category
          ORDER BY total_quantity DESC, total_sales DESC
          LIMIT $3
          `,
          [parsed.fromDate, parsed.toDate, parsed.limit]
        );

        return {
          products: result.rows.map((row) => ({
            productCode: row.product_code,
            productName: row.name,
            quantitySold: toNumber(row.total_quantity),
            revenue: toNumber(row.total_sales)
          }))
        };
      }
    }
  ];
}

export const postgresTools = createPostgresTools();
