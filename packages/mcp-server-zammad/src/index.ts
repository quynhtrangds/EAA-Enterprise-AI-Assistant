import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const mcpServer = new Server({
  name: 'mcp-server-zammad',
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
        name: 'get_open_tickets',
        description: 'Lấy danh sách các ticket đang mở (open/new tickets) từ Zammad',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ]
  };
});

export function getAuthHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = { 'Accept': 'application/json' };
  if (apiKey) {
    headers['Authorization'] = apiKey.startsWith('Token ') || apiKey.startsWith('Bearer ') ? apiKey : `Token token=${apiKey}`;
  }
  return headers;
}

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const rawArgs = (request.params.arguments as any) || {};

  if (toolName === 'get_open_tickets') {
    const creds = rawArgs._integrationCredentials || {};
    const { apiKey, apiUrl } = creds;

    if (!apiUrl) {
      throw new Error("Chưa cấu hình Endpoint URL cho hệ thống Zammad. Vui lòng vào Cấu hình Tích hợp để nhập URL.");
    }

    if (!apiKey) {
      throw new Error("Chưa nhập API Key / Token cho hệ thống Zammad. Vui lòng vào Cấu hình Tích hợp để nhập Token Access của Zammad.");
    }

    const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
    const authHeader = apiKey.startsWith('Token ') || apiKey.startsWith('Bearer ') ? apiKey : `Token token=${apiKey}`;
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Authorization': authHeader
    };

    // Try fetching tickets list directly
    let targetUrl = `${baseUrl}/api/v1/tickets?expand=true`;
    let resp = await fetch(targetUrl, { headers });

    if (!resp.ok) {
      targetUrl = `${baseUrl}/api/v1/tickets/search?query=state.name:open%20OR%20state.name:new%20OR%20state_id:1%20OR%20state_id:2`;
      resp = await fetch(targetUrl, { headers });
    }

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Zammad API Error [${resp.status}]: ${errText || resp.statusText}`);
    }

    const data = await resp.json();
    let ticketsList: any[] = [];

    if (Array.isArray(data)) {
      ticketsList = data;
    } else if (data.assets?.Ticket) {
      ticketsList = Object.values(data.assets.Ticket);
    } else if (Array.isArray(data.tickets)) {
      ticketsList = data.tickets;
    }

    const parsedTickets = ticketsList.map((t: any) => ({
      id: t.id,
      number: t.number || t.id,
      title: t.title || t.subject || 'No Title',
      state: t.state || (t.state_id === 1 ? 'new' : t.state_id === 2 ? 'open' : 'active'),
      created_at: t.created_at
    }));

    return {
      content: [
        { 
          type: 'text', 
          text: JSON.stringify({ total: parsedTickets.length, tickets: parsedTickets }, null, 2) 
        }
      ]
    };
  }

  throw new Error(`Tool not found: ${toolName}`);
});

async function run() {
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  console.log('Zammad MCP Server running on stdio');
}

run().catch(console.error);
