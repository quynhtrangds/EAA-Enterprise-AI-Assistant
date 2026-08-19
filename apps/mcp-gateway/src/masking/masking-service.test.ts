import { describe, it, expect } from 'vitest';
import { MaskingService } from './masking-service.js';

describe('MaskingService', () => {
  describe('maskObject', () => {
    it('should mask phone numbers', () => {
      const input = {
        name: 'Normal Field',
        phone: '0901234567'
      };
      const result = MaskingService.maskObject(input);
      expect(result.name).toBe('Normal Field');
      expect(result.phone).toBe('090***567');
    });

    it('should mask emails', () => {
      const input = {
        email: 'john.doe@example.com'
      };
      const result = MaskingService.maskObject(input);
      expect(result.email).toBe('jo***@example.com');
    });

    it('should mask fullName and customerName (camelCase, đúng field name thực tế do các tool trả về)', () => {
      const input = {
        fullName: 'John Doe',
        customerName: 'Jane Smith'
      };
      const result = MaskingService.maskObject(input);
      expect(result.fullName).toBe('J*** D***');
      expect(result.customerName).toBe('J*** S***');
    });

    it('should mask address with ***', () => {
      const input = {
        address: '123 Main St, New York'
      };
      const result = MaskingService.maskObject(input);
      expect(result.address).toBe('***');
    });

    it('should mask customerAddress (camelCase, đúng field name mà get_order_detail thực tế trả về)', () => {
      const input = {
        customerName: 'Nguyen Van A',
        customerAddress: '123 Le Loi Street, District 1, HCMC'
      };
      const result = MaskingService.maskObject(input);
      expect(result.customerAddress).toBe('***');
      expect(result.customerName).toBe('N*** V*** A***');
    });

    it('should handle nested objects and arrays', () => {
      const input = {
        users: [
          {
            phone: '0987654321',
            details: {
              email: 'test@test.com',
              address: 'somewhere'
            }
          }
        ]
      };
      const result = MaskingService.maskObject(input);
      expect(result.users[0].phone).toBe('098***321');
      expect(result.users[0].details.email).toBe('te***@test.com');
      expect(result.users[0].details.address).toBe('***');
    });

    it('should return undefined or null unchanged', () => {
      expect(MaskingService.maskObject(null)).toBeNull();
      expect(MaskingService.maskObject(undefined)).toBeUndefined();
    });

    it('should not mask non-string values even if key matches', () => {
      const input = {
        phone: 1234567890 // number
      };
      const result = MaskingService.maskObject(input);
      expect(result.phone).toBe(1234567890); // unchanged
    });

    it('E2E: che đúng dữ liệu thật mà get_order_detail trả về (đúng cấu trúc outputSchema, không phải input tưởng tượng)', () => {
      // Cấu trúc này copy nguyên văn từ getOrderDetailOutputSchema trong
      // packages/mcp-server-postgres/src/tools.ts — đây chính là trường hợp
      // đã phát hiện bug: field 'customerAddress'/'customerName' (camelCase)
      // không khớp với danh sách piiFields cũ dùng snake_case, nên chưa bao
      // giờ được che trên thực tế dù test cũ (input giả snake_case) vẫn pass.
      const orderDetailResponse = {
        order: {
          orderId: '20000000-0000-0000-0000-000000000001',
          orderCode: 'DH001',
          customerName: 'Nguyễn Văn A',
          customerAddress: '123 Lê Lợi, Quận 1, TP.HCM',
          orderDate: '2026-07-01T10:00:00.000Z',
          status: 'completed',
          totalAmount: 2000000,
          items: [{ productName: 'Laptop Dell', quantity: 1, unitPrice: 2000000, totalPrice: 2000000 }],
          payments: []
        }
      };

      const masked = MaskingService.maskObject(orderDetailResponse);

      expect(masked.order.customerName).not.toBe('Nguyễn Văn A');
      expect(masked.order.customerAddress).toBe('***');
      // Các field không phải PII phải giữ nguyên
      expect(masked.order.orderCode).toBe('DH001');
      expect(masked.order.totalAmount).toBe(2000000);
    });

    it('E2E: che đúng dữ liệu thật mà search_customer / get_top_customers trả về', () => {
      const searchCustomerResponse = {
        customers: [
          { customerId: 'x', customerCode: 'KH001', fullName: 'Trần Thị B', phone: '0901234567', email: 'b@x.com', address: 'Hà Nội', status: 'active' }
        ]
      };
      const topCustomersResponse = {
        customers: [
          { customerId: 'x', customerCode: 'KH001', fullName: 'Trần Thị B', totalRevenue: 1000000, orderCount: 3 }
        ]
      };

      const maskedSearch = MaskingService.maskObject(searchCustomerResponse);
      const maskedTop = MaskingService.maskObject(topCustomersResponse);

      expect(maskedSearch.customers[0].fullName).not.toBe('Trần Thị B');
      expect(maskedSearch.customers[0].address).toBe('***');
      expect(maskedTop.customers[0].fullName).not.toBe('Trần Thị B');
      // customerCode không phải PII, phải giữ nguyên để vẫn tra cứu được
      expect(maskedTop.customers[0].customerCode).toBe('KH001');
    });
  });
});