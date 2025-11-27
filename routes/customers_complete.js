const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// POST - Registrar un nuevo cliente (user + customer en una transacción)
router.post('/register', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { 
      email, 
      password, 
      phone, 
      first_name, 
      last_name, 
      address, 
      latitude, 
      longitude 
    } = req.body;
    
    // Validar campos requeridos
    if (!email || !password || !phone || !first_name || !last_name) {
      return res.status(400).json({
        success: false,
        error: 'Email, contraseña, teléfono, nombre y apellido son requeridos'
      });
    }
    
    await client.query('BEGIN');
    
    // 1. Crear usuario con rol de cliente
    const passwordHash = await bcrypt.hash(password, 10);
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, phone, role, status) 
       VALUES ($1, $2, $3, 'cliente', 'activo') 
       RETURNING id, email, phone, role, status, created_at`,
      [email, passwordHash, phone]
    );
    
    const user = userResult.rows[0];
    
    // 2. Crear el perfil del cliente
    const customerResult = await client.query(
      `INSERT INTO customers (user_id, first_name, last_name, address, latitude, longitude) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [user.id, first_name, last_name, address, latitude, longitude]
    );
    
    await client.query('COMMIT');
    
    res.status(201).json({
      success: true,
      message: 'Cliente registrado exitosamente',
      data: {
        user: user,
        customer: customerResult.rows[0]
      }
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al registrar cliente:', error);
    
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'El email ya está registrado'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Error al registrar cliente'
    });
  } finally {
    client.release();
  }
});

// PUT - Actualizar cliente completo (user + customer)
router.put('/:id/complete', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const { 
      email, 
      phone, 
      status,
      first_name, 
      last_name, 
      address, 
      latitude, 
      longitude
    } = req.body;
    
    const checkCustomer = await client.query(
      'SELECT user_id FROM customers WHERE id = $1',
      [id]
    );
    
    if (checkCustomer.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado'
      });
    }
    
    const user_id = checkCustomer.rows[0].user_id;
    
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
    
    // Actualizar cliente
    const customerUpdates = [];
    const customerValues = [];
    let customerParamCounter = 1;
    
    if (first_name !== undefined) {
      customerUpdates.push(`first_name = $${customerParamCounter++}`);
      customerValues.push(first_name);
    }
    if (last_name !== undefined) {
      customerUpdates.push(`last_name = $${customerParamCounter++}`);
      customerValues.push(last_name);
    }
    if (address !== undefined) {
      customerUpdates.push(`address = $${customerParamCounter++}`);
      customerValues.push(address);
    }
    if (latitude !== undefined) {
      customerUpdates.push(`latitude = $${customerParamCounter++}`);
      customerValues.push(latitude);
    }
    if (longitude !== undefined) {
      customerUpdates.push(`longitude = $${customerParamCounter++}`);
      customerValues.push(longitude);
    }
    
    if (customerUpdates.length > 0) {
      customerValues.push(id);
      await client.query(
        `UPDATE customers SET ${customerUpdates.join(', ')} WHERE id = $${customerParamCounter}`,
        customerValues
      );
    }
    
    if (userUpdates.length === 0 && customerUpdates.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'No hay campos para actualizar'
      });
    }
    
    await client.query('COMMIT');
    
    // Obtener datos completos actualizados
    const completeData = await pool.query(`
      SELECT c.*, u.email, u.phone, u.status, u.role
      FROM customers c
      INNER JOIN users u ON c.user_id = u.id
      WHERE c.id = $1
    `, [id]);
    
    res.json({
      success: true,
      message: 'Cliente actualizado exitosamente',
      data: completeData.rows[0]
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al actualizar cliente completo:', error);
    
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'El email ya está registrado'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Error al actualizar cliente'
    });
  } finally {
    client.release();
  }
});

// DELETE - Eliminar cliente completo
router.delete('/:id/complete', authenticateToken, authorizeRoles('cliente'), async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    
    const customerData = await client.query(
      'SELECT user_id FROM customers WHERE id = $1',
      [id]
    );
    
    if (customerData.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado'
      });
    }
    
    const user_id = customerData.rows[0].user_id;
    
    await client.query('BEGIN');
    await client.query('DELETE FROM users WHERE id = $1', [user_id]);
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: 'Cliente y usuario eliminados exitosamente',
      data: { customer_id: parseInt(id), user_id: user_id }
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al eliminar cliente completo:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar cliente'
    });
  } finally {
    client.release();
  }
});

// GET - Obtener todos los clientes
router.get('/', authenticateToken, authorizeRoles('cliente'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, u.email, u.phone, u.status 
      FROM customers c
      INNER JOIN users u ON c.user_id = u.id
      ORDER BY c.id DESC
    `);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rowCount
    });
  } catch (error) {
    console.error('Error al obtener clientes:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener clientes'
    });
  }
});

// GET - Obtener un cliente por ID
router.get('/:id', authenticateToken, authorizeRoles('cliente'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT c.*, u.email, u.phone, u.status 
      FROM customers c
      INNER JOIN users u ON c.user_id = u.id
      WHERE c.id = $1
    `, [id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error al obtener cliente:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener cliente'
    });
  }
});

// GET - Obtener cliente por user_id
router.get('/user/:user_id', authenticateToken, authorizeRoles('cliente'), async (req, res) => {
  try {
    const { user_id } = req.params;
    const result = await pool.query(`
      SELECT c.*, u.email, u.phone, u.status 
      FROM customers c
      INNER JOIN users u ON c.user_id = u.id
      WHERE c.user_id = $1
    `, [user_id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado para este usuario'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error al obtener cliente:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener cliente'
    });
  }
});

module.exports = router;
