import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

// Mock documents for RAG
const MOCK_DOCUMENTS = [
  {
    id: 'doc-001',
    title: 'Chính sách nghỉ phép năm 2026',
    content: 'Mỗi nhân viên chính thức được nghỉ 12 ngày phép một năm. Nếu làm việc trên 5 năm sẽ được thêm 1 ngày phép. Vui lòng xin phép trước 3 ngày qua hệ thống ERP.'
  },
  {
    id: 'doc-002',
    title: 'Hướng dẫn cài đặt VPN nội bộ',
    content: 'Để kết nối VPN, vui lòng tải OpenVPN client, sử dụng file cấu hình được cấp bởi phòng IT. Username là email công ty, mật khẩu giống với mật khẩu email.'
  },
  {
    id: 'doc-003',
    title: 'Quy trình xử lý sự cố (Incident Response)',
    content: 'Khi có sự cố hệ thống (Severity 1), cần tạo ticket trên Zammad ngay lập tức và assign cho nhóm DevOps. Thời gian phản hồi kỳ vọng là 15 phút.'
  },
  {
    id: 'doc-004',
    title: 'Chính sách bảo mật thông tin',
    content: 'Nghiêm cấm chia sẻ mã nguồn công ty lên các nền tảng public. Mọi code phải được commit và push lên Gitea nội bộ. Mật khẩu phải dài ít nhất 12 ký tự và đổi 3 tháng 1 lần.'
  }
];

const mcpServer = new Server({
  name: 'mcp-server-rag',
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
        name: 'search_internal_documents',
        description: 'Tìm kiếm thông tin trong kho tài liệu nội bộ của công ty (Chính sách, Hướng dẫn, Quy trình)',
        inputSchema: {
          type: 'object',
          properties: {
            keyword: {
              type: 'string',
              description: 'Từ khóa tìm kiếm (ví dụ: nghỉ phép, VPN, bảo mật)'
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
  const args = request.params.arguments || {};

  if (toolName === 'search_internal_documents') {
    function removeAccents(str: string) {
      return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
    }
    
    const keyword = removeAccents((args.keyword as string || '').toLowerCase());
    
    // Simple mock search matching title or content
    const results = MOCK_DOCUMENTS.filter(doc => 
      removeAccents(doc.title.toLowerCase()).includes(keyword) || 
      removeAccents(doc.content.toLowerCase()).includes(keyword)
    );
    
    return {
      content: [
        { 
          type: 'text', 
          text: JSON.stringify({
            keyword,
            total_results: results.length,
            documents: results
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
  console.log('RAG MCP Server running on stdio');
}

run().catch(console.error);
