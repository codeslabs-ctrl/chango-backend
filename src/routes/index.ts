import { Router } from 'express';
import clientesRouter from './clientes.routes';
import categoriasRouter from './categorias.routes';
import subcategoriasRouter from './subcategorias.routes';
import productosRouter from './productos.routes';
import proveedoresRouter from './proveedores.routes';
import almacenesRouter from './almacenes.routes';
import ventasRouter from './ventas.routes';
import estadisticasRouter from './estadisticas.routes';
import authRouter from './auth.routes';
import usuariosRouter from './usuarios.routes';
import comisionesRouter from './comisiones.routes';

const router = Router();

router.use('/auth', authRouter);
router.use('/usuarios', usuariosRouter);
router.use('/comisiones', comisionesRouter);
router.use('/clientes', clientesRouter);
router.use('/categorias', categoriasRouter);
router.use('/subcategorias', subcategoriasRouter);
router.use('/productos', productosRouter);
router.use('/proveedores', proveedoresRouter);
router.use('/almacenes', almacenesRouter);
router.use('/ventas', ventasRouter);
router.use('/estadisticas', estadisticasRouter);

export default router;

