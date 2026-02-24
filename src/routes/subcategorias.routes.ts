import { Router } from 'express';
import * as subcategoriasService from '../services/subcategorias.service';

const router = Router();

router.get('/', async (req, res) => {
  const categoriaId = req.query.categoriaId
    ? Number(req.query.categoriaId)
    : undefined;
  const data = await subcategoriasService.findAllSubcategorias(categoriaId);
  res.json({ success: true, data });
});

router.post('/', async (req, res) => {
  const { nombre, categoria_id } = req.body;

  if (!nombre || !categoria_id) {
    return res
      .status(400)
      .json({ success: false, message: 'nombre y categoria_id son obligatorios' });
  }

  const subcategoria = await subcategoriasService.createSubcategoria({
    nombre,
    categoria_id: Number(categoria_id)
  });
  res.status(201).json({ success: true, data: subcategoria });
});

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { nombre, categoria_id } = req.body;

  const subcategoria = await subcategoriasService.updateSubcategoria(id, {
    nombre,
    categoria_id: categoria_id ? Number(categoria_id) : undefined
  });
  res.json({ success: true, data: subcategoria });
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  await subcategoriasService.deleteSubcategoria(id);
  res.status(204).send();
});

export default router;
