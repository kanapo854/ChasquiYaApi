# ChasquiYa API

API REST construida con Node.js y Express.

## Instalación

```bash
npm install
```

## Configuración

Crea un archivo `.env` en la raíz del proyecto:

```
PORT=3000
```

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=chasquiya
DB_USER=postgres
DB_PASSWORD=password
```

```
# JWT Configuration
JWT_SECRET=tu_secreto_super_seguro_aqui_cambiar_en_produccion
JWT_EXPIRES_IN=7d
```

## Ejecución

### Modo desarrollo
```bash
npm run dev
```

### Modo producción
```bash
npm start
```

## Endpoints

### GET /
Ruta principal de bienvenida

### GET /api/health
Verifica el estado de la API

### POST /api/data
Envía datos a la API (ejemplo)

## Estructura del proyecto

```
ChasquiYaApi/
├── node_modules/
├── index.js          # Archivo principal
├── .env              # Variables de entorno
├── .gitignore        # Archivos ignorados por git
├── package.json      # Dependencias y scripts
└── README.md         # Documentación
```
## Pruebas de cada endpoint

EJEMPLOS DE LLAMADAS EN POSTMAN

```
https://chaconvalhery-7756771.postman.co/workspace/Valhery-Leaylean-Quispe-Chacon'~f67bcd3f-1fb0-49e6-825b-bb2ef625bb45/collection/49916364-12160a0a-9702-40b5-b654-f8853781e2e2?action=share&creator=49916364
```


```
curl --location 'http://localhost:3000/api/menu-items' \
--header 'Content-Type: application/json' \
--header 'Authorization: ••••••' \
--data '{
  "restaurant_id": 2,
  "name": "Ceviche de Camarón",
  "description": "Ceviche fresco con camarones del pacífico",
  "price": 12.50,
  "image_url": "https://example.com/ceviche.jpg",
  "category": "Entradas",
  "is_available": true
}'
```