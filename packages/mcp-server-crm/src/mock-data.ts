// ============================================================================
// Dữ liệu mẫu (mock) cho mcp-server-crm — dùng khi tích hợp CRM bị TẮT hoặc
// chưa cấu hình (gateway truyền _mockMode: true). Mọi phản hồi mock đều mang
// nhãn _mock: true + note để LLM/UX báo rõ người dùng đây KHÔNG phải data thật.
// Shape phản hồi khớp 1-1 với đường API thật (Frappe) để phía client không cần
// xử lý riêng.
// ============================================================================

interface MockContact {
  type: 'Customer' | 'Lead';
  id: string;
  name: string;
  customer_group?: string;
  territory?: string;
  email?: string;
  phone?: string;
  status?: string;
  company?: string;
  // Trường địa chỉ chỉ có ở bản mock — phục vụ demo tra cứu theo địa chỉ
  address_line1?: string;
  city?: string;
}

const MOCK_CONTACTS: MockContact[] = [
  {
    type: 'Customer',
    id: 'CRM-CUST-0001',
    name: 'Palmer Productions Ltd.',
    customer_group: 'Doanh nghiệp',
    territory: 'Alaska',
    email: 'contact@palmer.example.com',
    phone: '+1-907-555-0100',
    status: 'Active',
    address_line1: '100 Anthem Street',
    city: 'Alaska'
  },
  {
    type: 'Customer',
    id: 'CRM-CUST-0002',
    name: 'Công ty TNHH An Phát',
    customer_group: 'Doanh nghiệp nhỏ và vừa',
    territory: 'TP. Hồ Chí Minh',
    email: 'info@anphat.example.vn',
    phone: '+84-28-555-0111',
    status: 'Active',
    address_line1: '88 Nguyễn Huệ',
    city: 'TP. Hồ Chí Minh'
  },
  {
    type: 'Customer',
    id: 'CRM-CUST-0003',
    name: 'Cửa hàng Điện tử Thanh Bình',
    customer_group: 'Bán lẻ',
    territory: 'Đà Nẵng',
    email: 'thanhbinh@example.vn',
    phone: '+84-236-555-0122',
    status: 'Active',
    address_line1: '12 Bạch Đằng',
    city: 'Đà Nẵng'
  },
  {
    type: 'Lead',
    id: 'CRM-LEAD-0001',
    name: 'Nguyễn Hoàng Long',
    email: 'long.nguyen@example.com',
    phone: '+84-90-555-0123',
    status: 'Open',
    company: 'Long Logistics'
  },
  {
    type: 'Lead',
    id: 'CRM-LEAD-0002',
    name: 'Trần Mỹ Linh',
    email: 'mylinh@example.com',
    phone: '+84-91-555-0456',
    status: 'Interested',
    company: 'Mỹ Linh Retail'
  }
];

const MOCK_OPPORTUNITIES = [
  { id: 'CRM-OPP-0001', party_name: 'Palmer Productions Ltd.', type: 'Customer', status: 'Open', amount: 150000000, currency: 'VND' },
  { id: 'CRM-OPP-0002', party_name: 'Trần Mỹ Linh', type: 'Lead', status: 'Quotation', amount: 42000000, currency: 'VND' },
  { id: 'CRM-OPP-0003', party_name: 'Công ty TNHH An Phát', type: 'Customer', status: 'Converted', amount: 88000000, currency: 'VND' }
];

const MOCK_NOTE =
  'Đây là DỮ LIỆU MẪU (mock) — tích hợp CRM đang TẮT hoặc chưa được cấu hình. ' +
  'Hãy bật và cấu hình tích hợp CRM trong màn "Kết nối Tích hợp" để tra cứu dữ liệu thật.';

export function buildMockCrmResponse(toolName: string, rawArgs: any) {
  // crm_get_customer_status: lọc theo keyword trên toàn bộ trường (bao gồm địa chỉ)
  if (toolName === 'crm_get_customer_status') {
    const keyword = String(rawArgs?.keyword || '').trim().toLowerCase();
    const contacts = keyword
      ? MOCK_CONTACTS.filter(c => JSON.stringify(c).toLowerCase().includes(keyword))
      : MOCK_CONTACTS;
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ total: contacts.length, contacts, _mock: true, note: MOCK_NOTE }, null, 2)
      }]
    };
  }

  // crm_get_opportunities: lọc theo status (nếu có)
  if (toolName === 'crm_get_opportunities') {
    const status = String(rawArgs?.status || '').trim().toLowerCase();
    const opportunities = status
      ? MOCK_OPPORTUNITIES.filter(o => o.status.toLowerCase() === status)
      : MOCK_OPPORTUNITIES;
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ total: opportunities.length, opportunities, _mock: true, note: MOCK_NOTE }, null, 2)
      }]
    };
  }

  // Tool chưa có dữ liệu mẫu
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        _mock: true,
        note: MOCK_NOTE,
        detail: `Tool "${toolName}" chưa có bộ dữ liệu mẫu tương ứng.`
      }, null, 2)
    }]
  };
}
