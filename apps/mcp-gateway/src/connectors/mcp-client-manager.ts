import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import { ListToolsResult } from "@modelcontextprotocol/sdk/types.js";
import { MaskingService } from "../masking/masking-service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface McpServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface ConnectorManifest {
  mcpServers: Record<string, McpServerConfig>;
}

export class McpClientManager {
  private clients: Map<string, Client> = new Map();
  public toolToServerMap: Map<string, string> = new Map();

  constructor() {}

  async initialize() {
    try {
      const manifestPath = resolve(__dirname, "../../connector.json");
      const manifestStr = await fs.readFile(manifestPath, "utf-8");
      const manifest: ConnectorManifest = JSON.parse(manifestStr);

      for (const [serverName, config] of Object.entries(manifest.mcpServers)) {
        await this.connectServer(serverName, config);
      }
      
      console.log(`Initialized ${this.clients.size} MCP servers.`);
    } catch (error) {
      console.error("Failed to initialize MCP Client Manager:", error);
    }
  }

  private async connectServer(serverName: string, config: McpServerConfig) {
    const client = new Client({ name: "mcp-gateway", version: "1.0.0" }, { capabilities: {} });
    
    // Resolve absolute path for args that are paths
    const args = config.args.map(arg => {
      if (arg.startsWith("../../")) {
        return resolve(__dirname, "../../", arg);
      }
      return arg;
    });

    const env = { ...process.env, ...(config.env || {}) } as any;

    const transport = new StdioClientTransport({
      command: config.command,
      args,
      env
    });

    try {
      await client.connect(transport);
      this.clients.set(serverName, client);

      const toolsResult = await client.listTools();
      for (const tool of toolsResult.tools) {
        this.toolToServerMap.set(tool.name, serverName);
      }
      
      console.log(`Connected to MCP Server: ${serverName} (${toolsResult.tools.length} tools)`);
    } catch (error) {
      console.error(`Failed to connect to MCP Server: ${serverName}`, error);
    }
  }

  async listTools(): Promise<ListToolsResult> {
    const allTools = [];
    for (const client of this.clients.values()) {
      const result = await client.listTools();
      allTools.push(...result.tools);
    }
    return { tools: allTools };
  }

  async callTool(name: string, args: any) {
    const serverName = this.toolToServerMap.get(name);
    if (!serverName) {
      throw new Error(`Tool not found: ${name}`);
    }

    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`Client not connected for tool: ${name}`);
    }

    const data = await client.callTool({ name, arguments: args });

    // Apply Data Masking
    if (data.content && Array.isArray(data.content)) {
      for (const item of data.content as any[]) {
        if (item.type === "text" && item.text) {
          try {
            const parsedText = JSON.parse(item.text);
            const maskedText = MaskingService.maskObject(parsedText);
            item.text = JSON.stringify(maskedText);
          } catch (e) {
            // Not JSON or parsing failed, skip masking
          }
        }
      }
    }

    return data;
  }
}

export const mcpClientManager = new McpClientManager();
