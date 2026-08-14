import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';
import { McpGatewayClient } from '../gateway/mcp-gateway-client.js';
import { createLLMProvider, type LLMProvider, type LLMMessage, type LLMToolDefinition } from '../providers/index.js';
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

function toLLMTool(tool: GatewayTool): LLMToolDefinition {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description ?? tool.title ?? tool.name,
      parameters: tool.inputSchema ?? { type: 'object', properties: {} }
    }
  };
}

export class ChatService {
  private readonly gateway = new McpGatewayClient();
  private readonly llm: LLMProvider;

  constructor(llmProvider?: LLMProvider) {
    this.llm = llmProvider ?? createLLMProvider();
  }

  async chat(input: ChatInput): Promise<ChatOutput> {
    try {
      const gatewayTools = (await this.gateway.listTools(input.authToken)) as GatewayTool[];
      const tools = gatewayTools.map(toLLMTool);
      const permittedTools = gatewayTools.filter(t => t.permitted !== false);
      const permittedToolTitles = permittedTools.map(t => t.title || t.name).join(', ');

      const systemPrompt = 
        `Bạn là trợ lý AI (Enterprise AI Assistant) cho hệ thống quản lý bán hàng có kết nối cơ sở dữ liệu PostgreSQL. ` +
        `Nhiệm vụ của bạn là hỗ trợ người dùng truy vấn thông tin bán hàng thông qua các công cụ (tools) được cung cấp.\n\n` +
        `Quy tắc bắt buộc:\n` +
        `1. CHỈ trả lời các câu hỏi về thông tin doanh nghiệp (khách hàng, đơn hàng, doanh thu, thanh toán, sản phẩm) dựa trên dữ liệu thực tế lấy được từ các công cụ (tools) được cung cấp.\n` +
        `2. KHÔNG tự bịa, giả lập hoặc phỏng đoán bất kỳ thông tin nào nếu tool không trả về hoặc không tìm thấy dữ liệu. Nếu không tìm thấy, hãy thông báo rõ ràng bằng tiếng Việt rằng không tìm thấy thông tin trên hệ thống.\n` +
        `3. TUYỆT ĐỐI KHÔNG sinh câu lệnh SQL thô, không yêu cầu người dùng nhập SQL và không hiển thị câu lệnh SQL thô cho người dùng.\n` +
        `4. KHÔNG tiết lộ bất kỳ thông tin nhạy cảm nào ngoài phạm vi dữ liệu được trả về bởi các công cụ.\n` +
        `5. Luôn phản hồi bằng tiếng Việt ngắn gọn, rõ ràng, tập trung trực tiếp vào câu hỏi của người dùng. TUYỆT ĐỐI không sử dụng tiếng Trung (như "吗", "的", v.v.), tiếng Anh hay bất kỳ ngôn ngữ nào khác.\n` +
        `6. KHI CẦN NHIỀU DỮ LIỆU: Nếu câu hỏi yêu cầu thông tin từ nhiều đối tượng (ví dụ: so sánh 2 đơn hàng, xem thông tin nhiều khách hàng), hãy GỌI TOOL NHIỀU LẦN LIÊN TIẾP — mỗi lần gọi cho một đối tượng — cho đến khi thu thập đủ dữ liệu, RỒI MỚI tổng hợp câu trả lời. KHÔNG được từ chối hoặc giải thích "không hỗ trợ" khi tool đã có sẵn.\n` +
        `7. Mỗi tool có thể được gọi nhiều lần với các tham số khác nhau trong cùng một yêu cầu.\n` +
        `8. Ngay cả khi người dùng chào bằng ngôn ngữ khác (VD: Hello, Hi), BẮT BUỘC phải chào lại và trả lời bằng Tiếng Việt.\n` +
        `9. Nếu câu hỏi nằm ngoài phạm vi các tool hiện có, hãy trả lời: "Xin lỗi, tôi chưa có công cụ để trả lời câu hỏi này. Tôi có thể hỗ trợ tìm kiếm khách hàng, xem đơn hàng, doanh thu, sản phẩm bán chạy."\n` +
        `10. Khi gọi công cụ search_customer, bạn BẮT BUỘC phải chỉ trích xuất từ khoá tìm kiếm cốt lõi nhất (ví dụ: tên riêng "Nguyễn", "Trần Văn A", số điện thoại, email, hoặc mã khách hàng) làm tham số keyword. TUYỆT ĐỐI không đưa nguyên cả câu hỏi/câu lệnh yêu cầu của người dùng vào keyword.\n` +
        `11. TUYỆT ĐỐI KHÔNG gọi song song (parallel tool calls) các công cụ có tính phụ thuộc dữ liệu nối tiếp trong cùng một lượt. Ví dụ: Nếu người dùng hỏi đơn hàng của khách hàng tên "A", bạn không được gọi đồng thời cả search_customer và get_customer_orders. Bạn phải gọi search_customer trước, nhận kết quả trả về chứa UUID (customerId), rồi ở lượt kế tiếp mới gọi get_customer_orders với UUID đó. KHÔNG được điền placeholder hoặc giá trị giả lập như "ID khách hàng sau khi tìm kiếm".\n\n` +
        `THÔNG TIN HỆ THỐNG:\n` +
        `- Ngày giờ hiện tại: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}\n` +
        `- Hôm nay là ngày: ${today()}\n` +
        `- Hôm qua là ngày: ${daysAgo(1)}\n` +
        `Khi người dùng hỏi "hôm nay", "hôm qua", "tháng này", "năm nay", hãy sử dụng mốc thời gian trên để điền fromDate và toDate với định dạng YYYY-MM-DD.`;

      const messages: LLMMessage[] = [
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
        const completion = await this.llm.generateCompletion(messages, tools);
        const toolCalls = completion.toolCalls;

        // No more tool calls → LLM produced a final answer
        if (toolCalls.length === 0) {
          return {
            sessionId: input.sessionId,
            answer: completion.content ?? '',
            toolCalls: traces
          };
        }

        // Add assistant message with tool calls to context
        messages.push({
          role: 'assistant',
          content: completion.content
        });

        // Execute each planned tool call
        for (const toolCall of toolCalls) {
          const plannedToolCall: PlannedToolCall = {
            toolName: toolCall.name,
            arguments: toolCall.arguments
          };

          const gatewayResult = await this.gateway.callTool(
            input.authToken,
            input.sessionId,
            plannedToolCall.toolName,
            plannedToolCall.arguments
          );
          traces.push(toTrace(plannedToolCall, gatewayResult));

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({
              success: gatewayResult.success,
              data: gatewayResult.data,
              errorCode: gatewayResult.errorCode,
              message: gatewayResult.errorCode === 'PERMISSION_DENIED'
                ? `System Instruction: Tool bị từ chối do PERMISSION_DENIED. BẮT BUỘC trả lời người dùng lịch sự, tự nhiên bằng tiếng Việt. TUYỆT ĐỐI KHÔNG xưng tên tool tiếng Anh. Ví dụ: "Xin lỗi, tài khoản của bạn chưa được cấp quyền xem thông tin này. Hiện tại tôi có thể hỗ trợ bạn các nghiệp vụ như: tìm kiếm khách hàng, xem thống kê..." (Gợi ý dựa trên danh sách quyền của user: ${permittedToolTitles} - hãy dịch các từ này sang tiếng Việt tự nhiên).`
                : gatewayResult.message
            })
          });
        }
      }

      // Fallback if max rounds reached
      const fallback = await this.llm.generateCompletion(messages, tools);
      return {
        sessionId: input.sessionId,
        answer: fallback.content ?? '',
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
        answer: 'Xin lỗi, tôi đã gặp khó khăn khi xử lý yêu cầu này (có thể do thiếu thông tin cụ thể hoặc công cụ không hỗ trợ). Bạn vui lòng cung cấp thêm chi tiết hoặc thử đổi cách hỏi nhé.',
        toolCalls: []
      };
    }
  }
}
