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
