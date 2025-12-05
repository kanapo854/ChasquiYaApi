const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Importar rutas
const authRoutes = require('./routes/auth');
const menuItemsRoutes = require('./routes/menu_items');
const ordersRoutes = require('./routes/orders');

// Importar rutas completas (transaccionales)
const restaurantsCompleteRoutes = require('./routes/restaurants_complete');
const customersCompleteRoutes = require('./routes/customers_complete');
const deliveryDriversCompleteRoutes = require('./routes/delivery_drivers_complete');

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ruta principal
app.get('/', (req, res) => {
  res.json({
    message: 'Bienvenido a ChasquiYa API',
    version: '1.0.0',
    status: 'active',
    endpoints: {
      users: '/api/users',
      restaurants: '/api/restaurants',
      customers: '/api/customers',
      delivery_drivers: '/api/delivery-drivers'
    }
  });
});

// Ruta de salud
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: 'PostgreSQL'
  });
});

// Configurar rutas de la API
// Ruta de autenticación
app.use('/api/auth', authRoutes);

// Ruta de items del menú
app.use('/api/menu-items', menuItemsRoutes);

// Ruta de pedidos
app.use('/api/orders', ordersRoutes);

// Rutas completas (transaccionales - recomendadas)
app.use('/api/restaurants-complete', restaurantsCompleteRoutes);
app.use('/api/customers-complete', customersCompleteRoutes);
app.use('/api/delivery-drivers-complete', deliveryDriversCompleteRoutes);

// Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada'
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
