# Caja Susinos MVP

MVP de caja rapida para barra de pena, implementado con React + Vite.

## Funciones incluidas

- Dos categorias: Bebida y Comida.
- Pulsar producto suma 1 unidad automaticamente.
- Calcula total y numero de articulos en tiempo real.
- Comanda desplegable con lineas por producto y cantidad.
- Boton para vaciar comanda.
- Catalogo cargado desde `public/products.json`.

## Editar precios y productos desde movil

1. Abre GitHub en el iPhone y entra al repositorio.
2. Edita `public/products.json` (precio, nombre o nuevos productos).
3. Haz commit del cambio.
4. Vercel despliega automaticamente y todos ven el nuevo catalogo.

Estructura del catalogo:

```json
{
	"bebida": [{ "id": "cerveza", "name": "Cerveza", "price": 1.5 }],
	"comida": [{ "id": "pincho-tortilla", "name": "Pincho tortilla", "price": 2.0 }]
}
```

## Acceso al panel admin

- El panel admin queda oculto hasta introducir usuario y contrasena.
- Credenciales por defecto (solo para uso basico):
	- Usuario: `admin`
	- Contrasena: `susinos123`

Puedes cambiarlas con variables de entorno en Vercel:

```bash
VITE_ADMIN_USER=tu_usuario
VITE_ADMIN_PASS=tu_contrasena
```

Nota: al ser frontend, estas credenciales no son seguridad real, solo una barrera basica para ocultar el panel.

## Ejecutar en local

```bash
npm install
npm run dev
```

Abrir en navegador:

```text
http://localhost:5173
```

## Build de produccion

```bash
npm run build
npm run preview
```
