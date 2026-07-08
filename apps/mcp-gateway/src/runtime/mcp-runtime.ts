import { z } from 'zod';
import { AppError } from '../errors/app-error.js';
import type { McpConnector, McpTool, ToolContext } from '../types/tool.js';

export class McpRuntime {
  private readonly tools = new Map<string, McpTool>();

  registerConnector(connector: McpConnector): void {
    for (const tool of connector.listTools()) {
      if (this.tools.has(tool.name)) {
        throw new AppError('CONNECTOR_ERROR', `Duplicate tool registered: ${tool.name}`, 500);
      }

      this.tools.set(tool.name, tool);
    }
  }

  listTools(): McpTool[] {
    return [...this.tools.values()];
  }

  getTool(toolName: string): McpTool {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new AppError('TOOL_NOT_FOUND', `Tool not found: ${toolName}`, 404);
    }

    return tool;
  }

  async callTool(toolName: string, input: unknown, context: ToolContext): Promise<unknown> {
    const tool = this.getTool(toolName);
    this.validateInput(tool.inputSchema, input);

    try {
      const output = await tool.execute(input, context);
      this.validateOutput(tool.outputSchema, output);
      return output;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError('CONNECTOR_ERROR', 'Connector failed while executing tool', 500);
    }
  }

  private validateInput(schema: object, input: unknown): void {
    if (schema instanceof z.ZodType) {
      const result = schema.safeParse(input);
      if (!result.success) {
        throw new AppError('INVALID_TOOL_INPUT', result.error.issues[0]?.message ?? 'Invalid tool input', 400);
      }
    }
  }

  private validateOutput(schema: object | undefined, output: unknown): void {
    if (schema instanceof z.ZodType) {
      const result = schema.safeParse(output);
      if (!result.success) {
        const message = result.error.issues[0]?.message ?? 'Invalid tool output';
        throw new AppError('CONNECTOR_ERROR', `Tool output schema validation failed: ${message}`, 500);
      }
    }
  }
}
