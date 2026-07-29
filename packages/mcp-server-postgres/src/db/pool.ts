import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new pg.Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'postgres',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  max: 10,
  idleTimeoutMillis: 30000,
  // Dữ liệu vẫn LƯU dạng TIMESTAMPTZ (UTC) như cũ — option này chỉ set session
  // timezone cho các hàm hiển thị/nhóm theo lịch (date_trunc, to_char, now(),
  // CURRENT_DATE...), để "doanh thu hôm nay/tháng này" tính đúng theo ngày
  // lịch Việt Nam thay vì bị lệch theo ngày UTC. Không ảnh hưởng tính đúng đắn
  // của giá trị timestamptz đã lưu (pg driver vẫn parse ra đúng thời điểm UTC).
  options: '-c timezone=Asia/Ho_Chi_Minh'
});

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params);
}
