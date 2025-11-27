const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// GET - Obtener todos los items del menú
router.get('/', authenticateToken, authorizeRoles('restaurante', 'cliente'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT m.*, r.name as restaurant_name
      FROM menu_items m
      INNER JOIN restaurants r ON m.restaurant_id = r.id
      ORDER BY m.id DESC
    `);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rowCount
    });
  } catch (error) {
    console.error('Error al obtener items del menú:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener items del menú'
    });
  }
});

// GET - Obtener items por restaurante
router.get('/restaurant/:restaurant_id', authenticateToken, authorizeRoles('restaurante', 'cliente'), async (req, res) => {
  try {
    const { restaurant_id } = req.params;
    const result = await pool.query(
      `SELECT * FROM menu_items WHERE restaurant_id = $1 ORDER BY category, name`,
      [restaurant_id]
    );
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rowCount
    });
  } catch (error) {
    console.error('Error al obtener items del restaurante:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener items del restaurante'
    });
  }
});

// GET - Obtener items disponibles por restaurante
router.get('/restaurant/:restaurant_id/available', authenticateToken, authorizeRoles('restaurante', 'cliente'), async (req, res) => {
  try {
    const { restaurant_id } = req.params;
    const result = await pool.query(
      `SELECT * FROM menu_items WHERE restaurant_id = $1 AND is_available = true ORDER BY category, name`,
      [restaurant_id]
    );
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rowCount
    });
  } catch (error) {
    console.error('Error al obtener items disponibles:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener items disponibles'
    });
  }
});

// GET - Obtener items por categoría
router.get('/category/:category', authenticateToken, authorizeRoles('restaurante', 'cliente'), async (req, res) => {
  try {
    const { category } = req.params;
    const result = await pool.query(
      `SELECT m.*, r.name as restaurant_name
       FROM menu_items m
       INNER JOIN restaurants r ON m.restaurant_id = r.id
       WHERE m.category = $1 AND m.is_available = true
       ORDER BY m.name`,
      [category]
    );
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rowCount
    });
  } catch (error) {
    console.error('Error al obtener items por categoría:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener items por categoría'
    });
  }
});

// GET - Obtener un item por ID
router.get('/:id', authenticateToken, authorizeRoles('restaurante', 'cliente'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT m.*, r.name as restaurant_name, r.address as restaurant_address
       FROM menu_items m
       INNER JOIN restaurants r ON m.restaurant_id = r.id
       WHERE m.id = $1`,
      [id]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Item del menú no encontrado'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error al obtener item del menú:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener item del menú'
    });
  }
});

// POST - Crear un nuevo item del menú (solo restaurantes)
router.post('/', authenticateToken, authorizeRoles('restaurante'), async (req, res) => {
  try {
    const { restaurant_id, name, description, price, image_url, category, is_available } = req.body;
    
    // Validar campos requeridos
    if (!restaurant_id || !name || !price) {
      return res.status(400).json({
        success: false,
        error: 'restaurant_id, nombre y precio son requeridos'
      });
    }
    
    // Validar que el precio sea positivo
    if (price <= 0) {
      return res.status(400).json({
        success: false,
        error: 'El precio debe ser mayor a 0'
      });
    }
    
    // Verificar que el restaurante existe
    const restaurantCheck = await pool.query(
      'SELECT id FROM restaurants WHERE id = $1',
      [restaurant_id]
    );
    
    if (restaurantCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Restaurante no encontrado'
      });
    }
    
    // Insertar item del menú
    const result = await pool.query(
      `INSERT INTO menu_items (restaurant_id, name, description, price, image_url, category, is_available) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [restaurant_id, name, description, price, image_url, category, is_available !== undefined ? is_available : true]
    );
    
    res.status(201).json({
      success: true,
      message: 'Item del menú creado exitosamente',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error al crear item del menú:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear item del menú'
    });
  }
});

// PUT - Actualizar un item del menú (solo restaurantes)
router.put('/:id', authenticateToken, authorizeRoles('restaurante'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, image_url, category, is_available } = req.body;
    
    // Verificar si el item existe
    const checkItem = await pool.query('SELECT id FROM menu_items WHERE id = $1', [id]);
    if (checkItem.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Item del menú no encontrado'
      });
    }
    
    // Validar precio si se proporciona
    if (price !== undefined && price <= 0) {
      return res.status(400).json({
        success: false,
        error: 'El precio debe ser mayor a 0'
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
    
    if (price !== undefined) {
      updates.push(`price = $${paramCounter++}`);
      values.push(price);
    }
    
    if (image_url !== undefined) {
      updates.push(`image_url = $${paramCounter++}`);
      values.push(image_url);
    }
    
    if (category !== undefined) {
      updates.push(`category = $${paramCounter++}`);
      values.push(category);
    }
    
    if (is_available !== undefined) {
      updates.push(`is_available = $${paramCounter++}`);
      values.push(is_available);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No hay campos para actualizar'
      });
    }
    
    values.push(id);
    const query = `UPDATE menu_items SET ${updates.join(', ')} WHERE id = $${paramCounter} RETURNING *`;
    
    const result = await pool.query(query, values);
    
    res.json({
      success: true,
      message: 'Item del menú actualizado exitosamente',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error al actualizar item del menú:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar item del menú'
    });
  }
});

// PATCH - Cambiar disponibilidad de un item (solo restaurantes)
router.patch('/:id/availability', authenticateToken, authorizeRoles('restaurante'), async (req, res) => {
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
      'UPDATE menu_items SET is_available = $1 WHERE id = $2 RETURNING *',
      [is_available, id]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Item del menú no encontrado'
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

// DELETE - Eliminar un item del menú (solo restaurantes)
router.delete('/:id', authenticateToken, authorizeRoles('restaurante'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM menu_items WHERE id = $1 RETURNING id', [id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Item del menú no encontrado'
      });
    }
    
    res.json({
      success: true,
      message: 'Item del menú eliminado exitosamente',
      data: { id: result.rows[0].id }
    });
  } catch (error) {
    console.error('Error al eliminar item del menú:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar item del menú'
    });
  }
});

module.exports = router;
