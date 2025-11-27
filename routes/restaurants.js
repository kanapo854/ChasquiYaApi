const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// POST - Crear un nuevo restaurante
router.post('/', async (req, res) => {
  try {
    const { user_id, name, description, address, latitude, longitude, image_url, is_active } = req.body;
    
    // Validar campos requeridos
    if (!user_id || !name || !address) {
      return res.status(400).json({
        success: false,
        error: 'user_id, nombre y dirección son requeridos'
      });
    }
    
    // Verificar que el usuario existe y es de tipo restaurante
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
    
    if (userCheck.rows[0].role !== 'restaurante') {
      return res.status(400).json({
        success: false,
        error: 'El usuario debe tener rol de restaurante'
      });
    }
    
    // Verificar que el user_id no tenga ya un restaurante
    const restaurantCheck = await pool.query(
      'SELECT id FROM restaurants WHERE user_id = $1',
      [user_id]
    );
    
    if (restaurantCheck.rowCount > 0) {
      return res.status(409).json({
        success: false,
        error: 'Este usuario ya tiene un restaurante registrado'
      });
    }
    
    // Insertar restaurante
    const result = await pool.query(
      `INSERT INTO restaurants (user_id, name, description, address, latitude, longitude, image_url, is_active) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING *`,
      [user_id, name, description, address, latitude, longitude, image_url, is_active !== undefined ? is_active : true]
    );
    
    res.status(201).json({
      success: true,
      message: 'Restaurante creado exitosamente',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error al crear restaurante:', error);
    
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'Este usuario ya tiene un restaurante registrado'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Error al crear restaurante'
    });
  }
});

// PUT - Actualizar un restaurante
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, address, latitude, longitude, image_url, is_active } = req.body;
    
    // Verificar si el restaurante existe
    const checkRestaurant = await pool.query('SELECT id FROM restaurants WHERE id = $1', [id]);
    if (checkRestaurant.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Restaurante no encontrado'
      });
    }
    
    // Construir query dinámico
    const updates = [];
    const values = [];
    let paramCounter = 1;
    
    if (name !== undefined) {
      updates.push(`name = $${paramCounter++}`);
      values.push(name);
    }
    
    if (description !== undefined) {
      updates.push(`description = $${paramCounter++}`);
      values.push(description);
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
    
    if (image_url !== undefined) {
      updates.push(`image_url = $${paramCounter++}`);
      values.push(image_url);
    }
    
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCounter++}`);
      values.push(is_active);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No hay campos para actualizar'
      });
    }
    
    values.push(id);
    const query = `UPDATE restaurants SET ${updates.join(', ')} WHERE id = $${paramCounter} RETURNING *`;
    
    const result = await pool.query(query, values);
    
    res.json({
      success: true,
      message: 'Restaurante actualizado exitosamente',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error al actualizar restaurante:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar restaurante'
    });
  }
});

// DELETE - Eliminar un restaurante
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM restaurants WHERE id = $1 RETURNING id', [id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Restaurante no encontrado'
      });
    }
    
    res.json({
      success: true,
      message: 'Restaurante eliminado exitosamente',
      data: { id: result.rows[0].id }
    });
  } catch (error) {
    console.error('Error al eliminar restaurante:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar restaurante'
    });
  }
});

module.exports = router;
