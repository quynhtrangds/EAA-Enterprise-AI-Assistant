export class MaskingService {
  // Field type được xác định qua chuẩn hoá tên (lowercase, bỏ "_") trước khi
  // so khớp — KHÔNG so khớp tên field nguyên văn. Lý do: output thực tế của
  // các tool nghiệp vụ (packages/mcp-server-postgres/src/tools.ts) dùng
  // camelCase ('fullName', 'customerAddress', 'customerName'...) theo đúng
  // outputSchema, nhưng danh sách field trước đây liệt kê bằng snake_case
  // ('full_name', 'customer_address'...) — không bao giờ khớp, khiến tên
  // khách hàng và địa chỉ bị lộ hoàn toàn cho staff/viewer dù hệ thống tưởng
  // đã che. Chuẩn hoá tên trước khi so khớp giúp tự động khớp cả 2 kiểu viết
  // và không lặp lại đúng lỗi này khi có tool mới/field mới trong tương lai.
  private static fieldTypeByNormalizedKey = new Map<string, 'email' | 'phone' | 'address' | 'name'>([
    ['email', 'email'],
    ['customeremail', 'email'],
    ['phone', 'phone'],
    ['customerphone', 'phone'],
    ['address', 'address'],
    ['customeraddress', 'address'],
    ['fullname', 'name'],
    ['customername', 'name']
  ]);

  private static normalizeKey(key: string): string {
    return key.toLowerCase().replace(/_/g, '');
  }

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
        const fieldType = this.fieldTypeByNormalizedKey.get(this.normalizeKey(key));
        if (fieldType && typeof value === 'string') {
          maskedObj[key] = this.maskValue(fieldType, value);
        } else {
          maskedObj[key] = this.maskObject(value);
        }
      }
      return maskedObj;
    }

    return obj;
  }

  /**
   * Apply specific masking rules based on field type.
   */
  private static maskValue(fieldType: 'email' | 'phone' | 'address' | 'name', value: string): string {
    if (!value) return value;

    switch (fieldType) {
      case 'email':
        return this.maskEmail(value);
      case 'phone':
        return this.maskPhone(value);
      case 'address':
        return '***';
      case 'name':
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