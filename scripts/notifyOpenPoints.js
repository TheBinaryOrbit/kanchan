const prisma = require('../config/database');
const admin = require('firebase-admin');

/**
 * Script to fetch all open points and notify admin and respective engineers
 * Open points include: CREATED, ASSIGNED, REASSIGNED, IN_PROGRESS statuses
 * 
 * Usage: node scripts/notifyOpenPoints.js
 */

// Initialize Firebase Admin if not already initialized
function initializeFirebase() {
  try {
    if (!admin.apps.length) {
      const firebasePrivateKey = process.env.FIREBASE_PRIVATE_KEY && 
        process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
      
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: firebasePrivateKey
        })
      });
      console.log('✓ Firebase Admin initialized successfully');
    }
  } catch (error) {
    console.error('✗ Failed to initialize Firebase Admin SDK:', error.message);
    throw error;
  }
}

// Send FCM notification using token
async function sendFCMNotification(fcmToken, title, message, data = {}) {
  if (!fcmToken || !admin.messaging) {
    return { success: false, reason: 'No FCM token or messaging not available' };
  }

  try {
    const payload = {
      token: fcmToken,
      notification: {
        title,
        body: message
      },
      data: {
        ...data,
        timestamp: new Date().toISOString()
      }
    };

    const messageId = await admin.messaging().send(payload);
    return { success: true, messageId };
  } catch (error) {
    console.error(`  ✗ FCM push failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Create in-app notification in database
async function createInAppNotification(userId, title, message, serviceRecordId, type = 'WARNING') {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        serviceRecordId,
        metadata: {
          sentAt: new Date().toISOString(),
          source: 'openPointsScript'
        }
      }
    });
    return notification;
  } catch (error) {
    console.error(`  ✗ Failed to create in-app notification: ${error.message}`);
    throw error;
  }
}

// Fetch all open points with relevant details
async function fetchOpenPoints() {
  const openStatuses = ['CREATED', 'ASSIGNED', 'REASSIGNED', 'IN_PROGRESS'];
  
  const points = await prisma.point.findMany({
    where: {
      status: {
        in: openStatuses
      }
    },
    include: {
      assignedTo: {
        select: {
          id: true,
          uid: true,
          name: true,
          email: true,
          role: true,
          fcmToken: true
        }
      },
      createdBy: {
        select: {
          id: true,
          uid: true,
          name: true,
          role: true
        }
      },
      serviceRecord: {
        include: {
          customer: {
            select: {
              uid: true,
              name: true,
              phone: true
            }
          },
          machine: {
            select: {
              name: true,
              category: true,
              brand: true,
              serialNumber: true
            }
          }
        }
      }
    },
    orderBy: [
      { priority: 'desc' },
      { dueDate: 'asc' },
      { createdAt: 'desc' }
    ]
  });

  return points;
}

// Fetch all admin users
async function fetchAdmins() {
  const admins = await prisma.user.findMany({
    where: {
      role: 'ADMIN',
      isActive: true
    },
    select: {
      id: true,
      uid: true,
      name: true,
      email: true,
      fcmToken: true
    }
  });

  return admins;
}

// Group points by priority and status
function groupPoints(points) {
  const grouped = {
    high: points.filter(p => p.priority === 'HIGH'),
    medium: points.filter(p => p.priority === 'MEDIUM'),
    low: points.filter(p => p.priority === 'LOW'),
    byStatus: {
      CREATED: points.filter(p => p.status === 'CREATED'),
      ASSIGNED: points.filter(p => p.status === 'ASSIGNED'),
      REASSIGNED: points.filter(p => p.status === 'REASSIGNED'),
      IN_PROGRESS: points.filter(p => p.status === 'IN_PROGRESS')
    },
    overdue: points.filter(p => p.dueDate && new Date(p.dueDate) < new Date()),
    unassigned: points.filter(p => !p.assignedToId)
  };

  return grouped;
}

// Notify admins about all open points (summary)
async function notifyAdmins(admins, points, groupedPoints) {
  console.log('\n📧 Notifying Admins...');
  
  if (admins.length === 0) {
    console.log('  ⚠ No active admin users found');
    return;
  }

  const summary = {
    total: points.length,
    high: groupedPoints.high.length,
    medium: groupedPoints.medium.length,
    low: groupedPoints.low.length,
    overdue: groupedPoints.overdue.length,
    unassigned: groupedPoints.unassigned.length
  };

  const title = `📊 Open Points Summary - ${summary.total} Total`;
  const message = `HIGH: ${summary.high} | MEDIUM: ${summary.medium} | LOW: ${summary.low} | Overdue: ${summary.overdue} | Unassigned: ${summary.unassigned}`;

  for (const admin of admins) {
    console.log(`\n  → Admin: ${admin.name} (${admin.uid})`);
    
    try {
      // Create in-app notification
      await createInAppNotification(
        admin.id,
        title,
        message,
        null,
        'WARNING'
      );
      console.log('    ✓ In-app notification created');

      // Send FCM push notification
      if (admin.fcmToken) {
        const result = await sendFCMNotification(
          admin.fcmToken,
          title,
          message,
          {
            type: 'OPEN_POINTS_SUMMARY',
            totalPoints: summary.total.toString(),
            highPriority: summary.high.toString(),
            overdue: summary.overdue.toString()
          }
        );
        
        if (result.success) {
          console.log(`    ✓ FCM notification sent (ID: ${result.messageId})`);
        } else {
          console.log(`    ⚠ FCM notification failed: ${result.reason || result.error}`);
        }
      } else {
        console.log('    ⚠ No FCM token available');
      }
    } catch (error) {
      console.error(`    ✗ Error notifying admin: ${error.message}`);
    }
  }
}

// Notify individual engineers about their assigned points
async function notifyEngineers(points) {
  console.log('\n👷 Notifying Engineers...');
  
  // Group points by assigned engineer
  const pointsByEngineer = new Map();
  
  points.forEach(point => {
    if (point.assignedTo) {
      if (!pointsByEngineer.has(point.assignedTo.id)) {
        pointsByEngineer.set(point.assignedTo.id, {
          user: point.assignedTo,
          points: []
        });
      }
      pointsByEngineer.get(point.assignedTo.id).points.push(point);
    }
  });

  if (pointsByEngineer.size === 0) {
    console.log('  ⚠ No engineers with assigned points found');
    return;
  }

  for (const [engineerId, data] of pointsByEngineer) {
    const { user, points: engineerPoints } = data;
    console.log(`\n  → Engineer: ${user.name} (${user.uid})`);
    console.log(`    Assigned points: ${engineerPoints.length}`);

    // Group engineer's points by priority
    const highPriority = engineerPoints.filter(p => p.priority === 'HIGH');
    const mediumPriority = engineerPoints.filter(p => p.priority === 'MEDIUM');
    const lowPriority = engineerPoints.filter(p => p.priority === 'LOW');
    const overdue = engineerPoints.filter(p => p.dueDate && new Date(p.dueDate) < new Date());

    const title = `⚠️ You have ${engineerPoints.length} open point${engineerPoints.length > 1 ? 's' : ''}`;
    const message = `HIGH: ${highPriority.length} | MEDIUM: ${mediumPriority.length} | LOW: ${lowPriority.length}${overdue.length > 0 ? ` | ⏰ OVERDUE: ${overdue.length}` : ''}`;

    try {
      // Create in-app notification
      await createInAppNotification(
        user.id,
        title,
        message,
        null,
        overdue.length > 0 ? 'URGENT' : 'WARNING'
      );
      console.log('    ✓ In-app notification created');

      // Send FCM push notification
      if (user.fcmToken) {
        const result = await sendFCMNotification(
          user.fcmToken,
          title,
          message,
          {
            type: 'ASSIGNED_POINTS',
            totalPoints: engineerPoints.length.toString(),
            highPriority: highPriority.length.toString(),
            overdue: overdue.length.toString()
          }
        );
        
        if (result.success) {
          console.log(`    ✓ FCM notification sent (ID: ${result.messageId})`);
        } else {
          console.log(`    ⚠ FCM notification failed: ${result.reason || result.error}`);
        }
      } else {
        console.log('    ⚠ No FCM token available');
      }

      // Send detailed notification for overdue points
      if (overdue.length > 0) {
        for (const point of overdue) {
          const overdueTitle = `🚨 Overdue Point: ${point.title}`;
          const overdueMessage = `Customer: ${point.serviceRecord.customer.name} | Machine: ${point.serviceRecord.machine.name} | Due: ${new Date(point.dueDate).toLocaleDateString()}`;
          
          await createInAppNotification(
            user.id,
            overdueTitle,
            overdueMessage,
            point.serviceRecordId,
            'URGENT'
          );
          console.log(`    ✓ Overdue notification sent for: ${point.title}`);
        }
      }
    } catch (error) {
      console.error(`    ✗ Error notifying engineer: ${error.message}`);
    }
  }
}

// Display summary statistics
function displaySummary(points, groupedPoints, admins) {
  console.log('\n' + '='.repeat(60));
  console.log('                    OPEN POINTS SUMMARY');
  console.log('='.repeat(60));
  console.log(`\n📊 Total Open Points: ${points.length}`);
  console.log('\n📈 By Priority:');
  console.log(`   🔴 HIGH:    ${groupedPoints.high.length}`);
  console.log(`   🟡 MEDIUM:  ${groupedPoints.medium.length}`);
  console.log(`   🟢 LOW:     ${groupedPoints.low.length}`);
  console.log('\n📋 By Status:');
  console.log(`   CREATED:      ${groupedPoints.byStatus.CREATED.length}`);
  console.log(`   ASSIGNED:     ${groupedPoints.byStatus.ASSIGNED.length}`);
  console.log(`   REASSIGNED:   ${groupedPoints.byStatus.REASSIGNED.length}`);
  console.log(`   IN_PROGRESS:  ${groupedPoints.byStatus.IN_PROGRESS.length}`);
  console.log('\n⚠️  Special Attention:');
  console.log(`   ⏰ Overdue:    ${groupedPoints.overdue.length}`);
  console.log(`   👤 Unassigned: ${groupedPoints.unassigned.length}`);
  console.log('\n👥 Recipients:');
  console.log(`   Admins:    ${admins.length}`);
  
  // Count unique engineers
  const uniqueEngineers = new Set(points.filter(p => p.assignedTo).map(p => p.assignedTo.id));
  console.log(`   Engineers: ${uniqueEngineers.size}`);
  console.log('\n' + '='.repeat(60) + '\n');
}

// Main execution function
async function main() {
  console.log('\n🚀 Starting Open Points Notification Script...');
  console.log(`⏰ Execution time: ${new Date().toLocaleString()}\n`);

  try {
    // Initialize Firebase
    initializeFirebase();

    // Fetch data
    console.log('📥 Fetching open points...');
    const points = await fetchOpenPoints();
    console.log(`✓ Found ${points.length} open points`);

    if (points.length === 0) {
      console.log('\n✅ No open points found. All clear!');
      return;
    }

    console.log('📥 Fetching admin users...');
    const admins = await fetchAdmins();
    console.log(`✓ Found ${admins.length} admin users`);

    // Group and analyze points
    const groupedPoints = groupPoints(points);

    // Display summary
    displaySummary(points, groupedPoints, admins);

    // Send notifications
    await notifyAdmins(admins, points, groupedPoints);
    await notifyEngineers(points);

    console.log('\n✅ Notification script completed successfully!');
    console.log(`📧 Total notifications sent: ${admins.length + new Set(points.filter(p => p.assignedTo).map(p => p.assignedTo.id)).size}`);

  } catch (error) {
    console.error('\n❌ Script execution failed:');
    console.error(error);
    process.exit(1);
  } finally {
    // Disconnect from database
    await prisma.$disconnect();
    console.log('\n🔌 Database connection closed');
  }
}

// Execute the script
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = {
  fetchOpenPoints,
  notifyAdmins,
  notifyEngineers,
  groupPoints
};
