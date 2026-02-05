const cron = require('node-cron');
const { 
  fetchOpenPoints, 
  notifyAdmins, 
  notifyEngineers, 
  groupPoints 
} = require('./notifyOpenPoints');
const prisma = require('../config/database');


//  * Scheduled Open Points Notification Service
//  * 
//  * This script runs as a cron job to periodically check and notify about open points
//  * 
//  * Schedule options:
//  * - Every day at 9 AM: '0 9 * * *'
//  * - Every 6 hours: '0 */6 * * *'
//  * - Every hour: '0 * * * *'
//  * - Every Monday at 9 AM: '0 9 * * 1'
//  * - Twice daily (6 AM and 9 AM): '0 6,9 * * *'
//  * - Twice daily (9 AM and 5 PM): '0 9,17 * * *'
//  * 
//  * Usage: node scripts/scheduledOpenPointsNotifier.js


// Configuration
const SCHEDULE = process.env.OPEN_POINTS_CRON_SCHEDULE || '0 6,9 * * *'; // Default: Twice daily at 6 AM and 9 AM
const TIMEZONE = process.env.CRON_TIMEZONE || 'Asia/Kolkata';

// Fetch admins helper
async function fetchAdmins() {
  return await prisma.user.findMany({
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
}

// Execute notification task
async function executeNotificationTask() {
  console.log('\n' + '='.repeat(70));
  console.log(`🔔 SCHEDULED NOTIFICATION TASK STARTED`);
  console.log(`⏰ Execution time: ${new Date().toLocaleString()}`);
  console.log('='.repeat(70));

  try {
    // Fetch open points
    console.log('\n📥 Fetching open points...');
    const points = await fetchOpenPoints();
    console.log(`✓ Found ${points.length} open points`);

    if (points.length === 0) {
      console.log('\n✅ No open points found. All clear!');
      console.log('='.repeat(70) + '\n');
      return;
    }

    // Fetch admins
    console.log('📥 Fetching admin users...');
    const admins = await fetchAdmins();
    console.log(`✓ Found ${admins.length} admin users`);

    // Group points
    const groupedPoints = groupPoints(points);

    // Display summary
    console.log('\n📊 Summary:');
    console.log(`   Total: ${points.length}`);
    console.log(`   High Priority: ${groupedPoints.high.length}`);
    console.log(`   Overdue: ${groupedPoints.overdue.length}`);
    console.log(`   Unassigned: ${groupedPoints.unassigned.length}`);

    // Send notifications
    await notifyAdmins(admins, points, groupedPoints);
    await notifyEngineers(points);

    console.log('\n✅ Notification task completed successfully!');
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('\n❌ Notification task failed:');
    console.error(error);
    console.error('='.repeat(70) + '\n');
  }
}

// Initialize scheduled task
function initializeScheduler() {
  console.log('\n🤖 Initializing Open Points Notification Scheduler...');
  console.log(`📅 Schedule: ${SCHEDULE}`);
  console.log(`🌍 Timezone: ${TIMEZONE}`);
  console.log(`⏰ Current time: ${new Date().toLocaleString()}`);

  // Validate cron expression
  if (!cron.validate(SCHEDULE)) {
    console.error('❌ Invalid cron schedule expression:', SCHEDULE);
    process.exit(1);
  }

  // Create scheduled task
  const task = cron.schedule(
    SCHEDULE,
    async () => {
      await executeNotificationTask();
    },
    {
      scheduled: true,
      timezone: TIMEZONE
    }
  );

  console.log('✅ Scheduler initialized successfully!');
  console.log('📢 Waiting for scheduled execution...');
  console.log('💡 Press Ctrl+C to stop the scheduler\n');

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\n🛑 Shutting down scheduler...');
    task.stop();
    await prisma.$disconnect();
    console.log('✅ Scheduler stopped gracefully');
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n\n🛑 Shutting down scheduler...');
    task.stop();
    await prisma.$disconnect();
    console.log('✅ Scheduler stopped gracefully');
    process.exit(0);
  });

  return task;
}

// Main execution
async function main() {
  try {
    // Run once immediately on startup (optional)
    const RUN_ON_STARTUP = process.env.RUN_ON_STARTUP === 'true';
    
    if (RUN_ON_STARTUP) {
      console.log('🚀 Running initial notification task on startup...');
      await executeNotificationTask();
    }

    // Initialize scheduler for recurring execution
    initializeScheduler();

  } catch (error) {
    console.error('❌ Failed to start scheduler:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Start the scheduler
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  executeNotificationTask,
  initializeScheduler
};
