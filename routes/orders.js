const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Función auxiliar para generar número de orden único
const generateOrderNumber = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ORD-${timestamp}-${random}`;
};

// POST - Crear un nuevo pedido (solo clientes)
router.post('/', authenticateToken, authorizeRoles('cliente'), async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { 
      customer_id, 
      restaurant_id, 
      items, // Array de { menu_item_id, quantity, special_instructions }
      delivery_fee,
      notes 
    } = req.body;

    // Validar campos requeridos
    if (!customer_id || !restaurant_id || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'customer_id, restaurant_id e items (array con al menos 1 item) son requeridos'
      });
    }

    // Verificar que el cliente existe
    const customerCheck = await client.query(
      'SELECT id FROM customers WHERE id = $1',
      [customer_id]
    );
    
    if (customerCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado'
      });
    }

    // Verificar que el restaurante existe y está activo
    const restaurantCheck = await client.query(
      'SELECT id, is_active FROM restaurants WHERE id = $1',
      [restaurant_id]
    );
    
    if (restaurantCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Restaurante no encontrado'
      });
    }

    if (!restaurantCheck.rows[0].is_active) {
      return res.status(400).json({
        success: false,
        error: 'El restaurante no está activo en este momento'
      });
    }

    await client.query('BEGIN');

    // Obtener información de los items del menú
    const menuItemIds = items.map(item => item.menu_item_id);
    const menuItemsResult = await client.query(
      `SELECT id, name, price, is_available, restaurant_id 
       FROM menu_items 
       WHERE id = ANY($1::int[])`,
      [menuItemIds]
    );

    if (menuItemsResult.rowCount !== items.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Algunos items del menú no existen'
      });
    }

    // Validar que todos los items pertenecen al restaurante y están disponibles
    const menuItemsMap = {};
    for (const menuItem of menuItemsResult.rows) {
      if (menuItem.restaurant_id !== restaurant_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: `El item "${menuItem.name}" no pertenece a este restaurante`
        });
      }
      if (!menuItem.is_available) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: `El item "${menuItem.name}" no está disponible`
        });
      }
      menuItemsMap[menuItem.id] = menuItem;
    }

    // Calcular subtotal
    let subtotal = 0;
    const orderItems = [];
    
    for (const item of items) {
      const menuItem = menuItemsMap[item.menu_item_id];
      const quantity = parseInt(item.quantity);
      
      if (quantity <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: 'La cantidad debe ser mayor a 0'
        });
      }
      
      const itemSubtotal = menuItem.price * quantity;
      subtotal += itemSubtotal;
      
      orderItems.push({
        menu_item_id: item.menu_item_id,
        quantity: quantity,
        unit_price: menuItem.price,
        subtotal: itemSubtotal,
        special_instructions: item.special_instructions || null
      });
    }

    // Calcular total
    const finalDeliveryFee = delivery_fee || 2.50; // Fee por defecto
    const total = subtotal + finalDeliveryFee;

    // Generar número de orden
    const orderNumber = generateOrderNumber();

    // Crear el pedido
    const orderResult = await client.query(
      `INSERT INTO orders 
       (customer_id, restaurant_id, order_number, status, subtotal, delivery_fee, total, notes) 
       VALUES ($1, $2, $3, 'nuevo', $4, $5, $6, $7) 
       RETURNING *`,
      [customer_id, restaurant_id, orderNumber, subtotal, finalDeliveryFee, total, notes]
    );

    const order = orderResult.rows[0];

    // Insertar los items del pedido
    for (const item of orderItems) {
      await client.query(
        `INSERT INTO order_items 
         (order_id, menu_item_id, quantity, unit_price, subtotal, special_instructions) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [order.id, item.menu_item_id, item.quantity, item.unit_price, item.subtotal, item.special_instructions]
      );
    }

    await client.query('COMMIT');

    // Obtener el pedido completo con detalles
    const completeOrder = await client.query(
      `SELECT 
        o.*,
        c.first_name || ' ' || c.last_name as customer_name,
        c.address as customer_address,
        r.name as restaurant_name,
        r.address as restaurant_address,
        json_agg(
          json_build_object(
            'id', oi.id,
            'menu_item_id', oi.menu_item_id,
            'menu_item_name', m.name,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'subtotal', oi.subtotal,
            'special_instructions', oi.special_instructions
          )
        ) as items
       FROM orders o
       INNER JOIN customers c ON o.customer_id = c.id
       INNER JOIN restaurants r ON o.restaurant_id = r.id
       LEFT JOIN order_items oi ON o.id = oi.order_id
       LEFT JOIN menu_items m ON oi.menu_item_id = m.id
       WHERE o.id = $1
       GROUP BY o.id, c.first_name, c.last_name, c.address, r.name, r.address`,
      [order.id]
    );

    res.status(201).json({
      success: true,
      message: 'Pedido creado exitosamente',
      data: completeOrder.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al crear pedido:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear pedido'
    });
  } finally {
    client.release();
  }
});

// GET - Obtener todos los pedidos (con filtros opcionales)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, customer_id, restaurant_id, delivery_driver_id } = req.query;
    
    let query = `
      SELECT 
        o.*,
        c.first_name || ' ' || c.last_name as customer_name,
        r.name as restaurant_name,
        CASE 
          WHEN d.id IS NOT NULL THEN d.first_name || ' ' || d.last_name 
          ELSE NULL 
        END as driver_name
      FROM orders o
      INNER JOIN customers c ON o.customer_id = c.id
      INNER JOIN restaurants r ON o.restaurant_id = r.id
      LEFT JOIN delivery_drivers d ON o.delivery_driver_id = d.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (status) {
      query += ` AND o.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }
    
    if (customer_id) {
      query += ` AND o.customer_id = $${paramCount}`;
      params.push(customer_id);
      paramCount++;
    }
    
    if (restaurant_id) {
      query += ` AND o.restaurant_id = $${paramCount}`;
      params.push(restaurant_id);
      paramCount++;
    }
    
    if (delivery_driver_id) {
      query += ` AND o.delivery_driver_id = $${paramCount}`;
      params.push(delivery_driver_id);
      paramCount++;
    }
    
    query += ' ORDER BY o.created_at DESC';
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rowCount
    });
  } catch (error) {
    console.error('Error al obtener pedidos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener pedidos'
    });
  }
});

// GET - Obtener un pedido por ID con todos sus detalles
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT 
        o.*,
        c.first_name || ' ' || c.last_name as customer_name,
        c.address as customer_address,
        c.latitude as customer_latitude,
        c.longitude as customer_longitude,
        u_customer.phone as customer_phone,
        r.name as restaurant_name,
        r.address as restaurant_address,
        r.latitude as restaurant_latitude,
        r.longitude as restaurant_longitude,
        u_restaurant.phone as restaurant_phone,
        CASE 
          WHEN d.id IS NOT NULL THEN d.first_name || ' ' || d.last_name 
          ELSE NULL 
        END as driver_name,
        d.vehicle_type as driver_vehicle,
        d.license_plate as driver_plate,
        u_driver.phone as driver_phone,
        json_agg(
          json_build_object(
            'id', oi.id,
            'menu_item_id', oi.menu_item_id,
            'menu_item_name', m.name,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'subtotal', oi.subtotal,
            'special_instructions', oi.special_instructions
          )
        ) as items
       FROM orders o
       INNER JOIN customers c ON o.customer_id = c.id
       INNER JOIN users u_customer ON c.user_id = u_customer.id
       INNER JOIN restaurants r ON o.restaurant_id = r.id
       INNER JOIN users u_restaurant ON r.user_id = u_restaurant.id
       LEFT JOIN delivery_drivers d ON o.delivery_driver_id = d.id
       LEFT JOIN users u_driver ON d.user_id = u_driver.id
       LEFT JOIN order_items oi ON o.id = oi.order_id
       LEFT JOIN menu_items m ON oi.menu_item_id = m.id
       WHERE o.id = $1
       GROUP BY o.id, c.first_name, c.last_name, c.address, c.latitude, c.longitude,
                u_customer.phone, r.name, r.address, r.latitude, r.longitude, u_restaurant.phone,
                d.id, d.first_name, d.last_name, d.vehicle_type, d.license_plate, u_driver.phone`,
      [id]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Pedido no encontrado'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error al obtener pedido:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener pedido'
    });
  }
});

// PATCH - Actualizar estado del pedido
router.patch('/:id/status', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const { status, cancelled_reason } = req.body;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'El estado es requerido'
      });
    }
    
    // Validar estado
    const validStatuses = ['nuevo', 'confirmado', 'preparado', 'en_camino', 'entregado', 'cancelado'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Estado inválido. Estados permitidos: ' + validStatuses.join(', ')
      });
    }
    
    // Si se cancela, el motivo es requerido
    if (status === 'cancelado' && !cancelled_reason) {
      return res.status(400).json({
        success: false,
        error: 'El motivo de cancelación es requerido'
      });
    }
    
    await client.query('BEGIN');
    
    // Obtener el pedido actual
    const currentOrder = await client.query('SELECT status FROM orders WHERE id = $1', [id]);
    
    if (currentOrder.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Pedido no encontrado'
      });
    }
    
    // Preparar query de actualización
    let updateQuery = 'UPDATE orders SET status = $1';
    const params = [status];
    let paramCount = 2;
    
    // Actualizar timestamps según el estado
    if (status === 'confirmado') {
      updateQuery += `, confirmed_at = NOW()`;
    } else if (status === 'preparado') {
      updateQuery += `, prepared_at = NOW()`;
    } else if (status === 'en_camino') {
      updateQuery += `, picked_up_at = NOW()`;
    } else if (status === 'entregado') {
      updateQuery += `, delivered_at = NOW()`;
    } else if (status === 'cancelado') {
      updateQuery += `, cancelled_at = NOW(), cancelled_reason = $${paramCount}`;
      params.push(cancelled_reason);
      paramCount++;
    }
    
    updateQuery += ` WHERE id = $${paramCount} RETURNING *`;
    params.push(id);
    
    const result = await client.query(updateQuery, params);
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: 'Estado del pedido actualizado exitosamente',
      data: result.rows[0]
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al actualizar estado del pedido:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar estado del pedido'
    });
  } finally {
    client.release();
  }
});

// PATCH - Asignar repartidor a un pedido (solo para pedidos confirmados o preparados)
router.patch('/:id/assign-driver', authenticateToken, authorizeRoles('restaurante'), async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const { delivery_driver_id } = req.body;
    
    if (!delivery_driver_id) {
      return res.status(400).json({
        success: false,
        error: 'El ID del repartidor es requerido'
      });
    }
    
    await client.query('BEGIN');
    
    // Verificar que el pedido existe y está en un estado válido para asignar repartidor
    const orderCheck = await client.query(
      'SELECT id, status FROM orders WHERE id = $1',
      [id]
    );
    
    if (orderCheck.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Pedido no encontrado'
      });
    }
    
    const order = orderCheck.rows[0];
    if (!['confirmado', 'preparado'].includes(order.status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Solo se puede asignar repartidor a pedidos confirmados o preparados'
      });
    }
    
    // Verificar que el repartidor existe y está disponible
    const driverCheck = await client.query(
      'SELECT id, is_available FROM delivery_drivers WHERE id = $1',
      [delivery_driver_id]
    );
    
    if (driverCheck.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Repartidor no encontrado'
      });
    }
    
    if (!driverCheck.rows[0].is_available) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'El repartidor no está disponible'
      });
    }
    
    // Asignar repartidor
    const result = await client.query(
      'UPDATE orders SET delivery_driver_id = $1 WHERE id = $2 RETURNING *',
      [delivery_driver_id, id]
    );
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: 'Repartidor asignado exitosamente',
      data: result.rows[0]
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al asignar repartidor:', error);
    res.status(500).json({
      success: false,
      error: 'Error al asignar repartidor'
    });
  } finally {
    client.release();
  }
});

// GET - Obtener pedidos pendientes por restaurante
router.get('/restaurant/:restaurant_id/pending', authenticateToken, authorizeRoles('restaurante'), async (req, res) => {
  try {
    const { restaurant_id } = req.params;
    
    const result = await pool.query(
      `SELECT 
        o.*,
        c.first_name || ' ' || c.last_name as customer_name,
        c.address as customer_address,
        u.phone as customer_phone
       FROM orders o
       INNER JOIN customers c ON o.customer_id = c.id
       INNER JOIN users u ON c.user_id = u.id
       WHERE o.restaurant_id = $1 
       AND o.status IN ('nuevo', 'confirmado', 'preparado')
       ORDER BY o.created_at ASC`,
      [restaurant_id]
    );
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rowCount
    });
  } catch (error) {
    console.error('Error al obtener pedidos pendientes:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener pedidos pendientes'
    });
  }
});

// GET - Obtener pedidos asignados a un repartidor
router.get('/driver/:driver_id/assigned', authenticateToken, authorizeRoles('repartidor'), async (req, res) => {
  try {
    const { driver_id } = req.params;
    
    const result = await pool.query(
      `SELECT 
        o.*,
        c.first_name || ' ' || c.last_name as customer_name,
        c.address as customer_address,
        c.latitude as customer_latitude,
        c.longitude as customer_longitude,
        u_customer.phone as customer_phone,
        r.name as restaurant_name,
        r.address as restaurant_address,
        r.latitude as restaurant_latitude,
        r.longitude as restaurant_longitude,
        u_restaurant.phone as restaurant_phone
       FROM orders o
       INNER JOIN customers c ON o.customer_id = c.id
       INNER JOIN users u_customer ON c.user_id = u_customer.id
       INNER JOIN restaurants r ON o.restaurant_id = r.id
       INNER JOIN users u_restaurant ON r.user_id = u_restaurant.id
       WHERE o.delivery_driver_id = $1 
       AND o.status IN ('preparado', 'en_camino')
       ORDER BY o.created_at ASC`,
      [driver_id]
    );
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rowCount
    });
  } catch (error) {
    console.error('Error al obtener pedidos asignados:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener pedidos asignados'
    });
  }
});

module.exports = router;
