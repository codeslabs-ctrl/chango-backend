import fs from 'fs/promises';
import app from './app';
import { APP_PORT } from './config/env';
import { pool } from './config/db';
import { ensureSchema } from './config/ensureSchema';
import { UPLOAD_PRODUCTOS_DIR } from './config/paths';

async function start() {
  try {
    // Probar conexión a DB al iniciar
    await pool.query('SELECT 1');
    console.log('Conectado a PostgreSQL correctamente');

    await ensureSchema();
    await fs.mkdir(UPLOAD_PRODUCTOS_DIR, { recursive: true });

    app.listen(APP_PORT, () => {
      console.log(`Servidor escuchando en http://localhost:${APP_PORT}`);
    });
  } catch (error) {
    console.error('Error al iniciar la aplicación:', error);
    process.exit(1);
  }
}

start();

