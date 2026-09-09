import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { buildMockCrmResponse } from "./mock-data.js";

declare const process: any;

export const server = new Server(
  {
    name: "mcp-server-crm",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Zod schemas for input validation
export const getCustomerStatusInput = z.object({
  customerName: z.string().optional().describe("Tên khách hàng hoặc đầu mối (Lead) cần tra cứu"),
  address: z.string().optional().describe("Địa chỉ khách hàng cần tra cứu (ví dụ: Hà Nội, Quận 1, Đống Đa)"),
  includeHistory: z.boolean().optional().describe("Có lấy lịch sử tương tác không")
});

export const getOpportunitiesInput = z.object({
  status: z.string().optional().describe("Lọc theo trạng thái cơ hội (Open, Won, Lost, etc.)")
});

export function truncateErrorMessage(err: unknown, maxLength: number = 300): string {
  const str = typeof err === "string" ? err : err instanceof Error ? err.message : String(err || "");
  return str.length > maxLength ? str.slice(0, maxLength) + "... [cắt ngắn]" : str;
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "crm_get_customer_status",
        description: "Tra cứu thông tin trạng thái khách hàng hoặc đầu mối (Lead) từ CRM. Hỗ trợ tìm kiếm theo tên hoặc theo địa chỉ (tỉnh/thành phố, quận/huyện, đường phố).",
        inputSchema: {
          type: "object",
          properties: {
            customerName: {
              type: "string",
              description: "Tên khách hàng hoặc tên đầu mối (Lead) cần tra cứu"
            },
            address: {
              type: "string",
              description: "Địa chỉ khách hàng cần tra cứu (ví dụ: Hà Nội, Quận 1, Đống Đa, TP.HCM)"
            },
            includeHistory: {
              type: "boolean",
              description: "Có lấy lịch sử tương tác không"
            }
          }
        },
      },
      {
        name: "crm_get_opportunities",
        description: "Lấy danh sách các cơ hội bán hàng (Opportunities) từ CRM",
        inputSchema: {
          type: "object",
          properties: {
            status: {
              type: "string",
              description: "Trạng thái cơ hội bán hàng: Open, Quotation, Converted, Lost"
            }
          }
        },
      },
    ],
  };
});

export function getAuthHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = { 'Accept': 'application/json' };
  if (apiKey) {
    if (apiKey.startsWith('token ')) {
      headers['Authorization'] = apiKey;
    } else if (apiKey.includes(':')) {
      headers['Authorization'] = `token ${apiKey}`;
    } else {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
  }
  return headers;
}

/**
 * Tra cứu khách hàng THEO ĐỊA CHỈ (tối ưu hóa song song & giới hạn timeout).
 * Trong ERPNext, địa chỉ nằm ở doctype Address riêng, liên kết tới Customer qua Dynamic Link.
 */
async function searchCustomersByAddress(addressQuery: string, headers: Record<string, string>, baseUrl: string) {
  const parts = addressQuery.split(',').map(s => s.trim()).filter(s => s.length >= 3);
  const searchParts = parts.length ? parts : [addressQuery.trim()];
  const orFilters = searchParts.flatMap(p => [
    ['address_line1', 'like', `%${p}%`],
    ['city', 'like', `%${p}%`]
  ]);

  const addrFields = JSON.stringify(["name", "address_title", "address_line1", "city", "address_type"]);
  const linkFilter = JSON.stringify([["Dynamic Link", "link_doctype", "=", "Customer"]]);
  const addrUrl = `${baseUrl}/api/resource/Address?fields=${encodeURIComponent(addrFields)}`
    + `&filters=${encodeURIComponent(linkFilter)}`
    + `&or_filters=${encodeURIComponent(JSON.stringify(orFilters))}`
    + `&limit_page_length=20`;

  const addrResp = await fetch(addrUrl, { headers, signal: AbortSignal.timeout(6000) });
  if (!addrResp.ok) {
    const errText = await addrResp.text().catch(() => '');
    throw new Error(`CRM API Error [${addrResp.status}]: ${truncateErrorMessage(errText)}`);
  }
  const addrData = await addrResp.json();
  const addresses: any[] = addrData.data || [];

  // Map ngược Address → Customer (giới hạn 8 địa chỉ và tải song song với timeout)
  const targetAddresses = addresses.slice(0, 8);
  const docResults = await Promise.all(
    targetAddresses.map(async (addr) => {
      try {
        const docResp = await fetch(`${baseUrl}/api/resource/Address/${encodeURIComponent(addr.name)}`, {
          headers,
          signal: AbortSignal.timeout(5000)
        });
        if (!docResp.ok) return null;
        const doc = await docResp.json();
        const customerLinks = (doc.data?.links || []).filter((l: any) => l.link_doctype === 'Customer');
        return { addr, customerLinks };
      } catch {
        return null;
      }
    })
  );

  // Thu thập danh sách link_name của Customer duy nhất để tránh fetch trùng lặp
  const customerMap = new Map<string, { addr: any; link: any }[]>();
  for (const item of docResults) {
    if (!item) continue;
    for (const link of item.customerLinks) {
      const existing = customerMap.get(link.link_name) || [];
      existing.push({ addr: item.addr, link });
      customerMap.set(link.link_name, existing);
    }
  }

  const distinctCustomerNames = Array.from(customerMap.keys()).slice(0, 10);
  const customerDetails = await Promise.all(
    distinctCustomerNames.map(async (linkName) => {
      try {
        const custResp = await fetch(
          `${baseUrl}/api/resource/Customer/${encodeURIComponent(linkName)}?fields=${encodeURIComponent(JSON.stringify(["customer_name", "customer_group", "territory"]))}`,
          { headers, signal: AbortSignal.timeout(5000) }
        );
        if (custResp.ok) {
          const cust = (await custResp.json())?.data;
          return { linkName, cust };
        }
      } catch {
        // Bỏ qua lỗi cá nhân từng bản ghi khách hàng
      }
      return { linkName, cust: null };
    })
  );

  const custDetailMap = new Map(customerDetails.map(c => [c.linkName, c.cust]));
  const contacts: any[] = [];

  for (const [linkName, links] of customerMap.entries()) {
    if (!distinctCustomerNames.includes(linkName)) continue;
    const cust = custDetailMap.get(linkName);
    for (const { addr } of links) {
      contacts.push({
        type: 'Customer',
        id: linkName,
        name: cust?.customer_name || linkName,
        customer_group: cust?.customer_group,
        territory: cust?.territory,
        matched_address: {
          address_type: addr.address_type,
          address_line1: addr.address_line1,
          city: addr.city
        }
      });
    }
  }

  return { total: contacts.length, contacts, searched_address: addressQuery };
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const rawArgs = (request.params.arguments as any) || {};
  const creds = rawArgs._integrationCredentials || {};
  const { apiKey, apiUrl } = creds;

  // Quyết định nguồn dữ liệu CRM:
  // - Nếu gateway truyền _mockMode=true (do tenant tắt CRM hoặc chưa có credentials):
  //   luôn trả dữ liệu mẫu MOCK_CUSTOMERS / MOCK_OPPORTUNITIES.
  // - Chỉ gọi CRM ngoài khi _mockMode KHÔNG phải true VÀ có apiUrl được cấp.
  // - Nếu không có _mockMode VÀ cũng không có apiUrl: fallback an toàn về mock data.
  const isMockMode = rawArgs._mockMode === true || !apiUrl;

  if (isMockMode) {
    return buildMockCrmResponse(toolName, rawArgs);
  }

  // --- Chế độ Live Integration (kết nối CRM thật qua REST API) ---
  const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
  const headers = getAuthHeaders(apiKey);

  if (toolName === "crm_get_customer_status") {
    const args = getCustomerStatusInput.parse(rawArgs);
    const keyword = (args.customerName || '').trim();
    const address = (args.address || '').trim();

    // Nhánh 1: Tra cứu theo ĐỊA CHỈ
    if (address) {
      try {
        const addressResult = await searchCustomersByAddress(address, headers, baseUrl);
        return {
          content: [{ type: "text", text: JSON.stringify(addressResult, null, 2) }]
        };
      } catch (err: any) {
        throw new Error(`Không thể tìm kiếm khách hàng theo địa chỉ trên CRM [${baseUrl}]. Chi tiết: ${truncateErrorMessage(err.message)}`);
      }
    }

    // Nhánh 2: Tra cứu theo TÊN KHÁCH HÀNG / ĐẦU MỐI
    try {
      const custFields = JSON.stringify(["name", "customer_name", "customer_group", "territory"]);
      let custUrl = `${baseUrl}/api/resource/Customer?fields=${encodeURIComponent(custFields)}&limit_page_length=20`;
      if (keyword) {
        const filters = JSON.stringify([["customer_name", "like", `%${keyword}%`]]);
        custUrl += `&filters=${encodeURIComponent(filters)}`;
      }

      const leadFields = JSON.stringify(["name", "lead_name", "email_id", "mobile_no", "status", "company_name"]);
      let leadUrl = `${baseUrl}/api/resource/Lead?fields=${encodeURIComponent(leadFields)}&limit_page_length=20`;
      if (keyword) {
        const filters = JSON.stringify([["lead_name", "like", `%${keyword}%`]]);
        leadUrl += `&filters=${encodeURIComponent(filters)}`;
      }

      const custResp = await fetch(custUrl, { headers, signal: AbortSignal.timeout(6000) }).catch(() => null);
      const leadResp = await fetch(leadUrl, { headers, signal: AbortSignal.timeout(6000) }).catch(() => null);

      if ((custResp && custResp.ok) || (leadResp && leadResp.ok)) {
        const custData = (custResp && custResp.ok) ? await custResp.json() : { data: [] };
        const leadData = (leadResp && leadResp.ok) ? await leadResp.json() : { data: [] };

        const customers = (custData.data || []).map((c: any) => ({
          type: "Customer",
          id: c.name,
          name: c.customer_name || c.name,
          customer_group: c.customer_group,
          territory: c.territory
        }));

        const leads = (leadData.data || []).map((l: any) => ({
          type: "Lead",
          id: l.name,
          name: l.lead_name || l.name,
          email: l.email_id,
          phone: l.mobile_no,
          status: l.status,
          company: l.company_name
        }));

        let combined = [...customers, ...leads];

        if (combined.length === 0 && keyword) {
          // Retry không lọc keyword nếu từ khóa quá cụ thể không ra (giới hạn tối đa 10 bản ghi mỗi bên)
          const allCustResp = await fetch(`${baseUrl}/api/resource/Customer?fields=${encodeURIComponent(custFields)}&limit_page_length=10`, { headers, signal: AbortSignal.timeout(6000) }).catch(() => null);
          const allLeadResp = await fetch(`${baseUrl}/api/resource/Lead?fields=${encodeURIComponent(leadFields)}&limit_page_length=10`, { headers, signal: AbortSignal.timeout(6000) }).catch(() => null);
          const allCustData = (allCustResp && allCustResp.ok) ? await allCustResp.json() : { data: [] };
          const allLeadData = (allLeadResp && allLeadResp.ok) ? await allLeadResp.json() : { data: [] };

          const allCustomers = (allCustData.data || []).map((c: any) => ({
            type: "Customer",
            id: c.name,
            name: c.customer_name || c.name,
            customer_group: c.customer_group,
            territory: c.territory
          }));
          const allLeads = (allLeadData.data || []).map((l: any) => ({
            type: "Lead",
            id: l.name,
            name: l.lead_name || l.name,
            email: l.email_id,
            phone: l.mobile_no,
            status: l.status,
            company: l.company_name
          }));
          combined = [...allCustomers, ...allLeads].slice(0, 15);
        }

        return {
          content: [{ type: "text", text: JSON.stringify({ total: combined.length, contacts: combined }, null, 2) }]
        };
      }
      throw new Error(`Máy chủ CRM [${baseUrl}] không phản hồi dữ liệu hợp lệ (HTTP error hoặc chưa phân quyền API).`);
    } catch (err: any) {
      throw new Error(`Không thể kết nối tới máy chủ CRM [${baseUrl}]. Chi tiết: ${truncateErrorMessage(err.message)}. Vui lòng kiểm tra lại URL và API Key trong Vault/Cấu hình tích hợp.`);
    }
  }

  if (toolName === "crm_get_opportunities") {
    const args = getOpportunitiesInput.parse(rawArgs);
    const oppFields = JSON.stringify(["name", "party_name", "opportunity_from", "status", "opportunity_amount", "currency"]);
    let oppUrl = `${baseUrl}/api/resource/Opportunity?fields=${encodeURIComponent(oppFields)}&limit_page_length=20`;
    if (args.status) {
      const filters = JSON.stringify([["status", "=", args.status]]);
      oppUrl += `&filters=${encodeURIComponent(filters)}`;
    }

    const resp = await fetch(oppUrl, { headers, signal: AbortSignal.timeout(6000) });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`CRM API Error [${resp.status}]: ${truncateErrorMessage(errText || resp.statusText)}`);
    }

    const data = await resp.json();
    const opportunities = (data.data || []).map((o: any) => ({
      id: o.name,
      party_name: o.party_name,
      type: o.opportunity_from,
      status: o.status,
      amount: o.opportunity_amount,
      currency: o.currency || "VND"
    }));

    return {
      content: [{ type: "text", text: JSON.stringify({ total: opportunities.length, opportunities }, null, 2) }]
    };
  }

  throw new Error(`Tool not found: ${toolName}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("CRM MCP Server running on stdio");
}

if (!process.env.VITEST && process.env.NODE_ENV !== "test") {
  main().catch(console.error);
}
