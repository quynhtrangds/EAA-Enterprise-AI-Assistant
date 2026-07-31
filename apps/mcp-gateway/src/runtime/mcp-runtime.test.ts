import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import { McpRuntime } from './mcp-runtime.js';
import type { McpConnector, McpTool, ToolContext } from '../types/tool.js';

describe('McpRuntime Unit Tests', () => {
  let runtime: McpRuntime;

  const mockContext: ToolContext = {
    userId: 'user-001',
    username: 'admin',
    roles: ['admin'],
    sessionId: 'sess-001',
    requestId: 'req-001'
  };

  const sampleTool: McpTool = {
    name: 'test_tool',
    title: 'Test Tool',
    description: 'A tool for testing',
    inputSchema: z.object({ value: z.string() }),
    outputSchema: z.object({ result: z.string() }),
    execute: async (input: any) => ({ result: `echo: ${input.value}` })
  };

  const mockConnector: McpConnector = {
    name: 'test_connector',
    listTools: () => [sampleTool]
  };

  beforeEach(() => {
    runtime = new McpRuntime();
  });

  it('registers connector tools successfully', () => {
    runtime.registerConnector(mockConnector);
    const tools = runtime.listTools();
    expect(tools).toHaveLength(1);
    expect(tools[0]?.name).toBe('test_tool');
  });

  it('throws error when registering duplicate tool', () => {
    runtime.registerConnector(mockConnector);
    expect(() => runtime.registerConnector(mockConnector)).toThrow('Duplicate tool registered: test_tool');
  });

  it('throws TOOL_NOT_FOUND for non-existent tool', () => {
    expect(() => runtime.getTool('unknown_tool')).toThrow('Tool not found: unknown_tool');
  });

  it('validates input and executes tool successfully', async () => {
    runtime.registerConnector(mockConnector);
    const output = await runtime.callTool('test_tool', { value: 'hello' }, mockContext);
    expect(output).toEqual({ result: 'echo: hello' });
  });

  it('throws INVALID_TOOL_INPUT on bad input schema', async () => {
    runtime.registerConnector(mockConnector);
    await expect(runtime.callTool('test_tool', { value: 123 }, mockContext)).rejects.toThrow();
  });

  it('throws CONNECTOR_ERROR when tool output validation fails', async () => {
    const invalidOutputTool: McpTool = {
      name: 'invalid_output_tool',
      title: 'Invalid Output Tool',
      description: 'Tool that returns bad output schema',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      execute: async () => ({ result: 12345 }) // Returns number instead of string
    };

    runtime.registerConnector({
      name: 'invalid_conn',
      listTools: () => [invalidOutputTool]
    });

    await expect(runtime.callTool('invalid_output_tool', {}, mockContext)).rejects.toThrow('Tool output schema validation failed');
  });
});
