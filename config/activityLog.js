const prisma = require('./database');

async function createSystemActivityLog({ userId, action, description }) {
  if (!userId || !action) {
    return;
  }

  try {
    await prisma.activityLog.create({
      data: {
        userId,
        action,
        description: description || null,
        actionType: 'SYSTEM'
      }
    });
  } catch (error) {
    console.warn('Failed to create system activity log:', error.message);
  }
}

module.exports = {
  createSystemActivityLog
};