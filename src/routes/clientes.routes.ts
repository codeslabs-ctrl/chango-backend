import { Router } from 'express';
import * as clientesService from '../services/clientes.service';

const router = Router();

router.get('/', async (_req, res) => {
  const data = await clientesService.findAllClientes();
  res.json({ success: true, data });
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const cliente = await clientesService.findClienteById(id);
  if (!cliente) {
    return res.status(404).json({ success: false, message: 'Cliente no encontrado' });
  }
  res.json({ success: true, data: cliente });
});

router.post('/', async (req, res) => {
  const { nombre, cedula_rif, telefono, email, direccion } = req.body;

  if (!nombre) {
    return res.status(400).json({ success: false, message: 'El nombre es obligatorio' });
  }

  const cliente = await clientesService.createCliente({
    nombre,
    cedula_rif,
    telefono,
    email,
    direccion
  });
  res.status(201).json({ success: true, data: cliente });
});

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { nombre, cedula_rif, telefono, email, direccion } = req.body;

  const cliente = await clientesService.updateCliente(id, {
    nombre,
    cedula_rif,
    telefono,
    email,
    direccion
  });
  res.json({ success: true, data: cliente });
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  await clientesService.deleteCliente(id);
  res.status(204).send();
});

export default router;
