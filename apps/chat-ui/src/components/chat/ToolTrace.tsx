import React, { useState } from 'react';

import type { ToolCall } from '../../types/chat';

const ToolTrace: React.FC<{ tool: ToolCall }> = ({ tool }) => {
  // Trạng thái quản lý việc thu gọn / mở rộng chi tiết log
  const [isOpen, setIsOpen] = useState(false);
  const isSuccess = tool.success ?? tool.status === 'success';
  const statusText = isSuccess ? 'success' : 'failed';

  return (
    <div className="select-none">
      {/* Compact inline chip */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1e2028] border border-[#2c2d35]/80 hover:border-slate-600 hover:bg-[#252730] transition-all cursor-pointer group text-left"
      >
        {/* Status dot */}
        <span className={`w-2 h-2 rounded-full shrink-0 ${isSuccess ? 'bg-emerald-400' : 'bg-rose-400'}`} />
        
        {/* Tool name */}
        <span className="text-[13px] font-medium text-slate-300 group-hover:text-white transition-colors">
          {tool.toolName}
        </span>

        {/* Duration badge */}
        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
          tool.success ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
        }`}>
          {tool.durationMs}ms
        </span>

        {/* Expand chevron */}
        <svg className={`w-3 h-3 text-slate-500 group-hover:text-slate-300 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Expandable detail panel */}
      {isOpen && (
        <div className="mt-2 ml-1 p-3 border border-[#2c2d35]/60 rounded-xl text-xs bg-[#121319] max-w-xl">
          <p className="text-slate-400 mb-1.5 font-semibold">Input:</p>
          <pre className="bg-slate-950 text-emerald-400 p-3 rounded-xl overflow-x-auto font-mono mb-3 border border-slate-900">
            {JSON.stringify(tool.arguments, null, 2)}
          </pre>
          <div className="flex items-center gap-4 text-slate-400">
            <p>
              <span className="font-medium">Status:</span>{' '}
              <span className={tool.success ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
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