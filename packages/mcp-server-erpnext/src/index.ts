import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';



const mcpServer = new Server({
  name: 'mcp-server-erpnext',
  version: '1.0.0'
}, {
  capabilities: {
    tools: {}
  }
});

mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_inventory_status',
        description: 'Lấy trạng thái tồn kho của các mặt hàng trong hệ thống ERPNext',
        inputSchema: {
          type: 'object',
          properties: {
            keyword: {
              type: 'string',
              description: 'Tên hoặc mã mặt hàng để tìm kiếm (tuỳ chọn)'
            }
          }
        }
      }
    ]
  };
});

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const rawArgs = (request.params.arguments as any) || {};

  if (toolName === 'get_inventory_status') {
    const keyword = (rawArgs.keyword as string || '').trim();
    const creds = rawArgs._integrationCredentials || {};
    const { apiKey, apiUrl } = creds;

    if (!apiUrl) {
      throw new Error("Chưa cấu hình Endpoint URL cho hệ thống ERPNext. Vui lòng vào Cấu hình Tích hợp để nhập URL.");
    }

    const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
    const fields = JSON.stringify(['name', 'item_name', 'item_group', 'stock_uom', 'opening_stock', 'valuation_rate', 'standard_rate']);
    let queryParams = `fields=${encodeURIComponent(fields)}`;
    
    if (keyword) {
      const orFilters = JSON.stringify([
        ['name', 'like', `%${keyword}%`],
        ['item_name', 'like', `%${keyword}%`]
      ]);
      queryParams += `&or_filters=${encodeURIComponent(orFilters)}`;
    }

    const targetUrl = `${baseUrl}/api/resource/Item?${queryParams}`;

    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (apiKey) {
      headers['Authorization'] = apiKey.startsWith('token ') ? apiKey : `token ${apiKey}`;
    }

    const resp = await fetch(targetUrl, { headers });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`ERPNext API Error [${resp.status}]: ${errText || resp.statusText}`);
    }

    const data = (await resp.json()) as { data?: any[] };
    const items = data.data || [];

    // Also fetch Bin (actual stock qty per warehouse) to get actual_qty
    try {
      const binFields = JSON.stringify(['item_code', 'warehouse', 'actual_qty']);
      const binUrl = `${baseUrl}/api/resource/Bin?fields=${encodeURIComponent(binFields)}`;
      const binResp = await fetch(binUrl, { headers });
      if (binResp.ok) {
        const binData = (await binResp.json()) as { data?: any[] };
        const bins = binData.data || [];
        const stockMap = new Map<string, number>();
        for (const b of bins) {
          const qty = stockMap.get(b.item_code) || 0;
          stockMap.set(b.item_code, qty + (b.actual_qty || 0));
        }

        for (const item of items) {
          item.actual_qty = stockMap.has(item.name) ? stockMap.get(item.name) : (item.opening_stock || 0);
        }
      } else {
        for (const item of items) {
          item.actual_qty = item.opening_stock || 0;
        }
      }
    } catch {
      for (const item of items) {
        item.actual_qty = item.opening_stock || 0;
      }
    }

    return {
      content: [
        { 
          type: 'text', 
          text: JSON.stringify({ total: items.length, items }, null, 2) 
        }
      ]
    };
  }

  throw new Error(`Tool not found: ${toolName}`);
});

async function run() {
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  console.log('ERPNext MCP Server running on stdio');
}

run().catch(console.error);
