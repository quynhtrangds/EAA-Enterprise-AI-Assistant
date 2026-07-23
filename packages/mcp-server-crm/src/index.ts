import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

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
  keyword: z.string().optional().describe("Mã hoặc tên khách hàng/lead cần tìm kiếm")
});

const getOpportunitiesInput = z.object({
  status: z.string().optional().describe("Trạng thái cơ hội kinh doanh (ví dụ: Open, Quotation, Converted, Lost)")
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "crm_get_customer_status",
        description: "Lấy danh sách khách hàng (Customer) và tiềm năng (Lead) từ hệ thống CRM.",
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

function getAuthHeaders(apiKey?: string): Record<string, string> {
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

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const rawArgs = (request.params.arguments as any) || {};
  const creds = rawArgs._integrationCredentials || {};
  const { apiKey, apiUrl } = creds;

  if (!apiUrl) {
    throw new Error("Chưa cấu hình Endpoint URL cho hệ thống CRM. Vui lòng vào Cấu hình Tích hợp để nhập URL.");
  }

  const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
  const headers = getAuthHeaders(apiKey);

  if (toolName === "crm_get_customer_status") {
    const args = getCustomerStatusInput.parse(rawArgs);
    const keyword = args.keyword?.trim() || "";

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

      const [custResp, leadResp] = await Promise.all([
        fetch(custUrl, { headers }),
        fetch(leadUrl, { headers })
      ]);

      if (custResp.ok || leadResp.ok) {
        const custData = custResp.ok ? await custResp.json() : { data: [] };
        const leadData = leadResp.ok ? await leadResp.json() : { data: [] };

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

        const combined = [...customers, ...leads];
        return {
          content: [{ type: "text", text: JSON.stringify({ total: combined.length, contacts: combined }, null, 2) }]
        };
      }
    } catch (err: any) {
      console.error("Frappe CRM fetch failed, trying fallback:", err.message);
    }

    // Fallback to standard contact API
    const targetUrl = keyword
      ? `${baseUrl}/crm/v3/objects/contacts/${encodeURIComponent(keyword)}`
      : `${baseUrl}/crm/v3/objects/contacts`;
    const resp = await fetch(targetUrl, { headers });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`CRM API Error [${resp.status}]: ${errText || resp.statusText}`);
    }
    const data = await resp.json();
    return {
      content: [{ type: "text", text: JSON.stringify(data) }]
    };
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
