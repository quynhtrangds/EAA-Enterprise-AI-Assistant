import { describe, it, expect } from 'vitest';
import { MaskingService } from './masking-service.js';

describe('MaskingService - Nested Objects & Edge Cases (Phase 2 Upgrade)', () => {
  const maskingService = new MaskingService();

  it('should mask phone numbers, emails, and addresses inside deeply nested JSON objects', () => {
    const input = {
      company: 'Enterprise AI Corp',
      contactPerson: {
        name: 'Nguyen Van A',
        email: 'nguyenvana@gmail.com',
        details: {
          phone: '0987654321',
          address: '123 Le Loi Street, District 1, HCMC'
        }
      },
      employees: [
        { name: 'Tran Thi B', email: 'tranthib@company.com', phone: '0912345678' }
      ]
    };

    const masked = MaskingService.maskObject(input);

    // Verify nested email masked
    expect(masked.contactPerson.email).toContain('***@gmail.com');
    // Verify nested phone masked with 3 leading and 3 trailing digits
    expect(masked.contactPerson.details.phone).toBe('098***321');
    // Verify nested address masked to ***
    expect(masked.contactPerson.details.address).toBe('***');
    // Verify array nested phone masked
    expect(masked.employees[0].phone).toBe('091***678');
  });

  it('should handle null, empty objects, and primitive inputs gracefully without crashing', () => {
    expect(MaskingService.maskObject(null)).toBeNull();
    expect(MaskingService.maskObject(undefined)).toBeUndefined();
    expect(MaskingService.maskObject('Simple String')).toBe('Simple String');
    expect(MaskingService.maskObject(12345)).toBe(12345);
  });
});
