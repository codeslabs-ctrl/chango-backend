/**
 * Script para crear/actualizar usuario admin.
 * Ejecutar: npx ts-node scripts/crear-admin.ts
 */
import 'dotenv/config';
import { pool } from '../src/config/db';
import { hashPassword } from '../src/utils/password';

const USERNAME = 'admin';
const EMAIL = 'admin@chango.local';
const PASSWORD = 'abc123';

async function main() {
  const hash = await hashPassword(PASSWORD);
  const client = await pool.connect();

  try {
    const check = await client.query(
      `SELECT id FROM public.usuarios WHERE username = $1 OR email = $2`,
      [USERNAME, EMAIL]
    );

    if (check.rows.length > 0) {
      await client.query(
        `UPDATE public.usuarios
         SET password_hash = $1, activo = true, rol = 'administrador', fecha_actualizacion = now()
         WHERE username = $2 OR email = $3`,
        [hash, USERNAME, EMAIL]
      );
      console.log('Usuario admin actualizado. Usuario: admin, Password: abc123');
    } else {
      await client.query(
        `INSERT INTO public.usuarios (username, email, password_hash, activo, rol)
         VALUES ($1, $2, $3, true, 'administrador')`,
        [USERNAME, EMAIL, hash]
      );
      console.log('Usuario admin creado. Usuario: admin, Password: abc123');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
