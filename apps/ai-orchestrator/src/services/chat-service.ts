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

export class ChatService {
  private readonly gateway = new McpGatewayClient();
  private readonly llm = new MockLLMProvider();

  async chat(input: ChatInput): Promise<ChatOutput> {
    if (env.LLM_PROVIDER === 'openai' || env.LLM_PROVIDER === 'local') {
      return this.chatWithLLM(input);
    }

    return this.chatWithMock(input);
  }

  private async chatWithMock(input: ChatInput): Promise<ChatOutput> {
    await this.gateway.listTools(input.authToken);
    const plannedToolCall = this.llm.planToolCall(input.message);

    if (!plannedToolCall) {
      return {
        sessionId: input.sessionId,
        answer: this.llm.buildAnswer(input.message, null, null),
        toolCalls: []
      };
    }

    const gatewayResult = await this.gateway.callTool(
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

      const ordersResult = await this.gateway.callTool(input.authToken, input.sessionId, ordersCall.toolName, ordersCall.arguments);
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

  private async chatWithLLM(input: ChatInput): Promise<ChatOutput> {
    try {
      const isLocal = env.LLM_PROVIDER === 'local';
      const apiKey = isLocal ? (env.OPENAI_API_KEY || 'local-key') : env.OPENAI_API_KEY;

      if (!isLocal && !apiKey) {
        throw new AppError('LLM_ERROR', 'OPENAI_API_KEY is required when LLM_PROVIDER=openai.', 500);
      }

      const client = new OpenAI({
        apiKey,
        ...(isLocal && env.LOCAL_LLM_BASE_URL ? { baseURL: env.LOCAL_LLM_BASE_URL } : {})
      });

      const gatewayTools = (await this.gateway.listTools(input.authToken)) as GatewayTool[];
      const tools = gatewayTools.map(toOpenAITool);
      const systemPrompt = 
        `Bạn là trợ lý AI (Enterprise AI Assistant) cho hệ thống quản lý bán hàng có kết nối cơ sở dữ liệu PostgreSQL. ` +
        `Nhiệm vụ của bạn là hỗ trợ người dùng truy vấn thông tin bán hàng thông qua các công cụ (tools) được cung cấp.\n\n` +
        `Quy tắc bắt buộc:\n` +
        `1. CHỈ trả lời các câu hỏi về thông tin doanh nghiệp (khách hàng, đơn hàng, doanh thu, thanh toán, sản phẩm) dựa trên dữ liệu thực tế lấy được từ các công cụ (tools) được cung cấp.\n` +
        `2. KHÔNG tự bịa, giả lập hoặc phỏng đoán bất kỳ thông tin nào nếu tool không trả về hoặc không tìm thấy dữ liệu. Nếu không tìm thấy, hãy thông báo rõ ràng bằng tiếng Việt rằng không tìm thấy thông tin trên hệ thống.\n` +
        `3. TUYỆT ĐỐI KHÔNG sinh câu lệnh SQL thô, không yêu cầu người dùng nhập SQL và không hiển thị câu lệnh SQL thô cho người dùng.\n` +
        `4. KHÔNG tiết lộ bất kỳ thông tin nhạy cảm nào ngoài phạm vi dữ liệu được trả về bởi các công cụ.\n` +
        `5. Luôn phản hồi bằng tiếng Việt ngắn gọn, rõ ràng, tập trung trực tiếp vào câu hỏi của người dùng.`;

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

      const firstCompletion = await client.chat.completions.create({
        model: env.OPENAI_MODEL || 'local-model',
        messages,
        ...(tools.length > 0 ? { tools, tool_choice: 'auto' as const } : {})
      });

      const firstMessage = firstCompletion.choices[0]?.message;
      if (!firstMessage) {
        throw new AppError('LLM_ERROR', 'LLM did not return a chat message.', 502);
      }

      const toolCalls = firstMessage.tool_calls ?? [];
      if (toolCalls.length === 0) {
        return {
          sessionId: input.sessionId,
          answer: firstMessage.content ?? '',
          toolCalls: []
        };
      }

      messages.push(firstMessage);

      const traces: ToolCallTrace[] = [];
      for (const toolCall of toolCalls) {
        if (toolCall.type !== 'function') {
          continue;
        }

        const plannedToolCall: PlannedToolCall = {
          toolName: toolCall.function.name,
          arguments: parseToolArguments(toolCall.function.arguments)
        };

        const gatewayResult = await this.gateway.callTool(
          input.authToken,
          input.sessionId,
          plannedToolCall.toolName,
          plannedToolCall.arguments
        );
        const trace = toTrace(plannedToolCall, gatewayResult);
        traces.push(trace);

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify({
            success: gatewayResult.success,
            data: gatewayResult.data,
            errorCode: gatewayResult.errorCode,
            message: gatewayResult.message
          })
        });
      }

      const finalCompletion = await client.chat.completions.create({
        model: env.OPENAI_MODEL || 'local-model',
        messages
      });
      const answer = finalCompletion.choices[0]?.message?.content;

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
      throw new AppError('LLM_ERROR', `LLM provider failed: ${message}`, 502);
    }
  }
}
