# 🔒 Seguridad de Endpoints

## Resumen de Protección

### ✅ Endpoints Públicos (sin autenticación)
- `POST /api/auth/login` - Iniciar sesión
- `POST /api/restaurants-complete/register` - Registrar restaurante
- `POST /api/customers-complete/register` - Registrar cliente
- `POST /api/delivery-drivers-complete/register` - Registrar repartidor

### 🔐 Endpoints Protegidos (requieren autenticación)

#### **Clientes**
- `PUT /api/customers-complete/:id/complete` 
  - Requiere: Token válido
  - Solo accesible para usuarios autenticados

- `DELETE /api/customers-complete/:id/complete`
  - Requiere: Token válido + Rol `cliente`
  - Solo clientes pueden eliminar su cuenta

#### **Restaurantes**
- `PUT /api/restaurants-complete/:id/complete`
  - Requiere: Token válido + Rol `restaurante`
  - Solo restaurantes pueden actualizar su información

- `DELETE /api/restaurants-complete/:id/complete`
  - Requiere: Token válido + Rol `restaurante`
  - Solo restaurantes pueden eliminar su cuenta

#### **Repartidores**
- `PUT /api/delivery-drivers-complete/:id/complete`
  - Requiere: Token válido + Rol `repartidor`
  - Solo repartidores pueden actualizar su información

- `DELETE /api/delivery-drivers-complete/:id/complete`
  - Requiere: Token válido + Rol `repartidor`
  - Solo repartidores pueden eliminar su cuenta

---

## 📝 Ejemplo de Uso

### 1. Registrar un Usuario (Sin Token)
```bash
POST http://localhost:3000/api/customers-complete/register
{
  "email": "cliente@example.com",
  "password": "password123",
  "phone": "+593987654321",
  "first_name": "Juan",
  "last_name": "Pérez"
}
```

### 2. Iniciar Sesión (Sin Token)
```bash
POST http://localhost:3000/api/auth/login
{
  "email": "cliente@example.com",
  "password": "password123"
}
```

**Respuesta - Guardar el token:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 3. Actualizar Información (Con Token)
```bash
PUT http://localhost:3000/api/customers-complete/1/complete
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "first_name": "Juan Carlos",
  "phone": "+593999999999"
}
```

### 4. Eliminar Cuenta (Con Token)
```bash
DELETE http://localhost:3000/api/customers-complete/1/complete
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 🔑 Respuestas de Error

### Sin Token
```json
{
  "success": false,
  "error": "Acceso denegado. Token no proporcionado"
}
```

### Token Inválido/Expirado
```json
{
  "success": false,
  "error": "Token inválido o expirado"
}
```

### Sin Permisos (Rol Incorrecto)
```json
{
  "success": false,
  "error": "No tienes permisos para acceder a este recurso"
}
```

---

## 🛠️ Uso con PowerShell

```powershell
# 1. Registrar
$body = @{
    email = "cliente@example.com"
    password = "password123"
    phone = "+593987654321"
    first_name = "Juan"
    last_name = "Pérez"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/customers-complete/register" -Method Post -Body $body -ContentType "application/json"

# 2. Login y guardar token
$loginBody = @{
    email = "cliente@example.com"
    password = "password123"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
$token = $response.data.token

# 3. Actualizar con token
$headers = @{
    "Authorization" = "Bearer $token"
}

$updateBody = @{
    first_name = "Juan Carlos"
    phone = "+593999999999"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/customers-complete/1/complete" -Method Put -Headers $headers -Body $updateBody -ContentType "application/json"
```

---

## 🎯 Recomendaciones

1. **Siempre envía el token en el header Authorization:**
   ```
   Authorization: Bearer <tu_token_aqui>
   ```

2. **El token expira en 7 días** (configurable en `.env`)

3. **Cada rol solo puede modificar/eliminar sus propios recursos**

4. **Guarda el token de forma segura** en el cliente (localStorage, sessionStorage, etc.)

5. **Si el token expira**, el usuario debe hacer login nuevamente
