import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';
import { McpGatewayClient } from '../gateway/mcp-gateway-client.js';
import { MockLLMProvider } from '../providers/mock-llm-provider.js';
import type { ChatInput, ChatOutput, PlannedToolCall, ToolCallTrace } from '../types/chat.js';

interface GatewayTool {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  permitted?: boolean;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function formatMoney(value: unknown): string {
  return `${Number(value ?? 0).toLocaleString('vi-VN')} VND`;
}

function normalizeVietnamese(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'D')
    .toLowerCase();
}

function isCustomerOrdersQuestion(message: string): boolean {
  const normalized = normalizeVietnamese(message);
  return normalized.includes('khach hang') && normalized.includes('don hang');
}

function toTrace(plannedToolCall: PlannedToolCall, gatewayResult: Awaited<ReturnType<McpGatewayClient['callTool']>>): ToolCallTrace {
  return {
    ...plannedToolCall,
    success: gatewayResult.success,
    durationMs: gatewayResult.durationMs,
    data: gatewayResult.data,
    errorCode: gatewayResult.errorCode,
    message: gatewayResult.message
  };
}

function toOpenAITool(tool: GatewayTool): ChatCompletionTool {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description ?? tool.title ?? tool.name,
      parameters: tool.inputSchema ?? { type: 'object', properties: {} }
    }
  };
}

function parseToolArguments(rawArguments: string | undefined): Record<string, unknown> {
  if (!rawArguments) {
    return {};
  }

  const parsed = JSON.parse(rawArguments) as unknown;
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
}

function buildCustomerOrdersAnswer(customer: any, orders: any[]): string {
  if (orders.length === 0) {
    return `Kh\u00e1ch h\u00e0ng ${customer.fullName} ch\u01b0a c\u00f3 \u0111\u01a1n h\u00e0ng n\u00e0o trong 90 ng\u00e0y g\u1ea7n nh\u1ea5t.`;
  }

  const orderSummary = orders
    .slice(0, 8)
    .map((order) => `${order.orderCode} (${order.status}, ${formatMoney(order.totalAmount)})`)
    .join('; ');

  return `Kh\u00e1ch h\u00e0ng ${customer.fullName} c\u00f3 ${orders.length} \u0111\u01a1n h\u00e0ng trong 90 ng\u00e0y g\u1ea7n nh\u1ea5t: ${orderSummary}.`;
}

function formatToolErrorMessage(message?: string): string {
  if (!message) {
    return 'Hệ thống tạm thời chưa thể truy vấn được thông tin này. Bạn vui lòng thử lại hoặc bổ sung thêm chi tiết câu hỏi.';
  }

  if (message.startsWith('[') || message.startsWith('{')) {
    try {
      const parsed = JSON.parse(message);
      if (Array.isArray(parsed)) {
        const missingFields = parsed.map(err => err.path?.join('.')).filter(Boolean);
        if (missingFields.length > 0) {
          return `Yêu cầu tra cứu cần bổ sung thêm thông tin khoảng thời gian hoặc tham số: ${missingFields.join(', ')}.`;
        }
      }
    } catch {
      // Ignore JSON parse error
    }
    return 'Thông số tra cứu chưa hợp lệ hoặc thiếu dữ liệu tham số đầu vào.';
  }

  return message;
}

const VIEWER_PERMISSION_DENIED_MESSAGE =
  `⚠️ **Bạn không có quyền thực hiện thao tác này.**\n\n` +
  `Tài khoản hiện tại chưa được cấp quyền truy vấn dữ liệu này. Vui lòng liên hệ Quản trị viên để biết thêm chi tiết.`;

export class ChatService {
  private readonly llm = new MockLLMProvider();

  async chat(input: ChatInput): Promise<ChatOutput> {
    const gateway = new McpGatewayClient();
    try {
      if (env.LLM_PROVIDER === 'openai' || env.LLM_PROVIDER === 'local') {
        return await this.chatWithLLM(input, gateway);
      }
      return await this.chatWithMock(input, gateway);
    } finally {
      await gateway.disconnect();
    }
  }

  private async chatWithMock(input: ChatInput, gateway: McpGatewayClient): Promise<ChatOutput> {
    await gateway.listTools(input.authToken);
    const plannedToolCall = this.llm.planToolCall(input.message);

    if (!plannedToolCall) {
      return {
        sessionId: input.sessionId,
        answer: this.llm.buildAnswer(input.message, null, null),
        toolCalls: []
      };
    }

    const gatewayResult = await gateway.callTool(
      input.authToken,
      input.sessionId,
      plannedToolCall.toolName,
      plannedToolCall.arguments
    );

    const trace = toTrace(plannedToolCall, gatewayResult);

    if (!gatewayResult.success) {
      return {
        sessionId: input.sessionId,
        answer: gatewayResult.message ?? 'Không thể gọi tool.',
        toolCalls: [trace]
      };
    }

    if (plannedToolCall.toolName === 'search_customer' && isCustomerOrdersQuestion(input.message)) {
      const customers = Array.isArray((gatewayResult.data as any)?.customers) ? (gatewayResult.data as any).customers : [];
      const customer = customers[0];

      if (!customer) {
        return {
          sessionId: input.sessionId,
          answer: 'Không tìm thấy khách hàng phù hợp.',
          toolCalls: [trace]
        };
      }

      const ordersCall: PlannedToolCall = {
        toolName: 'get_customer_orders',
        arguments: {
          customerId: customer.customerId,
          fromDate: daysAgo(90),
          toDate: today(),
          limit: 20
        }
      };

      const ordersResult = await gateway.callTool(input.authToken, input.sessionId, ordersCall.toolName, ordersCall.arguments);
      const ordersTrace = toTrace(ordersCall, ordersResult);

      if (!ordersResult.success) {
        return {
          sessionId: input.sessionId,
          answer: ordersResult.message ?? 'Không thể lấy danh sách đơn hàng.',
          toolCalls: [trace, ordersTrace]
        };
      }

      const orders = Array.isArray((ordersResult.data as any)?.orders) ? (ordersResult.data as any).orders : [];
      return {
        sessionId: input.sessionId,
        answer: buildCustomerOrdersAnswer(customer, orders),
        toolCalls: [trace, ordersTrace]
      };
    }

    return {
      sessionId: input.sessionId,
      answer: this.llm.buildAnswer(input.message, plannedToolCall, gatewayResult.data),
      toolCalls: [trace]
    };
  }

  private async chatWithLLM(input: ChatInput, gateway: McpGatewayClient): Promise<ChatOutput> {
    try {
      const isLocal = env.LLM_PROVIDER === 'local';
      const apiKey = isLocal ? (env.OPENAI_API_KEY || 'local-key') : env.OPENAI_API_KEY;

      if (!isLocal && !apiKey) {
        throw new AppError('LLM_ERROR', 'OPENAI_API_KEY is required when LLM_PROVIDER=openai.', 500);
      }

      const client = new OpenAI({
        apiKey,
        timeout: 60000,
        ...(isLocal && env.LOCAL_LLM_BASE_URL ? { baseURL: env.LOCAL_LLM_BASE_URL } : {})
      });

      const gatewayTools = (await gateway.listTools(input.authToken)) as GatewayTool[];
      const permittedTools = gatewayTools.filter(t => t.permitted !== false);
      console.log('[chatWithLLM] permittedTools:', permittedTools.map(t => t.name));
      const tools = permittedTools.map(toOpenAITool);
      const permittedToolTitles = permittedTools.map(t => t.title || t.name).join(', ');

      const systemPrompt =
        `Bạn là trợ lý trí tuệ nhân tạo (Enterprise AI Assistant) cho hệ thống quản trị doanh nghiệp.\n` +
        `Danh sách công cụ (MCP Tools) ĐƯỢC PHÉP TRUY VẤN tương ứng với vai trò của tài khoản này: [${permittedToolTitles}].\n\n` +
        `Hướng dẫn vận hành:\n` +
        `1. Hãy tự do đọc hiểu ngữ nghĩa tự nhiên câu hỏi của người dùng và sử dụng các công cụ được phép ở trên để tra cứu dữ liệu khi cần.\n` +
        `2. Nếu thông tin đã có trong ngữ cảnh cuộc trò chuyện hoặc dữ liệu vừa tra cứu (như tên sản phẩm, mã, giá cả, số lượng tồn kho), hãy tự suy luận và trả lời tự nhiên, chi tiết bằng tiếng Việt.\n` +
        `3. Tuyệt đối KHÔNG gán cứng câu văn báo lỗi nào. Hãy phản hồi hoàn toàn tự nhiên dựa theo dữ liệu thực tế và danh sách công cụ được phép.\n` +
        `4. Định dạng phản hồi trực quan, đẹp mắt bằng Markdown (bảng, danh sách, in đậm).\n` +
        `5. QUY TẮC NGÔN NGỮ & THUẬT NGỮ (BẮT BUỘC):\n` +
        `   - Dùng 100% tiếng Việt thuần túy, tự nhiên và chuẩn nghiệp vụ doanh nghiệp.\n` +
        `   - KHÔNG in ra hoặc trích dẫn các từ khóa kỹ thuật, tên biến code, tên trường dữ liệu tiếng Anh như \`postingDate\`, \`Sales Invoice\`, \`Purchase Invoice\`, \`dueDate\`, \`grandTotal\`, \`status\` trong văn bản trả lời.\n` +
        `   - Luôn tự động dịch sang thuật ngữ tiếng Việt chuẩn: "ngày ghi sổ" (thay cho postingDate), "hóa đơn bán hàng" (thay cho Sales Invoice), "hóa đơn mua hàng" (thay cho Purchase Invoice), "hạn thanh toán" (thay cho dueDate), "tổng tiền" (thay cho grandTotal).\n\n` +
        `THÔNG TIN HỆ THỐNG:\n` +
        `- Ngày giờ hiện tại: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}\n` +
        `- Hôm nay: ${today()}`;

      const messages: ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: input.message
        }
      ];

      const MAX_ROUNDS = env.MAX_TOOL_CALL_ROUNDS ?? 5;
      const traces: ToolCallTrace[] = [];
      let round = 0;

      while (round < MAX_ROUNDS) {
        round++;
        let completion: any;
        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount <= maxRetries) {
          try {
            completion = await client.chat.completions.create({
              model: env.OPENAI_MODEL || 'local-model',
              messages,
              ...(tools.length > 0 ? { tools, tool_choice: 'auto' as const, parallel_tool_calls: false } : {})
            });
            break;
          } catch (error: any) {
            if (error.status === 429 && retryCount < maxRetries) {
              retryCount++;
              const waitTime = retryCount * 10000; // 10s, 20s, 30s
              console.warn(`Rate limit hit (429). Retrying ${retryCount}/${maxRetries} in ${waitTime/1000}s...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue;
            }
            const groqError = error.error || {};
            if (groqError.failed_generation) {
              const match = groqError.failed_generation.match(/<function=([a-zA-Z0-9_]+)[\s>]*([\s\S]*?)<\/function>/s);
              if (match) {
                const requestedTool = match[1];
                let rawArgsStr = match[2]?.trim() || '{}';
                if (!rawArgsStr.startsWith('{')) {
                  rawArgsStr = '{}';
                }
                const isPermitted = permittedTools.some(pt => pt.name === requestedTool);
                if (!isPermitted) {
                  return {
                    sessionId: input.sessionId,
                    answer: `⚠️ **Tính năng hoặc công cụ \`${requestedTool}\` hiện không thuộc phạm vi quyền hạn được cấp cho tài khoản của bạn.**`,
                    toolCalls: traces
                  };
                }
                completion = {
                  choices: [{
                    message: {
                      role: 'assistant',
                      content: null,
                      tool_calls: [{
                        id: 'call_' + Date.now(),
                        type: 'function',
                        function: { name: requestedTool, arguments: rawArgsStr }
                      }]
                    }
                  }]
                };
              } else {
                return {
                  sessionId: input.sessionId,
                  answer: 'Xin lỗi, tôi chưa thể hoàn thành yêu cầu này do công cụ tương ứng hiện không khả dụng với tài khoản của bạn.',
                  toolCalls: traces
                };
              }
            } else {
              throw error;
            }
          }
        }

        const assistantMessage = completion?.choices?.[0]?.message;
        if (!assistantMessage) {
          throw new AppError('LLM_ERROR', 'LLM did not return a chat message.', 502);
        }

        const toolCalls = assistantMessage.tool_calls ?? [];

        // No more tool calls → LLM produced a final answer
        if (toolCalls.length === 0) {
          return {
            sessionId: input.sessionId,
            answer: assistantMessage.content ?? '',
            toolCalls: traces
          };
        }

        // Execute all tool calls in this round
        messages.push(assistantMessage);
        for (const toolCall of toolCalls) {
          if (toolCall.type !== 'function') continue;

          const plannedToolCall: PlannedToolCall = {
            toolName: toolCall.function.name,
            arguments: parseToolArguments(toolCall.function.arguments)
          };

          const isToolPermitted = permittedTools.some(pt => pt.name === plannedToolCall.toolName);
          if (!isToolPermitted) {
            return {
              sessionId: input.sessionId,
              answer: VIEWER_PERMISSION_DENIED_MESSAGE,
              toolCalls: traces
            };
          }

          const gatewayResult = await gateway.callTool(
            input.authToken,
            input.sessionId,
            plannedToolCall.toolName,
            plannedToolCall.arguments
          );
          traces.push(toTrace(plannedToolCall, gatewayResult));

          if (!gatewayResult.success) {
            const cleanErr = formatToolErrorMessage(gatewayResult.message);
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({
                error: cleanErr,
                instruction: 'Hãy phản hồi lại cho người dùng bằng tiếng Việt tự nhiên, lịch sự, giải thích rõ nguyên nhân không thực hiện được dựa theo thông tin trên mà TUYỆT ĐỐI KHÔNG xuất mã JSON hay đoạn code thô.'
              })
            });
            continue;
          }

          let toolText = '';
          if (gatewayResult.data && Array.isArray((gatewayResult.data as any).content)) {
            toolText = (gatewayResult.data as any).content.map((item: any) => item.text || '').join('\n');
          } else if (typeof gatewayResult.data === 'string') {
            toolText = gatewayResult.data;
          } else {
            toolText = JSON.stringify(gatewayResult.data || {});
          }

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: toolText
          });
        }
      }

      // Fallback if max rounds reached
      const fallback = await client.chat.completions.create({
        model: env.OPENAI_MODEL || 'local-model',
        messages
      });
      const answer = fallback.choices[0]?.message?.content;
      if (!answer) {
        throw new AppError('LLM_ERROR', 'LLM did not return a final answer.', 502);
      }

      return {
        sessionId: input.sessionId,
        answer,
        toolCalls: traces
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : 'Unknown LLM error';
      console.error('LLM Error Details:', (error as any).error || error);

      return {
        sessionId: input.sessionId,
        answer: `Lỗi kết nối mô hình LLM (${message}). Vui lòng kiểm tra lại API Key, quota tài khoản hoặc cấu hình LLM Provider.`,
        toolCalls: []
      };
    }
  }
}
