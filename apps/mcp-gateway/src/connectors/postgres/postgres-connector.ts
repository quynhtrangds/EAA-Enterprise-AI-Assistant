import type { McpConnector, McpTool } from '../../types/tool.js';

export class PostgresConnector implements McpConnector {
  readonly name = 'postgres';

  constructor(private readonly tools: McpTool[]) {}

  listTools(): McpTool[] {
    return this.tools;
  }
}
