const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../config/database');

// GET - Obtener todos los usuarios
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, phone, role, status, created_at, updated_at FROM users ORDER BY id DESC'
    );
    res.json({
      success: true,
      data: result.rows,
      count: result.rowCount
    });
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener usuarios'
    });
  }
});

// GET - Obtener un usuario por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT id, email, phone, role, status, created_at, updated_at FROM users WHERE id = $1',
      [id]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener usuario'
    });
  }
});

// POST - Crear un nuevo usuario
router.post('/', async (req, res) => {
  try {
    const { email, password, phone, role, status } = req.body;
    
    // Validar campos requeridos
    if (!email || !password || !phone || !role) {
      return res.status(400).json({
        success: false,
        error: 'Email, contraseña, teléfono y rol son requeridos'
      });
    }
    
    // Validar rol
    const validRoles = ['cliente', 'restaurante', 'repartidor'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Rol inválido. Debe ser: cliente, restaurante o repartidor'
      });
    }
    
    // Hash de la contraseña
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // Insertar usuario
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, phone, role, status) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, phone, role, status, created_at, updated_at',
      [email, passwordHash, phone, role, status || 'activo']
    );
    
    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    
    // Verificar si es un error de duplicado (email único)
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'El email ya está registrado'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Error al crear usuario'
    });
  }
});

// PUT - Actualizar un usuario
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password, phone, role, status } = req.body;
    
    // Verificar si el usuario existe
    const checkUser = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    if (checkUser.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }
    
    // Construir query dinámico
    const updates = [];
    const values = [];
    let paramCounter = 1;
    
    if (email) {
      updates.push(`email = $${paramCounter++}`);
      values.push(email);
    }
    
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      updates.push(`password_hash = $${paramCounter++}`);
      values.push(passwordHash);
    }
    
    if (phone) {
      updates.push(`phone = $${paramCounter++}`);
      values.push(phone);
    }
    
    if (role) {
      const validRoles = ['cliente', 'restaurante', 'repartidor'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          error: 'Rol inválido'
        });
      }
      updates.push(`role = $${paramCounter++}`);
      values.push(role);
    }
    
    if (status) {
      const validStatuses = ['activo', 'inactivo', 'suspendido'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Estado inválido'
        });
      }
      updates.push(`status = $${paramCounter++}`);
      values.push(status);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No hay campos para actualizar'
      });
    }
    
    values.push(id);
    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCounter} RETURNING id, email, phone, role, status, created_at, updated_at`;
    
    const result = await pool.query(query, values);
    
    res.json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'El email ya está registrado'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Error al actualizar usuario'
    });
  }
});

// DELETE - Eliminar un usuario
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }
    
    res.json({
      success: true,
      message: 'Usuario eliminado exitosamente',
      data: { id: result.rows[0].id }
    });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar usuario'
    });
  }
});

module.exports = router;
