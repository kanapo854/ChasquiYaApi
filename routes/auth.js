const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

// POST - Login (Iniciar sesión)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validar campos requeridos
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email y contraseña son requeridos'
      });
    }

    // Buscar usuario por email
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({
        success: false,
        error: 'Credenciales inválidas'
      });
    }

    const user = result.rows[0];

    // Verificar estado del usuario
    if (user.status !== 'activo') {
      return res.status(403).json({
        success: false,
        error: 'Usuario inactivo o suspendido'
      });
    }

    // Verificar contraseña
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Credenciales inválidas'
      });
    }

    // Obtener información adicional según el rol
    let profileData = null;
    
    if (user.role === 'restaurante') {
      const restaurantResult = await pool.query(
        'SELECT * FROM restaurants WHERE user_id = $1',
        [user.id]
      );
      profileData = restaurantResult.rows[0] || null;
    } else if (user.role === 'cliente') {
      const customerResult = await pool.query(
        'SELECT * FROM customers WHERE user_id = $1',
        [user.id]
      );
      profileData = customerResult.rows[0] || null;
    } else if (user.role === 'repartidor') {
      const driverResult = await pool.query(
        'SELECT * FROM delivery_drivers WHERE user_id = $1',
        [user.id]
      );
      profileData = driverResult.rows[0] || null;
    }

    // Crear token JWT
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Responder con token y datos del usuario
    res.json({
      success: true,
      message: 'Login exitoso',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          role: user.role,
          status: user.status,
          created_at: user.created_at
        },
        profile: profileData
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      success: false,
      error: 'Error al iniciar sesión'
    });
  }
});

// POST - Verificar token
router.post('/verify', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Token no proporcionado'
      });
    }

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(403).json({
          success: false,
          error: 'Token inválido o expirado'
        });
      }

      // Verificar que el usuario aún existe y está activo
      const result = await pool.query(
        'SELECT id, email, phone, role, status FROM users WHERE id = $1',
        [decoded.id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          error: 'Usuario no encontrado'
        });
      }

      const user = result.rows[0];

      if (user.status !== 'activo') {
        return res.status(403).json({
          success: false,
          error: 'Usuario inactivo o suspendido'
        });
      }

      res.json({
        success: true,
        message: 'Token válido',
        data: {
          user: user
        }
      });
    });

  } catch (error) {
    console.error('Error al verificar token:', error);
    res.status(500).json({
      success: false,
      error: 'Error al verificar token'
    });
  }
});

// POST - Cambiar contraseña
router.post('/change-password', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Token no proporcionado'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Contraseña actual y nueva son requeridas'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'La nueva contraseña debe tener al menos 6 caracteres'
      });
    }

    // Obtener usuario
    const userResult = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [decoded.id]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    // Verificar contraseña actual
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      userResult.rows[0].password_hash
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Contraseña actual incorrecta'
      });
    }

    // Hashear nueva contraseña
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Actualizar contraseña
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [newPasswordHash, decoded.id]
    );

    res.json({
      success: true,
      message: 'Contraseña actualizada exitosamente'
    });

  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(403).json({
        success: false,
        error: 'Token inválido o expirado'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Error al cambiar contraseña'
    });
  }
});

module.exports = router;
