const express = require('express');
const router = express.Router();
const pool = require('../config/database');



// POST - Crear un nuevo cliente
router.post('/', async (req, res) => {
  try {
    const { user_id, first_name, last_name, address, latitude, longitude } = req.body;
    
    // Validar campos requeridos
    if (!user_id || !first_name || !last_name) {
      return res.status(400).json({
        success: false,
        error: 'user_id, nombre y apellido son requeridos'
      });
    }
    
    // Verificar que el usuario existe y es de tipo cliente
    const userCheck = await pool.query(
      'SELECT id, role FROM users WHERE id = $1',
      [user_id]
    );
    
    if (userCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }
    
    if (userCheck.rows[0].role !== 'cliente') {
      return res.status(400).json({
        success: false,
        error: 'El usuario debe tener rol de cliente'
      });
    }
    
    // Verificar que el user_id no tenga ya un perfil de cliente
    const customerCheck = await pool.query(
      'SELECT id FROM customers WHERE user_id = $1',
      [user_id]
    );
    
    if (customerCheck.rowCount > 0) {
      return res.status(409).json({
        success: false,
        error: 'Este usuario ya tiene un perfil de cliente registrado'
      });
    }
    
    // Insertar cliente
    const result = await pool.query(
      `INSERT INTO customers (user_id, first_name, last_name, address, latitude, longitude) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [user_id, first_name, last_name, address, latitude, longitude]
    );
    
    res.status(201).json({
      success: true,
      message: 'Cliente creado exitosamente',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error al crear cliente:', error);
    
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'Este usuario ya tiene un perfil de cliente registrado'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Error al crear cliente'
    });
  }
});

// PUT - Actualizar un cliente
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, address, latitude, longitude } = req.body;
    
    // Verificar si el cliente existe
    const checkCustomer = await pool.query('SELECT id FROM customers WHERE id = $1', [id]);
    if (checkCustomer.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado'
      });
    }
    
    // Construir query dinámico
    const updates = [];
    const values = [];
    let paramCounter = 1;
    
    if (first_name !== undefined) {
      updates.push(`first_name = $${paramCounter++}`);
      values.push(first_name);
    }
    
    if (last_name !== undefined) {
      updates.push(`last_name = $${paramCounter++}`);
      values.push(last_name);
    }
    
    if (address !== undefined) {
      updates.push(`address = $${paramCounter++}`);
      values.push(address);
    }
    
    if (latitude !== undefined) {
      updates.push(`latitude = $${paramCounter++}`);
      values.push(latitude);
    }
    
    if (longitude !== undefined) {
      updates.push(`longitude = $${paramCounter++}`);
      values.push(longitude);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No hay campos para actualizar'
      });
    }
    
    values.push(id);
    const query = `UPDATE customers SET ${updates.join(', ')} WHERE id = $${paramCounter} RETURNING *`;
    
    const result = await pool.query(query, values);
    
    res.json({
      success: true,
      message: 'Cliente actualizado exitosamente',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error al actualizar cliente:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar cliente'
    });
  }
});

// DELETE - Eliminar un cliente
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM customers WHERE id = $1 RETURNING id', [id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado'
      });
    }
    
    res.json({
      success: true,
      message: 'Cliente eliminado exitosamente',
      data: { id: result.rows[0].id }
    });
  } catch (error) {
    console.error('Error al eliminar cliente:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar cliente'
    });
  }
});

module.exports = router;
