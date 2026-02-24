# Estructura del Proyecto Chango

## Backend

### Estructura de carpetas

```
backend/
├── doc/
│   └── estructura.md          # Este documento
├── src/
│   ├── config/
│   │   ├── db.ts              # Pool PostgreSQL y función query
│   │   └── env.ts             # Variables de entorno
│   ├── middleware/
│   │   ├── auth.ts            # Middleware JWT
│   │   └── errorHandler.ts    # Manejo centralizado de errores
│   ├── models/
│   │   ├── cliente.model.ts
│   │   ├── categoria.model.ts
│   │   ├── subcategoria.model.ts
│   │   ├── producto.model.ts
│   │   ├── proveedor.model.ts
│   │   ├── almacen.model.ts
│   │   ├── venta.model.ts
│   │   ├── usuario.model.ts
│   │   └── index.ts
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── usuarios.routes.ts
│   │   ├── clientes.routes.ts
│   │   ├── categorias.routes.ts
│   │   ├── subcategorias.routes.ts
│   │   ├── productos.routes.ts
│   │   ├── proveedores.routes.ts
│   │   ├── almacenes.routes.ts
│   │   ├── ventas.routes.ts
│   │   └── index.ts
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── usuarios.service.ts
│   │   ├── clientes.service.ts
│   │   ├── categorias.service.ts
│   │   ├── subcategorias.service.ts
│   │   ├── productos.service.ts
│   │   ├── proveedores.service.ts
│   │   ├── almacenes.service.ts
│   │   ├── ventas.service.ts
│   │   └── index.ts
│   ├── types/
│   │   └── auth.ts            # AuthRequest
│   ├── utils/
│   │   ├── errors.ts          # AppError, NotFoundError
│   │   ├── jwt.ts
│   │   └── password.ts
│   ├── app.ts
│   └── server.ts
├── .env
├── .env.example
├── package.json
├── tsconfig.json
└── dist/                      # Salida de compilación
```

## Capas

| Capa | Ubicación | Responsabilidad |
|------|-----------|-----------------|
| **Models** | `src/models/` | Interfaces, DTOs y tipos de datos |
| **Routes** | `src/routes/` | HTTP: validación, delegación a servicios, respuesta |
| **Services** | `src/services/` | Lógica de negocio, transacciones, acceso a datos |
| **Middleware** | `src/middleware/` | Autenticación JWT, manejo de errores |
| **Utils** | `src/utils/` | Errores, JWT, hashing de contraseñas |
| **Config** | `src/config/` | Base de datos, variables de entorno |

## Endpoints API

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Health check (API + DB) |
| POST | `/api/auth/login` | Login (JWT) |
| POST | `/api/usuarios` | Registrar usuario |
| GET | `/api/usuarios/me` | Usuario actual (requiere JWT) |
| CRUD | `/api/clientes` | Gestión de clientes |
| CRUD | `/api/categorias` | Gestión de categorías |
| CRUD | `/api/subcategorias` | Gestión de subcategorías |
| CRUD | `/api/productos` | Gestión de productos |
| CRUD | `/api/proveedores` | Gestión de proveedores |
| CRUD | `/api/almacenes` | Gestión de almacenes |
| GET/POST | `/api/almacenes/:id/productos` | Stock por almacén |
| CRUD | `/api/ventas` | Gestión de ventas |
| PATCH | `/api/ventas/:id/confirmar` | Confirmar venta pendiente |

---

## Frontend (Angular 21)

### Estructura de carpetas

```
frontend/
├── src/
│   ├── app/
│   │   ├── core/
│   │   │   ├── guards/          # authGuard
│   │   │   ├── interceptors/    # authInterceptor
│   │   │   └── services/        # API services
│   │   ├── features/
│   │   │   ├── login/
│   │   │   ├── dashboard/
│   │   │   ├── ventas/
│   │   │   ├── productos/
│   │   │   ├── almacenes/
│   │   │   └── categorias/
│   │   ├── shared/
│   │   │   └── layout/          # dashboard-layout
│   │   ├── environments/
│   │   └── app.routes.ts
│   └── styles.scss
└── angular.json
```

### Rutas del frontend

| Ruta | Componente | Descripción |
|------|------------|-------------|
| `/login` | LoginComponent | Inicio de sesión |
| `/dashboard` | DashboardComponent | Tablas ventas por confirmar e inventario |
| `/ventas` | VentasComponent | Listar ventas (filtro por estatus) |
| `/productos` | ProductosComponent | CRUD productos |
| `/productos/:id` | ProductoDetailComponent | Actualizar inventario producto |
| `/almacenes` | AlmacenesComponent | CRUD almacenes + ventas |
| `/almacenes/:id` | AlmacenDetailComponent | Productos y stock por almacén |
| `/categorias` | CategoriasComponent | CRUD categorías |

### Cómo ejecutar

```bash
# Backend
cd backend && npm run dev

# Frontend
cd frontend && npm start
```

Frontend: http://localhost:4200  
Backend API: http://localhost:3005
