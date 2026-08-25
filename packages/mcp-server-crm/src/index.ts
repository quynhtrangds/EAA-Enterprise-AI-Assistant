import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { buildMockCrmResponse } from "./mock-data.js";

const server = new Server(
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

const getCustomerStatusInput = z.object({
  keyword: z.string().optional().describe("Mã hoặc tên khách hàng/lead cần tìm kiếm"),
  address: z.string().optional().describe("Địa chỉ cần tra cứu (đường, thành phố...). Hãy DÙNG tham số này khi người dùng tìm khách hàng THEO ĐỊA CHỈ — hệ thống sẽ tìm trong sổ địa chỉ ERPNext và trả về khách hàng liên kết.")
});

const getOpportunitiesInput = z.object({
  status: z.string().optional().describe("Trạng thái cơ hội kinh doanh (ví dụ: Open, Quotation, Converted, Lost)")
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "crm_get_customer_status",
        description: "Lấy danh sách khách hàng (Customer) và tiềm năng (Lead) từ hệ thống CRM. Hỗ trợ tìm theo `keyword` (tên/mã) hoặc theo `address` (địa chỉ — tra trong sổ địa chỉ ERPNext và trả về khách hàng liên kết).",
        inputSchema: {
          type: "object",
          properties: getCustomerStatusInput.shape,
        },
      },
      {
        name: "crm_get_opportunities",
        description: "Lấy danh sách cơ hội kinh doanh (Opportunity/Deal) từ hệ thống CRM.",
        inputSchema: {
          type: "object",
          properties: getOpportunitiesInput.shape,
        },
      }
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
 * Tra cứu khách hàng THEO ĐỊA CHỈ.
 * Trong ERPNext, địa chỉ nằm ở doctype Address riêng, liên kết tới Customer
 * qua Dynamic Link — nên luồng là: tìm Address khớp → đọc links → map ngược
 * về Customer. Các phần của địa chỉ (phân tách bởi dấu phẩy) được tìm OR trên
 * address_line1/city để khớp cả khi người dùng nhập đầy đủ lẫn một phần.
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

  const addrResp = await fetch(addrUrl, { headers });
  if (!addrResp.ok) {
    throw new Error(`CRM API Error [${addrResp.status}]: ${await addrResp.text()}`);
  }
  const addrData = await addrResp.json();
  const addresses: any[] = addrData.data || [];

  // Map ngược Address → Customer (giới hạn 10 địa chỉ để tránh gọi quá nhiều)
  const contacts: any[] = [];
  for (const addr of addresses.slice(0, 10)) {
    const docResp = await fetch(`${baseUrl}/api/resource/Address/${encodeURIComponent(addr.name)}`, { headers });
    if (!docResp.ok) continue;
    const doc = await docResp.json();
    const customerLinks = (doc.data?.links || []).filter((l: any) => l.link_doctype === 'Customer');
    for (const link of customerLinks) {
      let customerName = link.link_name;
      let customerGroup: string | undefined;
      let territory: string | undefined;
      const custResp = await fetch(
        `${baseUrl}/api/resource/Customer/${encodeURIComponent(link.link_name)}?fields=${encodeURIComponent(JSON.stringify(["customer_name", "customer_group", "territory"]))}`,
        { headers }
      );
      if (custResp.ok) {
        const cust = (await custResp.json())?.data;
        if (cust?.customer_name) customerName = cust.customer_name;
        customerGroup = cust?.customer_group;
        territory = cust?.territory;
      }
      contacts.push({
        type: 'Customer',
        id: link.link_name,
        name: customerName,
        customer_group: customerGroup,
        territory,
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

  // CHẾ ĐỘ DỮ LIỆU MẪU: gateway truyền _mockMode khi tích hợp bị TẮT/chưa cấu
  // hình — trả dữ liệu mẫu kèm nhãn _mock thay vì từ chối, để trợ lý AI vẫn
  // hữu ích và người dùng biết rõ đây không phải dữ liệu thật.
  if (rawArgs._mockMode === true || !apiUrl) {
    return buildMockCrmResponse(toolName, rawArgs);
  }

  const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
  const headers = getAuthHeaders(apiKey);

  if (toolName === "crm_get_customer_status") {
    const args = getCustomerStatusInput.parse(rawArgs);
    const keyword = args.keyword?.trim() || "";

    // Ưu tiên tra cứu theo địa chỉ nếu người dùng cung cấp
    if (args.address && args.address.trim()) {
      const result = await searchCustomersByAddress(args.address.trim(), headers, baseUrl);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
      };
    }

    try {
      // Try Frappe/ERPNext CRM API
      const custFields = JSON.stringify(["name", "customer_name", "customer_type", "customer_group", "territory"]);
      let custUrl = `${baseUrl}/api/resource/Customer?fields=${encodeURIComponent(custFields)}`;
      if (keyword) {
        const filters = JSON.stringify([["customer_name", "like", `%${keyword}%`]]);
        custUrl += `&filters=${encodeURIComponent(filters)}`;
      }

      const leadFields = JSON.stringify(["name", "lead_name", "email_id", "mobile_no", "status", "company_name"]);
      let leadUrl = `${baseUrl}/api/resource/Lead?fields=${encodeURIComponent(leadFields)}`;
      if (keyword) {
        const filters = JSON.stringify([["lead_name", "like", `%${keyword}%`]]);
        leadUrl += `&filters=${encodeURIComponent(filters)}`;
      }

      const custResp = await fetch(custUrl, { headers }).catch(() => null);
      const leadResp = await fetch(leadUrl, { headers }).catch(() => null);

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
          // Retry without keyword filter if keyword was generic
          const allCustResp = await fetch(`${baseUrl}/api/resource/Customer?fields=${encodeURIComponent(custFields)}`, { headers }).catch(() => null);
          const allLeadResp = await fetch(`${baseUrl}/api/resource/Lead?fields=${encodeURIComponent(leadFields)}`, { headers }).catch(() => null);
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
          combined = [...allCustomers, ...allLeads];
        }

        return {
          content: [{ type: "text", text: JSON.stringify({ total: combined.length, contacts: combined }, null, 2) }]
        };
      }
      throw new Error(`Máy chủ CRM [${baseUrl}] không phản hồi dữ liệu hợp lệ (HTTP error hoặc chưa phân quyền API).`);
    } catch (err: any) {
      throw new Error(`Không thể kết nối tới máy chủ CRM [${baseUrl}]. Chi tiết: ${err.message}. Vui lòng kiểm tra lại URL và API Key trong Vault/Cấu hình tích hợp.`);
    }
  }

  if (toolName === "crm_get_opportunities") {
    const args = getOpportunitiesInput.parse(rawArgs);
    const oppFields = JSON.stringify(["name", "party_name", "opportunity_from", "status", "opportunity_amount", "currency"]);
    let oppUrl = `${baseUrl}/api/resource/Opportunity?fields=${encodeURIComponent(oppFields)}`;
    if (args.status) {
      const filters = JSON.stringify([["status", "=", args.status]]);
      oppUrl += `&filters=${encodeURIComponent(filters)}`;
    }

    const resp = await fetch(oppUrl, { headers });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`CRM API Error [${resp.status}]: ${errText || resp.statusText}`);
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

main().catch(console.error);
