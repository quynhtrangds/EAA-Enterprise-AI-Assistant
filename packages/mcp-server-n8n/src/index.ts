import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const mcpServer = new Server({
  name: 'mcp-server-n8n',
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
        name: 'trigger_n8n_webhook',
        description: 'Kích hoạt một quy trình tự động hóa (Workflow) trên n8n qua Webhook để gửi tin nhắn Telegram, gửi Email, tạo ticket hoặc đồng bộ dữ liệu.',
        inputSchema: {
          type: 'object',
          properties: {
            webhookPath: {
              type: 'string',
              description: 'Đường dẫn hoặc mã ID webhook trên n8n (ví dụ: "26317864-61db-424c-87f5-abd29ce33599" hoặc "telegram-alert")'
            },
            message: {
              type: 'string',
              description: 'Nội dung thông báo hoặc thông tin chính cần gửi qua quy trình tự động'
            },
            data: {
              type: 'object',
              description: 'Dữ liệu bổ sung tùy chọn (ví dụ: { customerName: "Nguyễn Văn A", revenue: 50000000 })'
            }
          },
          required: ['webhookPath', 'message']
        }
      }
    ]
  };
});

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const rawArgs = (request.params.arguments as any) || {};

  if (toolName === 'trigger_n8n_webhook') {
    const { webhookPath, message, data } = rawArgs;
    const creds = rawArgs._integrationCredentials || {};
    let baseUrl = creds.apiUrl || process.env.N8N_BASE_URL || 'http://enterprise_ai_n8n:5678';
    const apiKey = creds.apiKey;

    if (!webhookPath) {
      throw new Error('Thiếu tham số webhookPath để kích hoạt n8n workflow.');
    }

    baseUrl = baseUrl.replace(/\/+$/, '');

    let targetUrl: string;
    if (webhookPath.startsWith('http://') || webhookPath.startsWith('https://')) {
      targetUrl = webhookPath;
    } else if (webhookPath.startsWith('/')) {
      targetUrl = `${baseUrl}${webhookPath}`;
    } else {
      targetUrl = `${baseUrl}/webhook/${webhookPath}`;
    }

    const payload = {
      sender: 'Enterprise AI Assistant',
      message: message || '',
      ...(data && typeof data === 'object' ? data : {}),
      timestamp: new Date().toISOString()
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    if (apiKey) {
      headers['X-N8N-API-KEY'] = apiKey;
    }

    let response: Response;
    try {
      response = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      // Nếu production URL trả về 404 (chưa Publish), tự động thử fallback sang webhook-test
      if (response.status === 404 && targetUrl.includes('/webhook/')) {
        const testUrl = targetUrl.replace('/webhook/', '/webhook-test/');
        const testResp = await fetch(testUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });
        if (testResp.ok) {
          response = testResp;
        }
      }
    } catch (err: any) {
      throw new Error(`Không thể kết nối đến máy chủ n8n tại ${targetUrl}: ${err.message}`);
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`n8n phản hồi lỗi [HTTP ${response.status}]: ${errText || response.statusText}`);
    }

    let responseData: unknown;
    try {
      responseData = await response.json();
    } catch {
      responseData = await response.text();
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            status: 'Triggered successfully',
            targetUrl,
            deliveredMessage: message,
            n8nResponse: responseData
          }, null, 2)
        }
      ]
    };
  }

  throw new Error(`Tool not found: ${toolName}`);
});

async function run() {
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  console.log('n8n MCP Server running on stdio');
}

run().catch(console.error);
