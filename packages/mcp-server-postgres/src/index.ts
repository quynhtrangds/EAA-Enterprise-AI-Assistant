import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import express from "express";

import { postgresTools } from "./tools.js";

const server = new Server(
  {
    name: "mcp-server-postgres",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: postgresTools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: {
        type: "object",
        properties: (t.inputSchema as any).shape || {}, // Zod to basic schema fallback
      },
    })),
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const tool = postgresTools.find((t) => t.name === toolName);

  if (!tool) {
    throw new Error(`Tool not found: ${toolName}`);
  }

  try {
    const args = tool.inputSchema.parse(request.params.arguments);
    const result = await tool.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
    };
  } catch (error: any) {
    return {
      content: [{ type: "text", text: error.message || String(error) }],
      isError: true,
    };
  }
});

async function main() {
  const mode = process.env.MCP_TRANSPORT_MODE || "stdio";
  
  if (mode === "stdio") {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("mcp-server-postgres running on stdio");
  } else if (mode === "http") {
    const app = express();
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3001;
    
    let sseTransport: SSEServerTransport;
    
    app.get("/sse", async (req: express.Request, res: express.Response) => {
      sseTransport = new SSEServerTransport("/message", res);
      await server.connect(sseTransport);
    });

    app.post("/message", async (req: express.Request, res: express.Response) => {
      if (sseTransport) {
        await sseTransport.handlePostMessage(req, res);
      } else {
        res.status(500).send("No active transport");
      }
    });

    app.listen(port, () => {
      console.log(`mcp-server-postgres running on http://localhost:${port}/sse`);
    });
  }
}

main().catch(console.error);
