import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const server = new Server(
  {
    name: "mcp-server-crm",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const getCustomerStatusInput = z.object({
  customerCode: z.string().trim().min(1)
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "crm_get_customer_status",
        description: "Get customer loyalty status and points from CRM system.",
        inputSchema: {
          type: "object",
          properties: getCustomerStatusInput.shape,
        },
      }
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  
  if (toolName === "crm_get_customer_status") {
    const args = getCustomerStatusInput.parse(request.params.arguments);
    
    // Mock response
    return {
      content: [{ 
        type: "text", 
        text: JSON.stringify({
          customerCode: args.customerCode,
          loyaltyLevel: "Gold",
          points: 12500,
          nextLevelPointsRequired: 2500
        }) 
      }],
    };
  }

  throw new Error(`Tool not found: ${toolName}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("CRM MCP Server running on stdio");
}

main().catch(console.error);
