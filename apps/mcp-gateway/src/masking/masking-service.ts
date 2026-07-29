export class MaskingService {
  // LƯU Ý: danh sách này phải đồng bộ với mọi alias PII (AS ...) được dùng trong
  // packages/mcp-server-postgres/src/tools.ts. Thiếu 1 alias là dữ liệu cá nhân
  // sẽ bị trả về KHÔNG che (xem bug đã phát hiện với `customer_address`).
  private static piiFields = new Set([
    'email', 'phone', 'address', 'full_name', 'customer_name',
    'customer_email', 'customer_phone', 'customer_address'
  ]);

  /**
   * Deeply traverse an object and mask known PII fields.
   */
  public static maskObject(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.maskObject(item));
    }

    if (typeof obj === 'object') {
      const maskedObj: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (this.piiFields.has(key) && typeof value === 'string') {
          maskedObj[key] = this.maskValue(key, value);
        } else {
          maskedObj[key] = this.maskObject(value);
        }
      }
      return maskedObj;
    }

    return obj;
  }

  /**
   * Apply specific masking rules based on field name.
   */
  private static maskValue(field: string, value: string): string {
    if (!value) return value;
    
    switch (field) {
      case 'email':
      case 'customer_email':
        return this.maskEmail(value);
      case 'phone':
      case 'customer_phone':
        return this.maskPhone(value);
      case 'address':
      case 'customer_address':
        return '***';
      case 'full_name':
      case 'customer_name':
        return this.maskName(value);
      default:
        return '***';
    }
  }

  private static maskEmail(email: string): string {
    const parts = email.split('@');
    if (parts.length !== 2) return '***';
    const name = parts[0] || '';
    const domain = parts[1] || '';
    
    const maskedName = name.length > 2 
      ? name.substring(0, 2) + '***' 
      : '***';
      
    return `${maskedName}@${domain}`;
  }

  private static maskPhone(phone: string): string {
    if (phone.length <= 6) return '***';
    return phone.slice(0, 3) + '***' + phone.slice(-3);
  }

  private static maskName(name: string): string {
    const words = name.split(' ');
    return words.map(w => w.charAt(0) + '***').join(' ');
  }
}
