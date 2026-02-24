import { Router } from 'express';
import * as authService from '../services/auth.service';

const router = Router();

router.post('/login', async (req, res) => {
  const { usernameOrEmail, password } = req.body;

  if (!usernameOrEmail || !password) {
    return res.status(400).json({
      success: false,
      message: 'usernameOrEmail y password son requeridos'
    });
  }

  const result = await authService.login({ usernameOrEmail, password });
  res.json({ success: true, ...result });
});

export default router;
