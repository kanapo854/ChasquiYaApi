const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// POST - Registrar un nuevo repartidor (user + delivery_driver en una transacción)
router.post('/register', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { 
      email, 
      password, 
      phone, 
      first_name, 
      last_name,
      vehicle_type,
      license_plate,
      current_latitude,
      current_longitude
    } = req.body;
    
    // Validar campos requeridos
    if (!email || !password || !phone || !first_name || !last_name) {
      return res.status(400).json({
        success: false,
        error: 'Email, contraseña, teléfono, nombre y apellido son requeridos'
      });
    }
    
    await client.query('BEGIN');
    
    // 1. Crear usuario con rol de repartidor
    const passwordHash = await bcrypt.hash(password, 10);
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, phone, role, status) 
       VALUES ($1, $2, $3, 'repartidor', 'activo') 
       RETURNING id, email, phone, role, status, created_at`,
      [email, passwordHash, phone]
    );
    
    const user = userResult.rows[0];
    
    // 2. Crear el perfil del repartidor
    const driverResult = await client.query(
      `INSERT INTO delivery_drivers 
       (user_id, first_name, last_name, vehicle_type, license_plate, is_available, current_latitude, current_longitude) 
       VALUES ($1, $2, $3, $4, $5, true, $6, $7) 
       RETURNING *`,
      [user.id, first_name, last_name, vehicle_type, license_plate, current_latitude, current_longitude]
    );
    
    await client.query('COMMIT');
    
    res.status(201).json({
      success: true,
      message: 'Repartidor registrado exitosamente',
      data: {
        user: user,
        delivery_driver: driverResult.rows[0]
      }
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al registrar repartidor:', error);
    
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'El email ya está registrado'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Error al registrar repartidor'
    });
  } finally {
    client.release();
  }
});

// PUT - Actualizar repartidor completo (user + delivery_driver)
router.put('/:id/complete', authenticateToken, authorizeRoles('repartidor'), async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const { 
      email, 
      phone, 
      status,
      first_name, 
      last_name,
      vehicle_type,
      license_plate,
      is_available,
      current_latitude,
      current_longitude
    } = req.body;
    
    const checkDriver = await client.query(
      'SELECT user_id FROM delivery_drivers WHERE id = $1',
      [id]
    );
    
    if (checkDriver.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Repartidor no encontrado'
      });
    }
    
    const user_id = checkDriver.rows[0].user_id;
    
    await client.query('BEGIN');
    
    // Actualizar usuario
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
    
    if (userUpdates.length > 0) {
      userValues.push(user_id);
      await client.query(
        `UPDATE users SET ${userUpdates.join(', ')} WHERE id = $${userParamCounter}`,
        userValues
      );
    }
    
    // Actualizar repartidor
    const driverUpdates = [];
    const driverValues = [];
    let driverParamCounter = 1;
    
    if (first_name !== undefined) {
      driverUpdates.push(`first_name = $${driverParamCounter++}`);
      driverValues.push(first_name);
    }
    if (last_name !== undefined) {
      driverUpdates.push(`last_name = $${driverParamCounter++}`);
      driverValues.push(last_name);
    }
    if (vehicle_type !== undefined) {
      driverUpdates.push(`vehicle_type = $${driverParamCounter++}`);
      driverValues.push(vehicle_type);
    }
    if (license_plate !== undefined) {
      driverUpdates.push(`license_plate = $${driverParamCounter++}`);
      driverValues.push(license_plate);
    }
    if (is_available !== undefined) {
      driverUpdates.push(`is_available = $${driverParamCounter++}`);
      driverValues.push(is_available);
    }
    if (current_latitude !== undefined) {
      driverUpdates.push(`current_latitude = $${driverParamCounter++}`);
      driverValues.push(current_latitude);
    }
    if (current_longitude !== undefined) {
      driverUpdates.push(`current_longitude = $${driverParamCounter++}`);
      driverValues.push(current_longitude);
    }
    
    if (driverUpdates.length > 0) {
      driverValues.push(id);
      await client.query(
        `UPDATE delivery_drivers SET ${driverUpdates.join(', ')} WHERE id = $${driverParamCounter}`,
        driverValues
      );
    }
    
    if (userUpdates.length === 0 && driverUpdates.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'No hay campos para actualizar'
      });
    }
    
    await client.query('COMMIT');
    
    // Obtener datos completos actualizados
    const completeData = await pool.query(`
      SELECT d.*, u.email, u.phone, u.status, u.role
      FROM delivery_drivers d
      INNER JOIN users u ON d.user_id = u.id
      WHERE d.id = $1
    `, [id]);
    
    res.json({
      success: true,
      message: 'Repartidor actualizado exitosamente',
      data: completeData.rows[0]
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al actualizar repartidor completo:', error);
    
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'El email ya está registrado'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Error al actualizar repartidor'
    });
  } finally {
    client.release();
  }
});

// DELETE - Eliminar repartidor completo
router.delete('/:id/complete', authenticateToken, authorizeRoles('repartidor'), async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    
    const driverData = await client.query(
      'SELECT user_id FROM delivery_drivers WHERE id = $1',
      [id]
    );
    
    if (driverData.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Repartidor no encontrado'
      });
    }
    
    const user_id = driverData.rows[0].user_id;
    
    await client.query('BEGIN');
    await client.query('DELETE FROM users WHERE id = $1', [user_id]);
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: 'Repartidor y usuario eliminados exitosamente',
      data: { delivery_driver_id: parseInt(id), user_id: user_id }
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al eliminar repartidor completo:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar repartidor'
    });
  } finally {
    client.release();
  }
});

// GET - Obtener repartidores disponibles
router.get('/available', authenticateToken, authorizeRoles('repartidor'),async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.*, u.email, u.phone, u.status 
      FROM delivery_drivers d
      INNER JOIN users u ON d.user_id = u.id
      WHERE d.is_available = true AND u.status = 'activo'
      ORDER BY d.id DESC
    `);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rowCount
    });
  } catch (error) {
    console.error('Error al obtener repartidores disponibles:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener repartidores disponibles'
    });
  }
});

// GET - Obtener un repartidor por ID
router.get('/:id', authenticateToken, authorizeRoles('repartidor'),async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT d.*, u.email, u.phone, u.status 
      FROM delivery_drivers d
      INNER JOIN users u ON d.user_id = u.id
      WHERE d.id = $1
    `, [id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Repartidor no encontrado'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error al obtener repartidor:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener repartidor'
    });
  }
});

// GET - Obtener todos los repartidores
router.get('/', authenticateToken, authorizeRoles('repartidor'),async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.*, u.email, u.phone, u.status 
      FROM delivery_drivers d
      INNER JOIN users u ON d.user_id = u.id
      ORDER BY d.id DESC
    `);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rowCount
    });
  } catch (error) {
    console.error('Error al obtener repartidores:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener repartidores'
    });
  }
});

// PATCH - Actualizar ubicación del repartidor
router.patch('/:id/location', authenticateToken, authorizeRoles('repartidor'), async (req, res) => {
  try {
    const { id } = req.params;
    const { latitude, longitude } = req.body;
    
    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Latitud y longitud son requeridas'
      });
    }
    
    const result = await pool.query(
      'UPDATE delivery_drivers SET current_latitude = $1, current_longitude = $2 WHERE id = $3 RETURNING *',
      [latitude, longitude, id]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Repartidor no encontrado'
      });
    }
    
    res.json({
      success: true,
      message: 'Ubicación actualizada exitosamente',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error al actualizar ubicación:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar ubicación'
    });
  }
});

// PATCH - Actualizar disponibilidad del repartidor
router.patch('/:id/availability', authenticateToken, authorizeRoles('repartidor'), async (req, res) => {
  try {
    const { id } = req.params;
    const { is_available } = req.body;
    
    if (is_available === undefined) {
      return res.status(400).json({
        success: false,
        error: 'is_available es requerido'
      });
    }
    
    const result = await pool.query(
      'UPDATE delivery_drivers SET is_available = $1 WHERE id = $2 RETURNING *',
      [is_available, id]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Repartidor no encontrado'
      });
    }
    
    res.json({
      success: true,
      message: 'Disponibilidad actualizada exitosamente',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error al actualizar disponibilidad:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar disponibilidad'
    });
  }
});

// GET - Obtener repartidor por user_id
router.get('/user/:user_id',authenticateToken, authorizeRoles('repartidor'), async (req, res) => {
  try {
    const { user_id } = req.params;
    const result = await pool.query(`
      SELECT d.*, u.email, u.phone, u.status 
      FROM delivery_drivers d
      INNER JOIN users u ON d.user_id = u.id
      WHERE d.user_id = $1
    `, [user_id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Repartidor no encontrado para este usuario'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error al obtener repartidor:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener repartidor'
    });
  }
});

module.exports = router;
