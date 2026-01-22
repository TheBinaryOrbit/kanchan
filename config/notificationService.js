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
    console.log('=== sendNotificationByRole START ===');
    console.log('Roles:', roles);
    console.log('Title:', title);
    console.log('Message:', message);
    console.log('ServiceRecordId:', serviceRecordId);
    console.log('Type:', type);
    
    try {
      // Get users with specified roles
      const users = await prisma.user.findMany({
        where: {
          role: { in: roles },
          isActive: true
        },
        select: { id: true }
      });

      console.log(`Found ${users.length} active users with roles: ${roles.join(', ')}`);
      console.log('User IDs:', users.map(u => u.id));
      
      if (users.length === 0) {
        console.log(`No active users found with roles: ${roles.join(', ')}`);
        console.log('=== sendNotificationByRole END (no users) ===');
        return [];
      }

      // Create notifications for all users and attempt FCM push
      const notifications = [];
      for (const user of users) {
        console.log(`Creating notification for user ${user.id}...`);
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
        console.log(`Notification created with ID: ${notif.id} for user ${user.id}`);

        notifications.push(notif);

        // Try to load user's fcmToken and send push
        console.log(`Checking FCM token for user ${user.id}...`);
        try {
          const u = await prisma.user.findUnique({ where: { id: user.id }, select: { fcmToken: true } });
          console.log(`User ${user.id} FCM token:`, u?.fcmToken ? 'Present' : 'Not found');
          console.log(`Firebase messaging available:`, !!admin.messaging);
          
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
            console.log(`Sending FCM push to user ${user.id}...`);
            const messageId = await admin.messaging().send({ token: u.fcmToken, ...payload });
            console.log(`FCM push sent to user ${user.id}, messageId: ${messageId}`);
          } else {
            console.log(`Skipping FCM push for user ${user.id} - missing token or messaging not available`);
          }
        } catch (pushErr) {
          console.error('FCM push failed for user', user.id, '- Error:', pushErr.message);
          console.error('Full error:', pushErr);
        }
      }

      console.log(`Successfully sent ${notifications.length} notifications for: ${title}`);
      console.log('Notification IDs:', notifications.map(n => n.id));
      console.log('=== sendNotificationByRole END (success) ===');
      return notifications;
    } catch (error) {
      console.error('=== sendNotificationByRole ERROR ===');
      console.error('Error sending notifications by role:', error);
      console.error('Stack trace:', error.stack);
      console.error('=== sendNotificationByRole END (error) ===');
      throw error;
    }
  }

  // Send notification to specific user
  async sendNotificationToUser(userId, title, message, serviceRecordId = null, type = 'INFO') {
    console.log('=== sendNotificationToUser START ===');
    console.log('UserId:', userId);
    console.log('Title:', title);
    console.log('Message:', message);
    console.log('ServiceRecordId:', serviceRecordId);
    console.log('Type:', type);
    
    try {
      console.log('Creating notification in database...');
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
      console.log(`Notification created with ID: ${notification.id}`);

      console.log(`Notification sent to user ${userId}: ${title}`);
      // Attempt push using user's fcmToken and log message ID
      console.log(`Fetching FCM token for user ${userId}...`);
      try {
        const u = await prisma.user.findUnique({ where: { id: userId }, select: { fcmToken: true } });
        console.log(`User ${userId} FCM token:`, u?.fcmToken ? 'Present' : 'Not found');
        console.log(`Firebase messaging available:`, !!admin.messaging);
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
          console.log(`Sending FCM push to user ${userId}...`);
          const messageId = await admin.messaging().send({ token: u.fcmToken, ...payload });
          console.log(`FCM push sent to user ${userId}, messageId: ${messageId}`);
        } else {
          console.log(`Skipping FCM push for user ${userId} - missing token or messaging not available`);
        }
      } catch (pushErr) {
        console.error('FCM push failed for user', userId, '- Error:', pushErr.message);
        console.error('Full error:', pushErr);
      }

      console.log('=== sendNotificationToUser END (success) ===');
      return notification;
    } catch (error) {
      console.error('=== sendNotificationToUser ERROR ===');
      console.error('Error sending notification to user:', error);
      console.error('Stack trace:', error.stack);
      console.error('=== sendNotificationToUser END (error) ===');
      throw error;
    }
  }

  // Send installation notification (Step 2)
  async sendInstallationNotification(serviceRecord) {
    console.log('\n>>> sendInstallationNotification called');
    console.log('ServiceRecord ID:', serviceRecord.id);
    console.log('Customer:', serviceRecord.customer?.name);
    console.log('Machine:', serviceRecord.machine?.name);
    
    const title = 'New Installation Completed';
    const message = `New installation completed for Customer: ${serviceRecord.customer.name}, Machine: ${serviceRecord.machine.name}. Customer ID: ${serviceRecord.customer.uid}`;
    console.log('Notification title:', title);
    
    const roles = ['ADMIN', 'SERVICE_HEAD', 'SALES', 'COMMERCIAL'];
    return await this.sendNotificationByRole(roles, title, message, serviceRecord.id, 'INFO');
  }

  // Send report submission notification (Step 5)
  async sendReportSubmissionNotification(serviceRecord, reportData) {
    console.log('\n>>> sendReportSubmissionNotification called');
    console.log('ServiceRecord ID:', serviceRecord.id);
    console.log('Customer:', serviceRecord.customer?.name);
    console.log('Report Data:', reportData);
    
    const title = 'Service Report Submitted';
    const message = `Service report submitted for Customer: ${serviceRecord.customer.name}, Machine: ${serviceRecord.machine.name}. Please review for any open points.`;
    console.log('Notification title:', title);
    
    const roles = ['ADMIN', 'SERVICE_HEAD', 'SALES', 'COMMERCIAL'];
    return await this.sendNotificationByRole(roles, title, message, serviceRecord.id, 'INFO');
  }

  // Send escalation notification (Step 6)
  async sendEscalationNotification(serviceRecord, openPoints) {
    console.log('\n>>> sendEscalationNotification called');
    console.log('ServiceRecord ID:', serviceRecord.id);
    console.log('Customer:', serviceRecord.customer?.name);
    console.log('Open Points Count:', openPoints.length);
    console.log('Open Points:', openPoints);
    
    const title = 'Service Escalation Required';
    const message = `Service escalation: ${openPoints.length} open points remaining for Customer: ${serviceRecord.customer.name}. Immediate attention required.`;
    console.log('Notification title:', title);
    
    const roles = ['SERVICE_HEAD'];
    return await this.sendNotificationByRole(roles, title, message, serviceRecord.id, 'URGENT');
  }

  // Send point assignment notification
  async sendPointAssignmentNotification(point, assignedToId) {
    console.log('\n>>> sendPointAssignmentNotification called');
    console.log('Point ID:', point.id);
    console.log('Point Title:', point.title);
    console.log('Point Priority:', point.priority);
    console.log('Assigned To User ID:', assignedToId);
    console.log('Service Record ID:', point.serviceRecordId);
    
    const title = 'New Point Assigned';
    const message = `You have been assigned a new point: "${point.title}". Priority: ${point.priority}`;
    
    return await this.sendNotificationToUser(assignedToId, title, message, point.serviceRecordId, 'WARNING');
  }

  // Send warranty expiry notification
  async sendWarrantyExpiryNotification(serviceRecord) {
    console.log('\n>>> sendWarrantyExpiryNotification called');
    console.log('ServiceRecord ID:', serviceRecord.id);
    console.log('Customer:', serviceRecord.customer?.name);
    console.log('Machine:', serviceRecord.machine?.name);
    console.log('Warranty Expires At:', serviceRecord.warrantyExpiresAt);
    
    const title = 'Warranty Expiring Soon';
    const message = `Warranty for ${serviceRecord.customer.name}'s ${serviceRecord.machine.name} expires on ${serviceRecord.warrantyExpiresAt.toDateString()}`;
    console.log('Notification title:', title);
    
    const roles = ['ADMIN', 'SERVICE_HEAD', 'SALES'];
    return await this.sendNotificationByRole(roles, title, message, serviceRecord.id, 'WARNING');
  }

  // Send pending payment notification
  async sendPendingPaymentNotification(serviceRecord) {
    console.log('\n>>> sendPendingPaymentNotification called');
    console.log('ServiceRecord ID:', serviceRecord.id);
    console.log('Customer:', serviceRecord.customer?.name);
    console.log('Pending Amount:', serviceRecord.pendingAmount);
    
    if (serviceRecord.pendingAmount > 0) {
      const title = 'Pending Payment Alert';
      console.log('Notification title:', title);
      const message = `Pending payment of ₹${serviceRecord.pendingAmount} for Customer: ${serviceRecord.customer.name}`;
      
      const roles = ['ADMIN', 'SALES', 'COMMERCIAL'];
      return await this.sendNotificationByRole(roles, title, message, serviceRecord.id, 'WARNING');
    } else {
      console.log('No pending amount - skipping notification');
    }
  }

  // Mark notification as read
  async markAsRead(notificationId, userId) {
    console.log('\n>>> markAsRead called');
    console.log('Notification ID:', notificationId);
    console.log('User ID:', userId);
    
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
      console.log('Notifications marked as read:', notification.count);

      return notification;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      console.error('Stack trace:', error.stack);
      throw error;
    }
  }

  // Get user notifications
  async getUserNotifications(userId, isRead = null, limit = 50) {
    console.log('\n>>> getUserNotifications called');
    console.log('User ID:', userId);
    console.log('IsRead filter:', isRead);
    console.log('Limit:', limit);
    
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
      console.log(`Found ${notifications.length} notifications for user ${userId}`);
      console.log('Notification IDs:', notifications.map(n => n.id));

      return notifications;
    } catch (error) {
      console.error('Error fetching user notifications:', error);
      console.error('Stack trace:', error.stack);
      throw error;
    }
  }
}

module.exports = new NotificationService();