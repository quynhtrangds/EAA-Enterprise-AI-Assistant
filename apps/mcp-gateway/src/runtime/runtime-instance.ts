import { PostgresConnector } from '../connectors/postgres/postgres-connector.js';
import { createPostgresTools } from '../connectors/postgres/tools/index.js';
import { McpRuntime } from './mcp-runtime.js';

export const runtime = new McpRuntime();

runtime.registerConnector(new PostgresConnector(createPostgresTools()));
