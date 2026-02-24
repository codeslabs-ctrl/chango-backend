import app from './app';
import { APP_PORT } from './config/env';
import { pool } from './config/db';

async function start() {
  try {
    // Probar conexión a DB al iniciar
    await pool.query('SELECT 1');
    console.log('Conectado a PostgreSQL correctamente');

    app.listen(APP_PORT, () => {
      console.log(`Servidor escuchando en http://localhost:${APP_PORT}`);
    });
  } catch (error) {
    console.error('Error al iniciar la aplicación:', error);
    process.exit(1);
  }
}

start();

