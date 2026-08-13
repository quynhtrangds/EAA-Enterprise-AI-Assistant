import React, { useState } from 'react';

import type { ToolCall } from '../../types/chat';

const ToolTrace: React.FC<{ tool: ToolCall }> = ({ tool }) => {
  // Trạng thái quản lý việc thu gọn / mở rộng chi tiết log
  const [isOpen, setIsOpen] = useState(false);
  const isSuccess = tool.success ?? tool.status === 'success';
  const statusText = isSuccess ? 'success' : 'failed';

  return (
    <div className="select-none font-mono">
      {/* Compact inline chip — thiết kế như 1 dòng log, không như 1 "chip" trang trí */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface border border-hair hover:border-brass/40 transition-colors cursor-pointer group text-left"
      >
        {/* Status dot */}
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSuccess ? 'bg-sage' : 'bg-clay'}`} />

        {/* Tool name */}
        <span className="text-[13px] text-ink-2 group-hover:text-ink-1 transition-colors">
          {tool.toolName}
        </span>

        {/* Duration badge */}
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${isSuccess ? 'bg-sage/15 text-sage' : 'bg-clay/15 text-clay'
          }`}>
          {tool.durationMs}ms
        </span>

        {/* Expand chevron */}
        <svg className={`w-3 h-3 text-ink-3 group-hover:text-ink-2 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Expandable detail panel */}
      {isOpen && (
        <div className="mt-2 ml-1 p-3 border border-hair rounded-lg text-xs bg-ink max-w-xl">
          <p className="text-ink-3 mb-1.5">input:</p>
          <pre className="bg-surface text-ink-1 p-3 rounded-lg overflow-x-auto mb-3 border border-hair">
            {JSON.stringify(tool.arguments, null, 2)}
          </pre>
          <div className="flex items-center gap-4 text-ink-3">
            <p>
              status:{' '}
              <span className={isSuccess ? 'text-sage' : 'text-clay'}>
                {statusText}
              </span>
            </p>
            <p>
              duration: {tool.durationMs}ms
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ToolTrace;
