import { query } from '../db/pool.js';

interface PermissionRow {
  can_execute: boolean | null;
}

export async function canExecuteTool(roles: string[], toolName: string): Promise<boolean> {
  if (roles.length === 0) {
    return false;
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

  if (result.rows.length > 0 && result.rows[0]?.can_execute !== null && result.rows[0]?.can_execute !== undefined) {
    return result.rows[0].can_execute === true;
  }

  if (roles.includes('admin')) {
    return true;
  }

  return false;
}
