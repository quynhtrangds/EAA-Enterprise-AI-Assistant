import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const mcpServer = new Server({
  name: 'mcp-server-gitea',
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
        name: 'search_repositories',
        description: 'Tìm kiếm repository mã nguồn trên Gitea',
        inputSchema: {
          type: 'object',
          properties: {
            keyword: {
              type: 'string',
              description: 'Tên hoặc từ khoá repository (tuỳ chọn)'
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

  if (toolName === 'search_repositories') {
    const keyword = (rawArgs.keyword as string || '').toLowerCase();
    const creds = rawArgs._integrationCredentials || {};
    const { apiKey, apiUrl } = creds;

    if (!apiUrl) {
      throw new Error("Chưa cấu hình Endpoint URL cho hệ thống Gitea. Vui lòng vào Cấu hình Tích hợp để nhập URL.");
    }

    const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
    const targetUrl = `${baseUrl}/api/v1/repos/search?q=${encodeURIComponent(keyword)}`;

    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (apiKey) {
      headers['Authorization'] = apiKey.startsWith('token ') || apiKey.startsWith('Bearer ') ? apiKey : `token ${apiKey}`;
    }

    const resp = await fetch(targetUrl, { headers });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Gitea API Error [${resp.status}]: ${errText || resp.statusText}`);
    }

    const body = await resp.json();
    const repoList = Array.isArray(body) ? body : (body.data || []);

    const repositories = repoList.map((r: any) => {
      let rawUrl = r.html_url || r.clone_url || '';
      // Convert host.docker.internal to localhost so browser on host machine can open it directly
      if (rawUrl.includes('host.docker.internal')) {
        rawUrl = rawUrl.replace('host.docker.internal', 'localhost');
      }

      return {
        id: `REPO-${r.id}`,
        name: r.name || r.full_name,
        url: rawUrl,
        status: r.archived ? 'archived' : 'active',
        issues: r.open_issues_count ?? 0,
        description: r.description || ''
      };
    });

    return {
      content: [
        { 
          type: 'text', 
          text: JSON.stringify({
            keyword: keyword || null,
            total_repos: repositories.length,
            repositories: repositories
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
  console.log('Gitea MCP Server running on stdio');
}

run().catch(console.error);
