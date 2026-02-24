import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { pool } from './config/db';

const app = express();

app.use(cors());
app.use(express.json());

// Health check de la API y la base de datos
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'up' });
  } catch (error) {
    console.error('Error en health DB check:', error);
    res.status(500).json({ status: 'error', database: 'down' });
  }
});

app.use('/api', routes);

app.use(errorHandler);

export default app;

