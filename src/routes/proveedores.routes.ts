import { Router } from 'express';
import * as proveedoresService from '../services/proveedores.service';

const router = Router();

router.get('/', async (_req, res) => {
  const data = await proveedoresService.findAllProveedores();
  res.json({ success: true, data });
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const proveedor = await proveedoresService.findProveedorById(id);
  if (!proveedor) {
    return res.status(404).json({ success: false, message: 'Proveedor no encontrado' });
  }
  res.json({ success: true, data: proveedor });
});

router.post('/', async (req, res) => {
  const { nombre_empresa, rif_nit, telefono, contacto_nombre } = req.body;

  if (!nombre_empresa) {
    return res
      .status(400)
      .json({ success: false, message: 'El nombre de la empresa es obligatorio' });
  }

  const proveedor = await proveedoresService.createProveedor({
    nombre_empresa,
    rif_nit,
    telefono,
    contacto_nombre
  });
  res.status(201).json({ success: true, data: proveedor });
});

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { nombre_empresa, rif_nit, telefono, contacto_nombre } = req.body;

  const proveedor = await proveedoresService.updateProveedor(id, {
    nombre_empresa,
    rif_nit,
    telefono,
    contacto_nombre
  });
  res.json({ success: true, data: proveedor });
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  await proveedoresService.deleteProveedor(id);
  res.status(204).send();
});

export default router;
