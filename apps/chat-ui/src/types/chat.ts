export interface ToolCall {
  toolName: string;
  arguments: any;
  status: 'success' | 'failed';
  durationMs: number;
}

export interface Message {
  id: string;
  sender: 'user' | 'ai';
  content: string;
  timestamp: string;
  toolCalls?: ToolCall[]; // Mảng chứa các tool AI đã gọi
}