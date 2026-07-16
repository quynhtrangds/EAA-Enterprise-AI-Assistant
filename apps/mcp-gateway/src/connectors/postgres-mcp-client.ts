import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class PostgresMcpClient {
  private client: Client;
  private transport: StdioClientTransport;

  constructor() {
    this.client = new Client({ name: "mcp-gateway", version: "1.0.0" }, { capabilities: {} });
    
    // Path to the built mcp-server-postgres index.js
    // gateway is in apps/mcp-gateway/dist/connectors/postgres-mcp-client.js
    // postgres server is in packages/mcp-server-postgres/dist/index.js
    const serverPath = resolve(__dirname, "../../../../packages/mcp-server-postgres/dist/index.js");
    
    this.transport = new StdioClientTransport({
      command: "node",
      args: [serverPath],
      env: process.env as any // pass env to allow DB connections
    });
  }

  async connect() {
    await this.client.connect(this.transport);
  }

  async listTools() {
    return await this.client.listTools();
  }

  async callTool(name: string, args: any) {
    return await this.client.callTool({ name, arguments: args });
  }
}

export const postgresMcpClient = new PostgresMcpClient();
