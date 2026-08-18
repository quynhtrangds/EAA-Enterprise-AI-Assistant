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

  // can_execute !== null nghĩa là ĐÃ CÓ dòng permission tường minh cho
  // (role, tool) này trong DB — luôn tôn trọng giá trị đó, kể cả khi role là
  // admin và giá trị là false (admin có thể bị giới hạn tool cụ thể nếu
  // seed data khai báo vậy).
  if (result.rows.length > 0 && result.rows[0]?.can_execute !== null && result.rows[0]?.can_execute !== undefined) {
    return result.rows[0].can_execute === true;
  }

  // Không có dòng nào cho (role, tool) này — thường xảy ra khi 1 tool mới
  // được thêm vào hệ thống nhưng chưa kịp seed quyền cho từng role. Với
  // admin, coi như luôn được phép (superuser mặc định) để không cần seed
  // permission cho admin mỗi khi thêm tool mới. Đây là fail-open CÓ CHỦ Ý
  // CHỈ DÀNH RIÊNG cho admin — mọi role khác vẫn fail-closed (return false ở
  // dưới). Nếu muốn giới hạn 1 tool cụ thể ngay cả với admin, phải seed 1
  // dòng tool_permissions (role_code='admin', can_execute=false) tường minh
  // — nhánh check ở trên sẽ tôn trọng giá trị đó thay vì rơi xuống đây.
  if (roles.includes('admin')) {
    return true;
  }

  return false;
}