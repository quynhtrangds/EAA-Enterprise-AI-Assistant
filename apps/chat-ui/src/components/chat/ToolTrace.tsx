import React, { useState } from 'react';

// Định nghĩa kiểu dữ liệu cho Tool Call dựa theo spec
interface ToolCall {
  toolName: string;
  arguments: any;
  success: boolean;
  durationMs: number;
}

const ToolTrace: React.FC<{ tool: ToolCall }> = ({ tool }) => {
  // Trạng thái quản lý việc thu gọn / mở rộng chi tiết log
  const [isOpen, setIsOpen] = useState(false);
  const statusText = tool.success ? 'success' : 'failed';

  return (
    <div className="mt-2 text-sm border border-gray-200 rounded-md overflow-hidden bg-white">
      {/* Vùng Header: Bấm vào để mở rộng */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left px-3 py-2 hover:bg-gray-50 flex justify-between items-center transition-colors"
      >
        <span className="font-medium text-indigo-600 flex items-center gap-2 text-xs">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          Tool called: {tool.toolName}
        </span>
        <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${
          tool.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {tool.durationMs}ms
        </span>
      </button>
      
      {/* Vùng chi tiết: Chỉ hiển thị khi isOpen = true */}
      {isOpen && (
        <div className="p-3 border-t border-gray-200 text-xs">
          <p className="text-gray-700 mb-1 font-medium">Input:</p>
          <pre className="bg-slate-800 text-green-400 p-2 rounded overflow-x-auto font-mono mb-2">
            {JSON.stringify(tool.arguments, null, 2)}
          </pre>
          <div className="flex flex-col gap-1 text-gray-700">
            <p>
              <span className="font-medium">Status:</span>{' '}
              <span className={tool.success ? 'text-green-600' : 'text-red-600'}>
                {statusText}
              </span>
            </p>
            <p>
              <span className="font-medium">Duration:</span> {tool.durationMs}ms
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ToolTrace;