const jwt = require('jsonwebtoken');

// Middleware para verificar el token JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Acceso denegado. Token no proporcionado'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        error: 'Token inválido o expirado'
      });
    }

    req.user = user; // Agregar datos del usuario al request
    next();
  });
};

// Middleware para verificar roles específicos
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'No autenticado'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permisos para acceder a este recurso'
      });
    }

    next();
  };
};

module.exports = { authenticateToken, authorizeRoles };
