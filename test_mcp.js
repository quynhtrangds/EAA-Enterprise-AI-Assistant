import { mcpClientManager } from './apps/mcp-gateway/dist/connectors/mcp-client-manager.js';

async function test() {
  try {
    console.log("Connecting to MCP Servers...");
    await mcpClientManager.initialize();
    
    console.log("Listing tools...");
    const tools = await mcpClientManager.listTools();
    console.log("Found tools:");
    tools.tools.forEach(t => console.log(`- ${t.name}: ${t.description}`));
    
    if (tools.tools.length > 0) {
      console.log("\nCalling search_customer (from postgres)...");
      const result = await mcpClientManager.callTool("search_customer", { keyword: "a", limit: 2 });
      console.log("Result:", JSON.stringify(result, null, 2));
      
      console.log("\nCalling crm_get_customer_status (from crm)...");
      const result2 = await mcpClientManager.callTool("crm_get_customer_status", { customerCode: "CUS-008" });
      console.log("Result:", JSON.stringify(result2, null, 2));
    }
    
    console.log("\nTest completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  }
}

test();
