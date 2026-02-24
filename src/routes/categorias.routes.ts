import { Router } from 'express';
import * as categoriasService from '../services/categorias.service';

const router = Router();

router.get('/', async (_req, res) => {
  const data = await categoriasService.findAllCategorias();
  res.json({ success: true, data });
});

router.post('/', async (req, res) => {
  const { nombre } = req.body;

  if (!nombre) {
    return res.status(400).json({ success: false, message: 'El nombre es obligatorio' });
  }

  const categoria = await categoriasService.createCategoria({ nombre });
  res.status(201).json({ success: true, data: categoria });
});

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { nombre } = req.body;

  const categoria = await categoriasService.updateCategoria(id, { nombre });
  res.json({ success: true, data: categoria });
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  await categoriasService.deleteCategoria(id);
  res.status(204).send();
});

export default router;
