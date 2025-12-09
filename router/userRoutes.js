const express = require('express');
const router = express.Router();
const userController = require('../controller/userController');
const { authenticateUser, authorizeRoles } = require('../config/auth');

// Public routes (if any)
router.post('/login', userController.login); // Implement if needed

// Protected routes
router.use(authenticateUser);

// Get current user profile
router.get('/me', userController.getCurrentUser);

// Authentication routes
router.post('/logout', userController.logout);
router.put('/change-password', userController.changePassword);

// Update FCM token for the current user
router.put('/fcm-token', userController.updateFcmToken);

// User management routes
router.post('/', authorizeRoles('ADMIN'), userController.createUser);
router.get('/', userController.getAllUsers);
// Dashboard endpoint (role-based)
router.get('/dashboard', userController.getDashboard);
router.get('/:id', userController.getUserById);
router.put('/:id', userController.updateUser);
router.delete('/:id', authorizeRoles('ADMIN'), userController.deleteUser);

module.exports = router;