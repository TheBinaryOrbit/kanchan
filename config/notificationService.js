const prisma = require('../config/database');
const admin = require('firebase-admin');

// Initialize firebase-admin if credentials are present in env
try {
  if (!admin.apps.length) {
    const firebasePrivateKey = process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: firebasePrivateKey
      })
    });
    console.log('Firebase admin initialized');
  }
} catch (e) {
  console.warn('Failed to initialize Firebase Admin SDK:', e.message);
}

class NotificationService {
  
  // Send notification to specific users by role
  async sendNotificationByRole(roles, title, message, serviceRecordId = null, type = 'INFO') {
    try {
      // Get users with specified roles
      const users = await prisma.user.findMany({
        where: {
          role: { in: roles },
          isActive: true
        },
        select: { id: true }
      });

      if (users.length === 0) {
        console.log(`No active users found with roles: ${roles.join(', ')}`);
        return [];
      }

      // Create notifications for all users and attempt FCM push
      const notifications = [];
      for (const user of users) {
        const notif = await prisma.notification.create({
          data: {
            userId: user.id,
            title,
            message,
            type,
            serviceRecordId,
            metadata: {
              sentAt: new Date().toISOString(),
              targetRoles: roles
            }
          }
        });

        notifications.push(notif);

        // Try to load user's fcmToken and send push
        try {
          const u = await prisma.user.findUnique({ where: { id: user.id }, select: { fcmToken: true } });
          if (u && u.fcmToken && admin.messaging) {
            const payload = {
              notification: {
                title,
                body: message
              },
              data: {
                serviceRecordId: serviceRecordId || '',
                type
              }
            };
            const messageId = await admin.messaging().send({ token: u.fcmToken, ...payload });
            console.log(`FCM push sent to user ${user.id}, messageId: ${messageId}`);
          }
        } catch (pushErr) {
          console.warn('FCM push failed for user', user.id, pushErr.message);
        }
      }

      console.log(`Sent ${notifications.length} notifications for: ${title}`);
      return notifications;
    } catch (error) {
      console.error('Error sending notifications by role:', error);
      throw error;
    }
  }

  // Send notification to specific user
  async sendNotificationToUser(userId, title, message, serviceRecordId = null, type = 'INFO') {
    try {
      const notification = await prisma.notification.create({
        data: {
          userId,
          title,
          message,
          type,
          serviceRecordId,
          metadata: {
            sentAt: new Date().toISOString()
          }
        }
      });

      console.log(`Notification sent to user ${userId}: ${title}`);
      // Attempt push using user's fcmToken and log message ID
      try {
        const u = await prisma.user.findUnique({ where: { id: userId }, select: { fcmToken: true } });
        if (u && u.fcmToken && admin.messaging) {
          const payload = {
            notification: {
              title,
              body: message
            },
            data: {
              serviceRecordId: serviceRecordId || '',
              type
            }
          };
          const messageId = await admin.messaging().send({ token: u.fcmToken, ...payload });
          console.log(`FCM push sent to user ${userId}, messageId: ${messageId}`);
        }
      } catch (pushErr) {
        console.warn('FCM push failed for user', userId, pushErr.message);
      }

      return notification;
    } catch (error) {
      console.error('Error sending notification to user:', error);
      throw error;
    }
  }

  // Send installation notification (Step 2)
  async sendInstallationNotification(serviceRecord) {
    const title = 'New Installation Completed';
    const message = `New installation completed for Customer: ${serviceRecord.customer.name}, Machine: ${serviceRecord.machine.name}. Customer ID: ${serviceRecord.customer.uid}`;
    
    const roles = ['ADMIN', 'SERVICE_HEAD', 'SALES', 'COMMERCIAL'];
    return await this.sendNotificationByRole(roles, title, message, serviceRecord.id, 'INFO');
  }

  // Send report submission notification (Step 5)
  async sendReportSubmissionNotification(serviceRecord, reportData) {
    const title = 'Service Report Submitted';
    const message = `Service report submitted for Customer: ${serviceRecord.customer.name}, Machine: ${serviceRecord.machine.name}. Please review for any open points.`;
    
    const roles = ['ADMIN', 'SERVICE_HEAD', 'SALES', 'COMMERCIAL'];
    return await this.sendNotificationByRole(roles, title, message, serviceRecord.id, 'INFO');
  }

  // Send escalation notification (Step 6)
  async sendEscalationNotification(serviceRecord, openPoints) {
    const title = 'Service Escalation Required';
    const message = `Service escalation: ${openPoints.length} open points remaining for Customer: ${serviceRecord.customer.name}. Immediate attention required.`;
    
    const roles = ['SERVICE_HEAD'];
    return await this.sendNotificationByRole(roles, title, message, serviceRecord.id, 'URGENT');
  }

  // Send point assignment notification
  async sendPointAssignmentNotification(point, assignedToId) {
    const title = 'New Point Assigned';
    const message = `You have been assigned a new point: "${point.title}". Priority: ${point.priority}`;
    
    return await this.sendNotificationToUser(assignedToId, title, message, point.serviceRecordId, 'WARNING');
  }

  // Send warranty expiry notification
  async sendWarrantyExpiryNotification(serviceRecord) {
    const title = 'Warranty Expiring Soon';
    const message = `Warranty for ${serviceRecord.customer.name}'s ${serviceRecord.machine.name} expires on ${serviceRecord.warrantyExpiresAt.toDateString()}`;
    
    const roles = ['ADMIN', 'SERVICE_HEAD', 'SALES'];
    return await this.sendNotificationByRole(roles, title, message, serviceRecord.id, 'WARNING');
  }

  // Send pending payment notification
  async sendPendingPaymentNotification(serviceRecord) {
    if (serviceRecord.pendingAmount > 0) {
      const title = 'Pending Payment Alert';
      const message = `Pending payment of ₹${serviceRecord.pendingAmount} for Customer: ${serviceRecord.customer.name}`;
      
      const roles = ['ADMIN', 'SALES', 'COMMERCIAL'];
      return await this.sendNotificationByRole(roles, title, message, serviceRecord.id, 'WARNING');
    }
  }

  // Mark notification as read
  async markAsRead(notificationId, userId) {
    try {
      const notification = await prisma.notification.updateMany({
        where: {
          id: notificationId,
          userId: userId
        },
        data: {
          isRead: true
        }
      });

      return notification;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  // Get user notifications
  async getUserNotifications(userId, isRead = null, limit = 50) {
    try {
      const where = { userId };
      if (isRead !== null) {
        where.isRead = isRead;
      }

      const notifications = await prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          serviceRecord: {
            include: {
              customer: true,
              machine: true
            }
          }
        }
      });

      return notifications;
    } catch (error) {
      console.error('Error fetching user notifications:', error);
      throw error;
    }
  }
}

module.exports = new NotificationService();