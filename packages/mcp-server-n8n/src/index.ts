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
        description: 'Kích hoạt một quy trình tự động hóa (Workflow) trên n8n qua Webhook để gửi tin nhắn Telegram, gửi Email, tạo ticket hoặc đồng bộ dữ liệu. Nếu người dùng không chỉ định webhookPath cụ thể, hệ thống sẽ tự động sử dụng đường dẫn webhook mặc định đã cấu hình trong hệ thống.',
        inputSchema: {
          type: 'object',
          properties: {
            webhookPath: {
              type: 'string',
              description: 'Đường dẫn hoặc mã ID webhook trên n8n (ví dụ: "26317864-61db-424c-87f5-abd29ce33599" hoặc để trống để tự động dùng webhook mặc định).'
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
          required: ['message']
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
    const defaultWebhookPath = creds.defaultWebhookPath || '26317864-61db-424c-87f5-abd29ce33599';

    baseUrl = baseUrl.replace(/\/+$/, '');

    // Sử dụng path được truyền vào hoặc fallback về defaultWebhookPath
    const effectivePath = (webhookPath && typeof webhookPath === 'string' && webhookPath.trim())
      ? webhookPath.trim()
      : defaultWebhookPath;

    let targetUrl: string;
    if (effectivePath.startsWith('http://') || effectivePath.startsWith('https://')) {
      targetUrl = effectivePath;
    } else if (effectivePath.startsWith('/')) {
      targetUrl = `${baseUrl}${effectivePath}`;
    } else {
      targetUrl = `${baseUrl}/webhook/${effectivePath}`;
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

      // Nếu URL trả về 404 (chưa đăng ký đường dẫn này), thử fallback về defaultWebhookPath hoặc webhook-test
      if (response.status === 404) {
        // 1. Thử fallback sang defaultWebhookPath nếu trước đó dùng path khác
        if (effectivePath !== defaultWebhookPath) {
          const defaultUrl = `${baseUrl}/webhook/${defaultWebhookPath}`;
          const defaultResp = await fetch(defaultUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
          });
          if (defaultResp.ok) {
            response = defaultResp;
            targetUrl = defaultUrl;
          }
        }

        // 2. Nếu vẫn 404 và có chứa /webhook/, thử webhook-test
        if (!response.ok && targetUrl.includes('/webhook/')) {
          const testUrl = targetUrl.replace('/webhook/', '/webhook-test/');
          const testResp = await fetch(testUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
          });
          if (testResp.ok) {
            response = testResp;
            targetUrl = testUrl;
          }
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
