const jwt = require('jsonwebtoken');

/**
 * Signs a JWT token with the provided payload
 * @param {Object} payload - Token payload (must only contain id and role)
 * @returns {string} - Signed JWT token
 */
const signToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

/**
 * Verifies a JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object} - Decoded payload
 */
const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

module.exports = {
  signToken,
  verifyToken,
};
