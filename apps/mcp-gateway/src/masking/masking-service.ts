export type PiiType = 'email' | 'phone' | 'address' | 'name';

export interface MaskingOptions {
  /**
   * Khai báo trực tiếp từ tool: map tên trường (hoặc path) sang loại PII.
   * Ví dụ: { name: 'name', doiTac: 'name', phone: 'phone', party_name: 'name' }
   */
  toolPiiFields?: Record<string, PiiType>;
  /**
   * Schema output của tool (nếu có) để tự trích xuất thông tin PII từ metadata
   */
  outputSchema?: any;
}

export class MaskingService {
  // Danh mục PII mặc định (fallback) cho các tool cũ hoặc bên thứ 3 chưa gắn metadata.
  private static defaultFieldTypeByNormalizedKey = new Map<string, PiiType>([
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
   * Trích xuất các trường PII từ outputSchema (JSON Schema hoặc Zod shape đã serialize).
   * Hỗ trợ tìm thuộc tính pii hoặc description có dạng 'pii:<type>'.
   */
  public static extractPiiFromSchema(schema: any, prefix = ''): Record<string, PiiType> {
    const result: Record<string, PiiType> = {};
    if (!schema || typeof schema !== 'object') return result;

    const properties = schema.properties || (schema.shape ? schema.shape : null);
    if (properties && typeof properties === 'object') {
      for (const [propName, propDef] of Object.entries(properties)) {
        if (!propDef || typeof propDef !== 'object') continue;
        const pDef = propDef as any;
        const piiType = pDef.pii || (typeof pDef.description === 'string' && pDef.description.match(/pii:(email|phone|address|name)/i)?.[1]?.toLowerCase());
        if (piiType && ['email', 'phone', 'address', 'name'].includes(piiType)) {
          result[propName] = piiType as PiiType;
        }
        if (pDef.properties || pDef.shape) {
          Object.assign(result, this.extractPiiFromSchema(pDef, `${propName}.`));
        } else if (pDef.items) {
          Object.assign(result, this.extractPiiFromSchema(pDef.items, `${propName}[].`));
        }
      }
    }
    return result;
  }

  /**
   * Deeply traverse an object and mask PII fields.
   * Ưu tiên áp dụng theo khai báo của Tool (options.toolPiiFields hoặc options.outputSchema).
   * Fallback về defaultFieldTypeByNormalizedKey nếu tool không có khai báo cụ thể.
   */
  public static maskObject(obj: any, options?: MaskingOptions): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.maskObject(item, options));
    }

    // Chuẩn bị map PII từ khai báo của tool
    const toolPiiMap = new Map<string, PiiType>();
    if (options?.toolPiiFields) {
      for (const [k, v] of Object.entries(options.toolPiiFields)) {
        toolPiiMap.set(k, v);
        toolPiiMap.set(this.normalizeKey(k), v);
      }
    }
    if (options?.outputSchema) {
      const extracted = this.extractPiiFromSchema(options.outputSchema);
      for (const [k, v] of Object.entries(extracted)) {
        toolPiiMap.set(k, v);
        toolPiiMap.set(this.normalizeKey(k), v);
      }
    }

    if (typeof obj === 'object') {
      const maskedObj: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const normKey = this.normalizeKey(key);
        // 1. Ưu tiên cao nhất: Khai báo chủ động từ Tool
        let fieldType = toolPiiMap.get(key) || toolPiiMap.get(normKey);

        // 2. Fallback: Danh mục mặc định toàn cục nếu tool không khai báo
        if (!fieldType) {
          fieldType = this.defaultFieldTypeByNormalizedKey.get(normKey);
        }

        if (fieldType && typeof value === 'string') {
          maskedObj[key] = this.maskValue(fieldType, value);
        } else {
          maskedObj[key] = this.maskObject(value, options);
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