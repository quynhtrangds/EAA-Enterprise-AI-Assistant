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
  // Danh sách server được khai báo trong connector.json — dùng cho Test Connection
  // để phân biệt "connector thuộc loại MCP nhưng tiến trình chưa sống" với
  // "integration code ngoài danh sách" (không áp dụng probe MCP server).
  private configuredServers: Set<string> = new Set();

  constructor() {}

  async initialize() {
    try {
      const manifestPath = resolve(__dirname, "../../connector.json");
      const manifestStr = await fs.readFile(manifestPath, "utf-8");
      const manifest: ConnectorManifest = JSON.parse(manifestStr);

      this.configuredServers = new Set(Object.keys(manifest.mcpServers));
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

  isConnected(serverName: string): boolean {
    return this.clients.has(serverName);
  }

  /**
   * Các MCP server được khai báo trong connector.json (kể cả khi chưa kết nối được).
   * Test Connection dùng hàm này để quyết định bước mcp-server có áp dụng hay không —
   * KHÔNG dùng isConnected, vì server chết thì bước test phải báo failed chứ không skipped.
   */
  getConfiguredServerNames(): string[] {
    if (this.configuredServers.size > 0) {
      return Array.from(this.configuredServers);
    }
    return ['gitea', 'erpnext', 'zammad', 'crm', 'rag', 'postgres'];
  }

  async ping(serverName: string, timeoutMs = 3000): Promise<boolean> {
    const client = this.clients.get(serverName);
    if (!client) return false;
    try {
      return await Promise.race([
        client.ping().then(() => true),
        new Promise<boolean>((r) => setTimeout(() => r(false), timeoutMs))
      ]);
    } catch {
      return false;
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

  // Các role được xem dữ liệu PII đầy đủ (không bị mask). Staff/viewer luôn
  // nhận dữ liệu đã mask để hạn chế lộ thông tin cá nhân khách hàng theo
  // nguyên tắc least-privilege — họ vẫn tra cứu/xử lý đơn hàng bình thường,
  // chỉ không thấy email/SĐT/địa chỉ đầy đủ.
  private static readonly PII_BYPASS_ROLES = new Set(['admin', 'manager']);

  async callTool(name: string, args: any, roles: string[] = []) {
    const serverName = this.toolToServerMap.get(name);
    if (!serverName) {
      throw new Error(`Tool not found: ${name}`);
    }

    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`Client not connected for tool: ${name}`);
    }

    const data = await client.callTool({ name, arguments: args });

    const shouldMask = !roles.some(r => McpClientManager.PII_BYPASS_ROLES.has(r));

    // Apply Data Masking
    if (shouldMask && data.content && Array.isArray(data.content)) {
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
