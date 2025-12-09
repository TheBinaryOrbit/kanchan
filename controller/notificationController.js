const prisma = require('../config/database');
const notificationService = require('../config/notificationService');

class NotificationController {

  // Get user notifications
  async getUserNotifications(req, res) {
    try {
      const currentUser = req.user;
      const { isRead, type, page = 1, limit = 20 } = req.query;
      const skip = (page - 1) * limit;

      const where = { userId: currentUser.id };
      if (isRead !== undefined) where.isRead = isRead === 'true';
      if (type) where.type = type;

      const [notifications, total, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where,
          skip: parseInt(skip),
          take: parseInt(limit),
          orderBy: { createdAt: 'desc' },
          include: {
            serviceRecord: {
              include: {
                customer: {
                  select: {
                    id: true,
                    uid: true,
                    name: true
                  }
                },
                machine: {
                  select: {
                    id: true,
                    name: true,
                    category: true,
                    brand: true
                  }
                }
              }
            }
          }
        }),
        prisma.notification.count({ where }),
        prisma.notification.count({ 
          where: { 
            userId: currentUser.id, 
            isRead: false 
          } 
        })
      ]);

      res.json({
        message: 'Notifications retrieved successfully',
        notifications,
        unreadCount,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ 
        error: 'Failed to fetch notifications',
        message: error.message
      });
    }
  }

  // Mark notification as read
  async markAsRead(req, res) {
    try {
      const { id } = req.params;
      const currentUser = req.user;

      // Check if notification exists and belongs to user
      const notification = await prisma.notification.findFirst({
        where: {
          id,
          userId: currentUser.id
        }
      });

      if (!notification) {
        return res.status(404).json({ 
          error: 'Notification not found',
          message: `Notification with ID ${id} not found or doesn't belong to you`
        });
      }

      // Mark as read
      const updatedNotification = await prisma.notification.update({
        where: { id },
        data: { isRead: true }
      });

      res.json({
        message: 'Notification marked as read',
        notification: updatedNotification
      });

    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({ 
        error: 'Failed to mark notification as read',
        message: error.message
      });
    }
  }

  // Mark all notifications as read
  async markAllAsRead(req, res) {
    try {
      const currentUser = req.user;

      const result = await prisma.notification.updateMany({
        where: {
          userId: currentUser.id,
          isRead: false
        },
        data: { isRead: true }
      });

      res.json({
        message: 'All notifications marked as read',
        count: result.count
      });

    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({ 
        error: 'Failed to mark all notifications as read',
        message: error.message
      });
    }
  }

  // Delete notification
  async deleteNotification(req, res) {
    try {
      const { id } = req.params;
      const currentUser = req.user;

      // Check if notification exists and belongs to user
      const notification = await prisma.notification.findFirst({
        where: {
          id,
          userId: currentUser.id
        }
      });

      if (!notification) {
        return res.status(404).json({ 
          error: 'Notification not found',
          message: `Notification with ID ${id} not found or doesn't belong to you`
        });
      }

      // Delete notification
      await prisma.notification.delete({
        where: { id }
      });

      res.json({
        message: 'Notification deleted successfully'
      });

    } catch (error) {
      console.error('Error deleting notification:', error);
      res.status(500).json({ 
        error: 'Failed to delete notification',
        message: error.message
      });
    }
  }


  async clearAllNotifications(req, res) {
    try {
      const currentUser = req.user;

      console.log('Clearing all notifications for user:', currentUser.id);
      const result = await prisma.notification.deleteMany({
        where: {
          userId: currentUser.id
        }
      });




      res.json({
        message: 'All notifications cleared successfully',
        count: result.count
      });

    } catch (error) {
      console.error('Error clearing all notifications:', error);
      res.status(500).json({ 
        error: 'Failed to clear all notifications',
        message: error.message
      });
    }
  }

  // Get notification by ID
  async getNotificationById(req, res) {
    try {
      const { id } = req.params;
      const currentUser = req.user;

      const notification = await prisma.notification.findFirst({
        where: {
          id,
          userId: currentUser.id
        },
        include: {
          serviceRecord: {
            include: {
              customer: true,
              machine: true,
              createdBy: {
                select: {
                  id: true,
                  name: true,
                  role: true
                }
              }
            }
          }
        }
      });

      if (!notification) {
        return res.status(404).json({ 
          error: 'Notification not found',
          message: `Notification with ID ${id} not found or doesn't belong to you`
        });
      }

      // Mark as read if not already read
      if (!notification.isRead) {
        await prisma.notification.update({
          where: { id },
          data: { isRead: true }
        });
        notification.isRead = true;
      }

      res.json({
        message: 'Notification retrieved successfully',
        notification
      });

    } catch (error) {
      console.error('Error fetching notification:', error);
      res.status(500).json({ 
        error: 'Failed to fetch notification',
        message: error.message
      });
    }
  }

  // Get unread count
  async getUnreadCount(req, res) {
    try {
      const currentUser = req.user;

      const unreadCount = await prisma.notification.count({
        where: {
          userId: currentUser.id,
          isRead: false
        }
      });

      res.json({
        message: 'Unread count retrieved successfully',
        unreadCount
      });

    } catch (error) {
      console.error('Error fetching unread count:', error);
      res.status(500).json({ 
        error: 'Failed to fetch unread count',
        message: error.message
      });
    }
  }

  // Send custom notification (Admin/Service Head only)
  async sendCustomNotification(req, res) {
    try {
      const { userIds, roles, title, message, type = 'INFO', serviceRecordId } = req.body;
      const currentUser = req.user;

      // Check permissions
      if (!['ADMIN', 'SERVICE_HEAD'].includes(currentUser.role)) {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'Only Admin or Service Head can send custom notifications'
        });
      }

      // Validate required fields
      if (!title || !message) {
        return res.status(400).json({ 
          error: 'Missing required fields',
          required: ['title', 'message']
        });
      }

      // Validate that either userIds or roles is provided
      if (!userIds && !roles) {
        return res.status(400).json({ 
          error: 'Either userIds or roles must be provided'
        });
      }

      let notifications = [];

      // Send to specific users
      if (userIds && userIds.length > 0) {
        for (const userId of userIds) {
          const notification = await notificationService.sendNotificationToUser(
            userId, title, message, serviceRecordId, type
          );
          notifications.push(notification);
        }
      }

      // Send to users by role
      if (roles && roles.length > 0) {
        const roleNotifications = await notificationService.sendNotificationByRole(
          roles, title, message, serviceRecordId, type
        );
        notifications = notifications.concat(roleNotifications);
      }

      res.json({
        message: 'Custom notifications sent successfully',
        count: notifications.length,
        notifications
      });

    } catch (error) {
      console.error('Error sending custom notification:', error);
      res.status(500).json({ 
        error: 'Failed to send custom notification',
        message: error.message
      });
    }
  }

  // Get notification statistics (Admin only)
  async getNotificationStatistics(req, res) {
    try {
      const currentUser = req.user;

      // Check permissions
      if (currentUser.role !== 'ADMIN') {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'Only Admin can view notification statistics'
        });
      }

      const [
        totalNotifications,
        unreadNotifications,
        typeCounts,
        recentActivity
      ] = await Promise.all([
        prisma.notification.count(),
        prisma.notification.count({ where: { isRead: false } }),
        prisma.notification.groupBy({
          by: ['type'],
          _count: { type: true }
        }),
        prisma.notification.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                role: true
              }
            }
          }
        })
      ]);

      const statistics = {
        totalNotifications,
        unreadNotifications,
        readRate: totalNotifications > 0 ? 
          ((totalNotifications - unreadNotifications) / totalNotifications * 100).toFixed(2) : 0,
        typeCounts: typeCounts.reduce((acc, item) => {
          acc[item.type] = item._count.type;
          return acc;
        }, {}),
        recentActivity
      };

      res.json({
        message: 'Notification statistics retrieved successfully',
        statistics
      });

    } catch (error) {
      console.error('Error fetching notification statistics:', error);
      res.status(500).json({ 
        error: 'Failed to fetch notification statistics',
        message: error.message
      });
    }
  }

  // Delete old notifications (Admin only)
  async deleteOldNotifications(req, res) {
    try {
      const currentUser = req.user;
      const { days = 30 } = req.query;

      // Check permissions
      if (currentUser.role !== 'ADMIN') {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'Only Admin can delete old notifications'
        });
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));

      const result = await prisma.notification.deleteMany({
        where: {
          createdAt: { lt: cutoffDate },
          isRead: true
        }
      });

      res.json({
        message: 'Old notifications deleted successfully',
        deletedCount: result.count,
        cutoffDate: cutoffDate.toISOString()
      });

    } catch (error) {
      console.error('Error deleting old notifications:', error);
      res.status(500).json({ 
        error: 'Failed to delete old notifications',
        message: error.message
      });
    }
  }
}

module.exports = new NotificationController();