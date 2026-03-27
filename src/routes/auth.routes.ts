import { Router } from 'express';
import * as authService from '../services/auth.service';

const router = Router();

router.post('/login', async (req, res) => {
  const { usernameOrEmail, password } = req.body;

  if (!usernameOrEmail || !password) {
    return res.status(400).json({
      success: false,
      message: 'Ingresá usuario o correo electrónico y contraseña.'
    });
  }

  const result = await authService.login({ usernameOrEmail, password });
  res.json({ success: true, ...result });
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ success: false, message: 'Indicá el correo electrónico.' });
  }
  await authService.requestPasswordReset(email);
  res.json({ success: true, message: 'Si el correo está registrado, recibirás una clave temporal por correo.' });
});

export default router;
