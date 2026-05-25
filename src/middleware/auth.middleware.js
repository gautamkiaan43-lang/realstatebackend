const { verifyToken } = require('../utils/jwt');

/**
 * Middleware to protect routes and allow only authenticated users
 */
const protect = async (req, res, next) => {
  try {
    let token;

    // 1. Check if token exists in Authorization header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        message: 'Not authorized, no token provided',
      });
    }

    // 2. Verify token
    try {
      const decoded = verifyToken(token);

      // 3. Attach user to request (id and role only)
      req.user = {
        id: Number(decoded.id),
        role: decoded.role,
      };

      next();
    } catch (error) {
      return res.status(401).json({
        message: 'Not authorized, invalid token',
      });
    }
  } catch (error) {
    res.status(500).json({
      message: 'Internal server error during authentication',
    });
  }
};

/**
 * Middleware to restrict access based on user roles
 * @param  {...string} roles - Allowed roles
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    // roles is an array ['SUPER_ADMIN', 'MANAGER']
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: 'You do not have permission to perform this action'
      });
    }
    next();
  };
};

module.exports = {
  protect,
  restrictTo
};
