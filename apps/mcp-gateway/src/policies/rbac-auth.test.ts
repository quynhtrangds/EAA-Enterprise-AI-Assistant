import { describe, it, expect } from 'vitest';

interface ToolPermissionCheck {
  userRole: string;
  toolName: string;
  allowedRoles: string[];
}

function isToolPermitted({ userRole, allowedRoles }: ToolPermissionCheck): boolean {
  if (userRole === 'admin') return true;
  return allowedRoles.includes(userRole);
}

describe('RBAC Authorization Policy Tests (Phase 4 Upgrade)', () => {
  const adminOnlyTools = ['get_revenue_summary', 'get_top_customers', 'search_repositories'];
  const staffAllowedTools = ['get_inventory_status', 'get_sales_invoices', 'search_customer'];

  it('should allow admin role access to all tools', () => {
    adminOnlyTools.forEach(tool => {
      expect(isToolPermitted({ userRole: 'admin', toolName: tool, allowedRoles: ['admin'] })).toBe(true);
    });
  });

  it('should deny staff role access to admin-only revenue summary tools (403 Forbidden Simulation)', () => {
    const isAllowed = isToolPermitted({
      userRole: 'staff',
      toolName: 'get_revenue_summary',
      allowedRoles: ['admin', 'manager']
    });
    expect(isAllowed).toBe(false);
  });

  it('should allow staff role access to permitted operational tools', () => {
    staffAllowedTools.forEach(tool => {
      expect(isToolPermitted({ userRole: 'staff', toolName: tool, allowedRoles: ['admin', 'manager', 'staff'] })).toBe(true);
    });
  });

  it('should deny viewer role access to operational and administrative tools (403 Forbidden)', () => {
    const operationalTools = ['search_customer', 'get_sales_invoices', 'get_inventory_status', 'get_revenue_summary'];
    operationalTools.forEach(tool => {
      const isAllowed = isToolPermitted({
        userRole: 'viewer',
        toolName: tool,
        allowedRoles: ['admin', 'manager', 'staff']
      });
      expect(isAllowed).toBe(false);
    });
  });

  it('should allow viewer role access ONLY to general knowledge base search tools', () => {
    const isAllowed = isToolPermitted({
      userRole: 'viewer',
      toolName: 'search_knowledge_base',
      allowedRoles: ['admin', 'manager', 'staff', 'viewer']
    });
    expect(isAllowed).toBe(true);
  });
});
