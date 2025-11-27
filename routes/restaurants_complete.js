const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// POST - Registrar un nuevo restaurante (user + restaurant en una transacción)
router.post('/register', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { 
      email, 
      password, 
      phone, 
      name, 
      description, 
      address, 
      latitude, 
      longitude, 
      image_url 
    } = req.body;
    
    // Validar campos requeridos
    if (!email || !password || !phone || !name || !address) {
      return res.status(400).json({
        success: false,
        error: 'Email, contraseña, teléfono, nombre del restaurante y dirección son requeridos'
      });
    }
    
    // Iniciar transacción
    await client.query('BEGIN');
    
    // 1. Crear usuario con rol de restaurante
    const passwordHash = await bcrypt.hash(password, 10);
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, phone, role, status) 
       VALUES ($1, $2, $3, 'restaurante', 'activo') 
       RETURNING id, email, phone, role, status, created_at`,
      [email, passwordHash, phone]
    );
    
    const user = userResult.rows[0];
    
    // 2. Crear el perfil del restaurante
    const restaurantResult = await client.query(
      `INSERT INTO restaurants (user_id, name, description, address, latitude, longitude, image_url, is_active) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, true) 
       RETURNING *`,
      [user.id, name, description, address, latitude, longitude, image_url]
    );
    
    // Confirmar transacción
    await client.query('COMMIT');
    
    res.status(201).json({
      success: true,
      message: 'Restaurante registrado exitosamente',
      data: {
        user: user,
        restaurant: restaurantResult.rows[0]
      }
    });
    
  } catch (error) {
    // Revertir transacción en caso de error
    await client.query('ROLLBACK');
    console.error('Error al registrar restaurante:', error);
    
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'El email ya está registrado'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Error al registrar restaurante'
    });
  } finally {
    client.release();
  }
});

// PUT - Actualizar restaurante completo (user + restaurant)
router.put('/:id/complete', authenticateToken, authorizeRoles('restaurante'), async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const { 
      email, 
      phone, 
      status,
      name, 
      description, 
      address, 
      latitude, 
      longitude, 
      image_url,
      is_active
    } = req.body;
    
    // Verificar que el restaurante existe
    const checkRestaurant = await client.query(
      'SELECT user_id FROM restaurants WHERE id = $1',
      [id]
    );
    
    if (checkRestaurant.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Restaurante no encontrado'
      });
    }
    
    const user_id = checkRestaurant.rows[0].user_id;
    
    await client.query('BEGIN');
    
    // Actualizar datos del usuario si se proporcionan
    const userUpdates = [];
    const userValues = [];
    let userParamCounter = 1;
    
    if (email !== undefined) {
      userUpdates.push(`email = $${userParamCounter++}`);
      userValues.push(email);
    }
    if (phone !== undefined) {
      userUpdates.push(`phone = $${userParamCounter++}`);
      userValues.push(phone);
    }
    if (status !== undefined) {
      userUpdates.push(`status = $${userParamCounter++}`);
      userValues.push(status);
    }
    
    let userResult = null;
    if (userUpdates.length > 0) {
      userValues.push(user_id);
      const userQuery = `UPDATE users SET ${userUpdates.join(', ')} WHERE id = $${userParamCounter} RETURNING id, email, phone, role, status`;
      userResult = await client.query(userQuery, userValues);
    }
    
    // Actualizar datos del restaurante si se proporcionan
    const restaurantUpdates = [];
    const restaurantValues = [];
    let restaurantParamCounter = 1;
    
    if (name !== undefined) {
      restaurantUpdates.push(`name = $${restaurantParamCounter++}`);
      restaurantValues.push(name);
    }
    if (description !== undefined) {
      restaurantUpdates.push(`description = $${restaurantParamCounter++}`);
      restaurantValues.push(description);
    }
    if (address !== undefined) {
      restaurantUpdates.push(`address = $${restaurantParamCounter++}`);
      restaurantValues.push(address);
    }
    if (latitude !== undefined) {
      restaurantUpdates.push(`latitude = $${restaurantParamCounter++}`);
      restaurantValues.push(latitude);
    }
    if (longitude !== undefined) {
      restaurantUpdates.push(`longitude = $${restaurantParamCounter++}`);
      restaurantValues.push(longitude);
    }
    if (image_url !== undefined) {
      restaurantUpdates.push(`image_url = $${restaurantParamCounter++}`);
      restaurantValues.push(image_url);
    }
    if (is_active !== undefined) {
      restaurantUpdates.push(`is_active = $${restaurantParamCounter++}`);
      restaurantValues.push(is_active);
    }
    
    let restaurantResult = null;
    if (restaurantUpdates.length > 0) {
      restaurantValues.push(id);
      const restaurantQuery = `UPDATE restaurants SET ${restaurantUpdates.join(', ')} WHERE id = $${restaurantParamCounter} RETURNING *`;
      restaurantResult = await client.query(restaurantQuery, restaurantValues);
    }
    
    if (userUpdates.length === 0 && restaurantUpdates.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'No hay campos para actualizar'
      });
    }
    
    await client.query('COMMIT');
    
    // Obtener datos completos actualizados
    const completeData = await pool.query(`
      SELECT r.*, u.email, u.phone, u.status, u.role
      FROM restaurants r
      INNER JOIN users u ON r.user_id = u.id
      WHERE r.id = $1
    `, [id]);
    
    res.json({
      success: true,
      message: 'Restaurante actualizado exitosamente',
      data: completeData.rows[0]
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al actualizar restaurante completo:', error);
    
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'El email ya está registrado'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Error al actualizar restaurante'
    });
  } finally {
    client.release();
  }
});

// DELETE - Eliminar restaurante completo (cascada elimina user automáticamente por FK)
router.delete('/:id/complete', authenticateToken, authorizeRoles('restaurante'), async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    
    // Obtener user_id antes de eliminar
    const restaurantData = await client.query(
      'SELECT user_id FROM restaurants WHERE id = $1',
      [id]
    );
    
    if (restaurantData.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Restaurante no encontrado'
      });
    }
    
    const user_id = restaurantData.rows[0].user_id;
    
    await client.query('BEGIN');
    
    // Eliminar el usuario (esto eliminará el restaurante por CASCADE)
    await client.query('DELETE FROM users WHERE id = $1', [user_id]);
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: 'Restaurante y usuario eliminados exitosamente',
      data: { restaurant_id: parseInt(id), user_id: user_id }
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al eliminar restaurante completo:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar restaurante'
    });
  } finally {
    client.release();
  }
});

// GET - Obtener todos los restaurantes
router.get('/', authenticateToken, authorizeRoles('restaurante', 'cliente', 'repartidor'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, u.email, u.phone, u.status 
      FROM restaurants r
      INNER JOIN users u ON r.user_id = u.id
      ORDER BY r.id DESC
    `);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rowCount
    });
  } catch (error) {
    console.error('Error al obtener restaurantes:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener restaurantes'
    });
  }
});

// GET - Obtener un restaurante por ID
router.get('/:id', authenticateToken, authorizeRoles('restaurante', 'cliente', 'repartidor'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT r.*, u.email, u.phone, u.status 
      FROM restaurants r
      INNER JOIN users u ON r.user_id = u.id
      WHERE r.id = $1
    `, [id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Restaurante no encontrado'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error al obtener restaurante:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener restaurante'
    });
  }
});

// GET - Obtener restaurante por user_id
router.get('/user/:user_id', authenticateToken, authorizeRoles('restaurante'), async (req, res) => {
  try {
    const { user_id } = req.params;
    const result = await pool.query(`
      SELECT r.*, u.email, u.phone, u.status 
      FROM restaurants r
      INNER JOIN users u ON r.user_id = u.id
      WHERE r.user_id = $1
    `, [user_id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Restaurante no encontrado para este usuario'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error al obtener restaurante:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener restaurante'
    });
  }
});

module.exports = router;
