# 🔗 Endpoints Transaccionales (Completos)

Estos endpoints manejan la relación entre `users` y sus respectivos perfiles en **una sola operación**.

## 🍽️ Restaurantes Completos

### POST /api/restaurants-complete/register
Registrar un restaurante (crea user + restaurant en una transacción)

```json
POST /api/restaurants-complete/register
{
  "email": "restaurant@example.com",
  "password": "password123",
  "phone": "+593987654321",
  "name": "Restaurante El Sabor",
  "description": "Comida tradicional ecuatoriana",
  "address": "Av. Principal 123, Quito",
  "latitude": -0.1807,
  "longitude": -78.4678,
  "image_url": "https://example.com/image.jpg"
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Restaurante registrado exitosamente",
  "data": {
    "user": {
      "id": 1,
      "email": "restaurant@example.com",
      "phone": "+593987654321",
      "role": "restaurante",
      "status": "activo",
      "created_at": "2025-11-27..."
    },
    "restaurant": {
      "id": 1,
      "user_id": 1,
      "name": "Restaurante El Sabor",
      "description": "Comida tradicional ecuatoriana",
      ...
    }
  }
}
```

### PUT /api/restaurants-complete/:id/complete
Actualizar restaurante completo (user + restaurant)

```json
PUT /api/restaurants-complete/1/complete
{
  "email": "nuevo@example.com",
  "phone": "+593999999999",
  "status": "activo",
  "name": "Nuevo Nombre",
  "description": "Nueva descripción",
  "is_active": true
}
```

### DELETE /api/restaurants-complete/:id/complete
Eliminar restaurante y su usuario asociado

```bash
DELETE /api/restaurants-complete/1/complete
```

---

## 👥 Clientes Completos

### POST /api/customers-complete/register
Registrar un cliente (crea user + customer en una transacción)

```json
POST /api/customers-complete/register
{
  "email": "cliente@example.com",
  "password": "password123",
  "phone": "+593987654321",
  "first_name": "Juan",
  "last_name": "Pérez",
  "address": "Calle Principal 456, Quito",
  "latitude": -0.1807,
  "longitude": -78.4678
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Cliente registrado exitosamente",
  "data": {
    "user": {
      "id": 2,
      "email": "cliente@example.com",
      "phone": "+593987654321",
      "role": "cliente",
      "status": "activo",
      "created_at": "2025-11-27..."
    },
    "customer": {
      "id": 1,
      "user_id": 2,
      "first_name": "Juan",
      "last_name": "Pérez",
      ...
    }
  }
}
```

### PUT /api/customers-complete/:id/complete
Actualizar cliente completo

```json
PUT /api/customers-complete/1/complete
{
  "email": "nuevo@example.com",
  "phone": "+593999999999",
  "first_name": "Juan Carlos",
  "last_name": "Pérez González",
  "address": "Nueva dirección"
}
```

### DELETE /api/customers-complete/:id/complete
Eliminar cliente y su usuario asociado

```bash
DELETE /api/customers-complete/1/complete
```

---

## 🚴 Repartidores Completos

### POST /api/delivery-drivers-complete/register
Registrar un repartidor (crea user + delivery_driver en una transacción)

```json
POST /api/delivery-drivers-complete/register
{
  "email": "repartidor@example.com",
  "password": "password123",
  "phone": "+593987654321",
  "first_name": "Carlos",
  "last_name": "Rodríguez",
  "vehicle_type": "Motocicleta",
  "license_plate": "ABC-1234",
  "current_latitude": -0.1807,
  "current_longitude": -78.4678
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Repartidor registrado exitosamente",
  "data": {
    "user": {
      "id": 3,
      "email": "repartidor@example.com",
      "phone": "+593987654321",
      "role": "repartidor",
      "status": "activo",
      "created_at": "2025-11-27..."
    },
    "delivery_driver": {
      "id": 1,
      "user_id": 3,
      "first_name": "Carlos",
      "last_name": "Rodríguez",
      "is_available": true,
      ...
    }
  }
}
```

### PUT /api/delivery-drivers-complete/:id/complete
Actualizar repartidor completo

```json
PUT /api/delivery-drivers-complete/1/complete
{
  "email": "nuevo@example.com",
  "phone": "+593999999999",
  "first_name": "Carlos Alberto",
  "vehicle_type": "Bicicleta",
  "is_available": true
}
```

### DELETE /api/delivery-drivers-complete/:id/complete
Eliminar repartidor y su usuario asociado

```bash
DELETE /api/delivery-drivers-complete/1/complete
```

---

## 💡 Ventajas de los Endpoints Transaccionales

✅ **Atomicidad**: Si falla una operación, todo se revierte  
✅ **Simplicidad**: Una sola llamada crea ambos registros  
✅ **Consistencia**: Garantiza que user y perfil siempre estén sincronizados  
✅ **Mejor UX**: El frontend solo necesita una petición  
✅ **Menos errores**: Evita estados inconsistentes (user sin perfil o viceversa)

## 🔄 Flujo Recomendado

1. **Registro**: Usa los endpoints `/register` de las rutas `*-complete`
2. **Consulta**: Usa los endpoints GET de las rutas normales (ya incluyen datos del user)
3. **Actualización**: Usa los endpoints `/:id/complete` de las rutas `*-complete`
4. **Eliminación**: Usa los endpoints `/:id/complete` de las rutas `*-complete`

## 📊 Comparación

### ❌ Flujo Anterior (2 llamadas)
```
1. POST /api/users → crea user
2. POST /api/restaurants → crea restaurant con user_id
```

### ✅ Flujo Nuevo (1 llamada)
```
1. POST /api/restaurants-complete/register → crea ambos en transacción
```
