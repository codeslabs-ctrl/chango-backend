import { Pool, QueryResultRow } from 'pg';
import { DB_CONFIG } from './env';

export const pool = new Pool({
  host: DB_CONFIG.host,
  port: DB_CONFIG.port,
  user: DB_CONFIG.user,
  password: DB_CONFIG.password,
  database: DB_CONFIG.database
});

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<{ rows: T[]; rowCount: number }> {
  const client = await pool.connect();
  try {
    const res = await client.query<T>(text, params);
    return { rows: res.rows, rowCount: res.rowCount ?? 0 };
  } finally {
    client.release();
  }
}

