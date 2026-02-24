import { Router } from 'express';
import * as usuariosService from '../services/usuarios.service';
import { AuthRequest } from '../types/auth';
import { authenticateJWT } from '../middleware/auth';
import { requireAdmin } from '../middleware/adminAuth';

const router = Router();

// Rutas /me deben ir antes de /:id para evitar que "me" se interprete como id
router.post('/me/change-password', authenticateJWT, async (req, res) => {
  const userId = (req as AuthRequest).user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'No autenticado' });
  }
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Contraseña actual y nueva son requeridas' });
  }
  await usuariosService.changePassword(userId, currentPassword, newPassword);
  res.json({ success: true, message: 'Contraseña actualizada' });
});

router.get('/me', authenticateJWT, async (req, res) => {
  const userId = (req as AuthRequest).user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'No autenticado' });
  }
  const usuario = await usuariosService.getUsuarioById(userId);
  if (!usuario) {
    return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
  }
  res.json({ success: true, data: usuario });
});

router.patch('/me', authenticateJWT, async (req, res) => {
  const userId = (req as AuthRequest).user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'No autenticado' });
  }
  const { username, email } = req.body;
  const dto: { username?: string; email?: string } = {};
  if (username !== undefined) dto.username = username;
  if (email !== undefined) dto.email = email;
  const usuario = await usuariosService.updateMiPerfil(userId, dto);
  res.json({ success: true, data: usuario });
});

router.get('/', authenticateJWT, requireAdmin, async (_req, res) => {
  const data = await usuariosService.findAllUsuarios();
  res.json({ success: true, data });
});

router.post('/', authenticateJWT, requireAdmin, async (req, res) => {
  const { username, email, password, rol } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({
      success: false,
      message: 'username, email y password son requeridos'
    });
  }

  const usuario = await usuariosService.createUsuario({ username, email, password, rol });
  res.status(201).json({ success: true, data: usuario });
});

router.get('/:id', authenticateJWT, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const usuario = await usuariosService.getUsuarioById(id);
  if (!usuario) {
    return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
  }
  res.json({ success: true, data: usuario });
});

router.put('/:id', authenticateJWT, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { username, email, password, rol, activo } = req.body;

  const dto: { username?: string; email?: string; password?: string; rol?: 'administrador' | 'usuario'; activo?: boolean } = {};
  if (username !== undefined) dto.username = username;
  if (email !== undefined) dto.email = email;
  if (password !== undefined) dto.password = password;
  if (rol === 'administrador' || rol === 'usuario') dto.rol = rol;
  if (typeof activo === 'boolean') dto.activo = activo;

  const usuario = await usuariosService.updateUsuario(id, dto);
  res.json({ success: true, data: usuario });
});

router.delete('/:id', authenticateJWT, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await usuariosService.deleteUsuario(id);
  res.status(204).send();
});

export default router;
