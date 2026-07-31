export interface ToolCall {
  toolName: string;
  arguments: any;
  success?: boolean;
  status?: 'success' | 'failed';
  durationMs: number;
  data?: any;
  errorCode?: string;
  message?: string;
}

export interface Message {
  id: string;
  sender: 'user' | 'ai';
  content: string;
  timestamp: string;
  toolCalls?: ToolCall[];
}