/**
 * Middleware to restrict access based on user roles
 * @param {...string} roles - Allowed roles
 */
const allowRoles = (...roles) => {
  return (req, res, next) => {
    // Check if user and role exist (populated by protect middleware)
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        message: 'Not authorized, role missing',
      });
    }

    // Check if user role is in the allowed roles list
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Role (${req.user.role}) is not allowed to access this resource`,
      });
    }

    next();
  };
};

module.exports = {
  allowRoles,
};
