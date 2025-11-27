# 🔐 Autenticación con JWT

## 📌 Endpoints de Autenticación

### 1. Login (Iniciar Sesión)

```bash
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "usuario@example.com",
  "password": "password123"
}
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "message": "Login exitoso",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "email": "usuario@example.com",
      "phone": "+593987654321",
      "role": "cliente",
      "status": "activo",
      "created_at": "2025-11-27..."
    },
    "profile": {
      "id": 1,
      "first_name": "Juan",
      "last_name": "Pérez",
      ...
    }
  }
}
```

**Con PowerShell:**
```powershell
$body = @{
    email = "usuario@example.com"
    password = "password123"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method Post -Body $body -ContentType "application/json"
$token = $response.data.token
```

---

### 2. Verificar Token

```bash
POST http://localhost:3000/api/auth/verify
Authorization: Bearer <token>
```

**Con PowerShell:**
```powershell
$headers = @{
    "Authorization" = "Bearer $token"
}

Invoke-RestMethod -Uri "http://localhost:3000/api/auth/verify" -Method Post -Headers $headers
```

---

### 3. Cambiar Contraseña

```bash
POST http://localhost:3000/api/auth/change-password
Authorization: Bearer <token>
Content-Type: application/json

{
  "currentPassword": "password123",
  "newPassword": "newPassword456"
}
```

**Con PowerShell:**
```powershell
$headers = @{
    "Authorization" = "Bearer $token"
}

$body = @{
    currentPassword = "password123"
    newPassword = "newPassword456"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/auth/change-password" -Method Post -Headers $headers -Body $body -ContentType "application/json"
```

---

## 🔒 Proteger Rutas con Middleware

Para proteger rutas que requieren autenticación, usa el middleware:

```javascript
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Ruta protegida (requiere autenticación)
router.get('/protected', authenticateToken, (req, res) => {
  res.json({
    message: 'Acceso permitido',
    user: req.user
  });
});

// Ruta solo para restaurantes
router.get('/only-restaurant', 
  authenticateToken, 
  authorizeRoles('restaurante'), 
  (req, res) => {
    res.json({ message: 'Solo restaurantes' });
  }
);

// Ruta para clientes y repartidores
router.get('/customers-drivers', 
  authenticateToken, 
  authorizeRoles('cliente', 'repartidor'), 
  (req, res) => {
    res.json({ message: 'Clientes y repartidores' });
  }
);
```

---

## 📝 Ejemplo Completo de Flujo

### 1. Registrar un Cliente

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

### 2. Iniciar Sesión

```bash
POST http://localhost:3000/api/auth/login
{
  "email": "cliente@example.com",
  "password": "password123"
}
```

**Guardar el token recibido:**
```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 3. Usar el Token en Peticiones

```bash
GET http://localhost:3000/api/customers
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## ⚙️ Configuración

El JWT se configura en el archivo `.env`:

```env
JWT_SECRET=tu_secreto_super_seguro_aqui_cambiar_en_produccion
JWT_EXPIRES_IN=7d
```

**⚠️ IMPORTANTE:** Cambia `JWT_SECRET` en producción por una clave segura y aleatoria.

---

## 🔑 Información del Token

El token JWT contiene:
- `id` - ID del usuario
- `email` - Email del usuario
- `role` - Rol (cliente, restaurante, repartidor)
- `status` - Estado del usuario
- `iat` - Fecha de emisión
- `exp` - Fecha de expiración

---

## 🛡️ Seguridad

✅ Las contraseñas se hashean con bcrypt  
✅ Los tokens expiran después de 7 días (configurable)  
✅ Los usuarios inactivos/suspendidos no pueden hacer login  
✅ Se verifica el estado del usuario en cada petición protegida  
✅ Los tokens incluyen información mínima necesaria
