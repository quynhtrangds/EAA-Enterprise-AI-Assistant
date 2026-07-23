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

    it('should mask full_name and customer_name', () => {
      const input = {
        full_name: 'John Doe',
        customer_name: 'Jane Smith'
      };
      const result = MaskingService.maskObject(input);
      expect(result.full_name).toBe('J*** D***');
      expect(result.customer_name).toBe('J*** S***');
    });

    it('should mask address with ***', () => {
      const input = {
        address: '123 Main St, New York'
      };
      const result = MaskingService.maskObject(input);
      expect(result.address).toBe('***');
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
  });
});
