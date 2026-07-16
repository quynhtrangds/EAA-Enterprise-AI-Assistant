import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import express from "express";

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

// We will implement tool logic here

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
    
    app.get("/sse", async (req, res) => {
      sseTransport = new SSEServerTransport("/message", res);
      await server.connect(sseTransport);
    });

    app.post("/message", async (req, res) => {
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
