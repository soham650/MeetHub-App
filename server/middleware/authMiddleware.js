const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  try {
    // Retrieve token from Authorization header (Format: Bearer <token>)
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    // Verify token validity
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();

  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

module.exports = authMiddleware;
