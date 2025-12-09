const prisma = require('../config/database');

// Middleware to authenticate users
const authenticateUser = async (req, res, next) => {
  try {
    const { authorization } = req.headers;
    
    if (!authorization) {
      return res.status(401).json({ error: 'Authorization header missing' });
    }

    // Extract user ID from authorization header (you might want to use JWT in production)
    const userId = authorization.replace('Bearer ', '');
    
    if (!userId) {
      return res.status(401).json({ error: 'Invalid authorization token' });
    }

    // Find user in database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        uid: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true
      }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Middleware to check user roles
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Access denied',
        message: `Required roles: ${roles.join(', ')}. Your role: ${req.user.role}`
      });
    }

    next();
  };
};

// Helper function to check if user can create users (Admin only)
const canCreateUser = (userRole) => {
  return userRole === 'ADMIN';
};

// Helper function to check if user can create service records
const canCreateServiceRecord = (userRole) => {
  return ['ADMIN', 'SERVICE_HEAD', 'ENGINEER'].includes(userRole);
};

// Helper function to check if user can update reports
const canUpdateReport = (userRole) => {
  return ['ADMIN', 'SERVICE_HEAD', 'ENGINEER'].includes(userRole);
};

// Helper function to check if user can manage points
const canManagePoints = (userRole) => {
  return ['ADMIN', 'SERVICE_HEAD', 'ENGINEER'].includes(userRole);
};

module.exports = {
  authenticateUser,
  authorizeRoles,
  canCreateUser,
  canCreateServiceRecord,
  canUpdateReport,
  canManagePoints
};