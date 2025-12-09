const express = require('express');
const router = express.Router();
const notificationController = require('../controller/notificationController');
const { authenticateUser, authorizeRoles } = require('../config/auth');

// All routes require authentication
router.use(authenticateUser);

// Notification management routes
router.get('/', notificationController.getUserNotifications);
router.get('/unread-count', notificationController.getUnreadCount);
router.get('/statistics', authorizeRoles('ADMIN'), notificationController.getNotificationStatistics);
router.get('/:id', notificationController.getNotificationById);
router.put('/:id/read', notificationController.markAsRead);
router.put('/mark-all-read', notificationController.markAllAsRead);
router.delete('/:id', notificationController.deleteNotification);
router.delete('/clear-all' , notificationController.clearAllNotifications);
router.delete('/old/:days', authorizeRoles('ADMIN'), notificationController.deleteOldNotifications);

// Send custom notification (Admin/Service Head only)
router.post('/send', authorizeRoles('ADMIN', 'SERVICE_HEAD'), notificationController.sendCustomNotification);

module.exports = router;