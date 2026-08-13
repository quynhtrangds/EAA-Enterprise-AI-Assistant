import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

export function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

export interface DocumentItem {
  id: string;
  title: string;
  category?: string;
  content: string;
}

// Enterprise Knowledge Base Documents
export const COMPANY_DOCUMENTS: DocumentItem[] = [
  {
    id: 'doc-001',
    title: 'Chính sách nghỉ phép năm 2026',
    category: 'Nhân sự',
    content: 'Mỗi nhân viên chính thức được nghỉ 12 ngày phép một năm. Nếu làm việc trên 5 năm sẽ được thêm 1 ngày phép. Vui lòng đăng ký trước qua cổng thông tin nhân sự hoặc ERP.'
  },
  {
    id: 'doc-002',
    title: 'Hướng dẫn cài đặt và kết nối VPN nội bộ',
    category: 'Công nghệ thông tin',
    content: 'Để kết nối VPN làm việc từ xa, tải phần mềm OpenVPN Client, import tệp cấu hình được phòng IT cấp. Đăng nhập bằng tài khoản email công ty.'
  },
  {
    id: 'doc-003',
    title: 'Quy trình ứng phó và xử lý sự cố (Incident Response SOP)',
    category: 'Vận hành',
    content: 'Khi gặp sự cố hệ thống cấp độ khẩn cấp (Severity 1), nhân viên cần tạo ticket trên hệ thống Zammad và thông báo trực tiếp cho đội trực vận hành DevOps. Thời gian phản hồi kỳ vọng dưới 15 phút.'
  },
  {
    id: 'doc-004',
    title: 'Chính sách an toàn và bảo mật thông tin doanh nghiệp',
    category: 'An ninh mạng',
    content: 'Nghiêm cấm chia sẻ tài liệu và mã nguồn nội bộ ra các nền tảng công cộng. Toàn bộ mã nguồn phải lưu trữ trên hệ thống Gitea nội bộ. Mật khẩu tài khoản phải đủ từ 12 ký tự trở lên và định kỳ thay đổi.'
  },
  {
    id: 'doc-005',
    title: 'Quy trình thanh toán và duyệt chi phí công tác',
    category: 'Tài chính - Kế toán',
    content: 'Mọi khoản chi phí công tác phải có hóa đơn đỏ hợp lệ (VAT) và được Trưởng bộ phận duyệt trước trên hệ thống ERP trước khi chuyển Kế toán thanh toán vào ngày 15 và 30 hàng tháng.'
  }
];

const mcpServer = new Server(
  {
    name: 'mcp-server-rag',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'search_internal_documents',
        description: 'Tìm kiếm tri thức, tài liệu nội bộ của công ty (Chính sách nhân sự, Hướng dẫn CNTT, Quy trình vận hành, Quy định bảo mật)',
        inputSchema: {
          type: 'object',
          properties: {
            keyword: {
              type: 'string',
              description: 'Từ khóa tìm kiếm (ví dụ: nghỉ phép, VPN, sự cố, bảo mật, thanh toán)'
            }
          },
          required: ['keyword']
        }
      }
    ]
  };
});

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const rawArgs = (request.params.arguments as any) || {};
  const creds = rawArgs._integrationCredentials || {};
  const { apiKey, apiUrl } = creds;

  if (toolName === 'search_internal_documents') {
    const rawKeyword = String(rawArgs.keyword || '').trim();
    const keyword = removeAccents(rawKeyword.toLowerCase());

    // If external RAG / Vector Search endpoint is configured
    if (apiUrl) {
      const cleanUrl = apiUrl.replace(/\/+$/, '');
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        };
        if (apiKey) {
          headers['Authorization'] = apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`;
        }

        const resp = await fetch(`${cleanUrl}/api/v1/search`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ query: rawKeyword, limit: 5 }),
          signal: AbortSignal.timeout(8000)
        });

        if (resp.ok) {
          const data = await resp.json();
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(data, null, 2)
              }
            ]
          };
        }
      } catch (err: any) {
        console.warn(`[RAG Server] Fetch to external RAG API [${apiUrl}] failed (${err.message}). Fallback to internal KB store.`);
      }
    }

    // Local Enterprise Knowledge Base search
    const results = COMPANY_DOCUMENTS.filter((doc) => {
      const titleNorm = removeAccents(doc.title.toLowerCase());
      const contentNorm = removeAccents(doc.content.toLowerCase());
      const categoryNorm = removeAccents((doc.category || '').toLowerCase());
      return titleNorm.includes(keyword) || contentNorm.includes(keyword) || categoryNorm.includes(keyword);
    });

    const finalDocs = results.length > 0 ? results : COMPANY_DOCUMENTS.slice(0, 3);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              query: rawKeyword,
              total_found: results.length,
              documents: finalDocs.map((d) => ({
                id: d.id,
                title: d.title,
                category: d.category,
                content: d.content
              }))
            },
            null,
            2
          )
        }
      ]
    };
  }

  throw new Error(`Tool not found: ${toolName}`);
});

async function run() {
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  console.error('RAG MCP Server running on stdio');
}

run().catch(console.error);
