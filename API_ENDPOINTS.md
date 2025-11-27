# Endpoints de la API ChasquiYa

Base URL: `http://localhost:3000/api`

## 🔐 Users (Usuarios)

### GET /users
Obtener todos los usuarios
```bash
GET /api/users
```

### GET /users/:id
Obtener un usuario por ID
```bash
GET /api/users/1
```

### POST /users
Crear un nuevo usuario
```json
POST /api/users
{
  "email": "usuario@example.com",
  "password": "password123",
  "phone": "+593987654321",
  "role": "cliente",  // cliente | restaurante | repartidor
  "status": "activo"  // activo | inactivo | suspendido (opcional)
}
```

### PUT /users/:id
Actualizar un usuario
```json
PUT /api/users/1
{
  "email": "nuevo@example.com",
  "phone": "+593987654321",
  "status": "activo"
}
```

### DELETE /users/:id
Eliminar un usuario
```bash
DELETE /api/users/1
```

---

## 🍽️ Restaurants (Restaurantes)

### GET /restaurants
Obtener todos los restaurantes
```bash
GET /api/restaurants
```

### GET /restaurants/:id
Obtener un restaurante por ID
```bash
GET /api/restaurants/1
```

### GET /restaurants/user/:user_id
Obtener restaurante por user_id
```bash
GET /api/restaurants/user/5
```

### POST /restaurants
Crear un nuevo restaurante
```json
POST /api/restaurants
{
  "user_id": 5,
  "name": "Restaurante El Sabor",
  "description": "Comida tradicional ecuatoriana",
  "address": "Av. Principal 123, Quito",
  "latitude": -0.1807,
  "longitude": -78.4678,
  "image_url": "https://example.com/image.jpg",
  "is_active": true
}
```

### PUT /restaurants/:id
Actualizar un restaurante
```json
PUT /api/restaurants/1
{
  "name": "Restaurante El Nuevo Sabor",
  "description": "Comida ecuatoriana e internacional",
  "is_active": true
}
```

### DELETE /restaurants/:id
Eliminar un restaurante
```bash
DELETE /api/restaurants/1
```

---

## 👥 Customers (Clientes)

### GET /customers
Obtener todos los clientes
```bash
GET /api/customers
```

### GET /customers/:id
Obtener un cliente por ID
```bash
GET /api/customers/1
```

### GET /customers/user/:user_id
Obtener cliente por user_id
```bash
GET /api/customers/user/3
```

### POST /customers
Crear un nuevo cliente
```json
POST /api/customers
{
  "user_id": 3,
  "first_name": "Juan",
  "last_name": "Pérez",
  "address": "Calle Principal 456, Quito",
  "latitude": -0.1807,
  "longitude": -78.4678
}
```

### PUT /customers/:id
Actualizar un cliente
```json
PUT /api/customers/1
{
  "first_name": "Juan Carlos",
  "last_name": "Pérez González",
  "address": "Nueva dirección 789"
}
```

### DELETE /customers/:id
Eliminar un cliente
```bash
DELETE /api/customers/1
```

---

## 🚴 Delivery Drivers (Repartidores)

### GET /delivery-drivers
Obtener todos los repartidores
```bash
GET /api/delivery-drivers
```

### GET /delivery-drivers/available
Obtener repartidores disponibles
```bash
GET /api/delivery-drivers/available
```

### GET /delivery-drivers/:id
Obtener un repartidor por ID
```bash
GET /api/delivery-drivers/1
```

### GET /delivery-drivers/user/:user_id
Obtener repartidor por user_id
```bash
GET /api/delivery-drivers/user/7
```

### POST /delivery-drivers
Crear un nuevo repartidor
```json
POST /api/delivery-drivers
{
  "user_id": 7,
  "first_name": "Carlos",
  "last_name": "Rodríguez",
  "vehicle_type": "Motocicleta",
  "license_plate": "ABC-1234",
  "is_available": true,
  "current_latitude": -0.1807,
  "current_longitude": -78.4678
}
```

### PUT /delivery-drivers/:id
Actualizar un repartidor
```json
PUT /api/delivery-drivers/1
{
  "first_name": "Carlos Alberto",
  "vehicle_type": "Bicicleta",
  "is_available": true
}
```

### PATCH /delivery-drivers/:id/location
Actualizar ubicación del repartidor
```json
PATCH /api/delivery-drivers/1/location
{
  "latitude": -0.1807,
  "longitude": -78.4678
}
```

### PATCH /delivery-drivers/:id/availability
Actualizar disponibilidad del repartidor
```json
PATCH /api/delivery-drivers/1/availability
{
  "is_available": false
}
```

### DELETE /delivery-drivers/:id
Eliminar un repartidor
```bash
DELETE /api/delivery-drivers/1
```

---

## 📝 Respuestas de la API

### Respuesta exitosa
```json
{
  "success": true,
  "message": "Operación exitosa",
  "data": { ... }
}
```

### Respuesta de error
```json
{
  "success": false,
  "error": "Descripción del error"
}
```

---

## 🔧 Configuración

Asegúrate de configurar las variables de entorno en el archivo `.env`:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=chasquiya
DB_USER=postgres
DB_PASSWORD=postgres
```
