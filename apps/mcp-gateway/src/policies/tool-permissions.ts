import { query } from '../db/pool.js';

interface PermissionRow {
  can_execute: boolean;
}

export async function canExecuteTool(roles: string[], toolName: string): Promise<boolean> {
  if (roles.length === 0) {
    return false;
  }

  if (roles.includes('admin')) {
    return true;
  }

  const result = await query<PermissionRow>(
    `
    SELECT bool_or(can_execute) AS can_execute
    FROM tool_permissions
    WHERE role_code = ANY($1::text[])
      AND tool_name = $2
    `,
    [roles, toolName]
  );

  return result.rows[0]?.can_execute === true;
}
