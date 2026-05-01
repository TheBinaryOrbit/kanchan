const prisma = require('../config/database');

const allowedActivityTypes = ['SYSTEM', 'USER'];

class ActivityLogController {
  async createActivityLog(req, res) {
    try {
      const currentUser = req.user;
      const { action, description } = req.body;

      if (!action) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['action']
        });
      }

      const activityLog = await prisma.activityLog.create({
        data: {
          userId: currentUser.id,
          action,
          description: description || null,
          actionType: 'USER'
        },
        include: {
          user: {
            select: {
              id: true,
              uid: true,
              name: true,
              email: true,
              role: true
            }
          }
        }
      });

      res.status(201).json({
        message: 'Activity log created successfully',
        activityLog
      });
    } catch (error) {
      console.error('Error creating activity log:', error);
      res.status(500).json({
        error: 'Failed to create activity log',
        message: error.message
      });
    }
  }

  async getActivityLogs(req, res) {
    try {
      const currentUser = req.user;
      const { userId, actionType, page = 1, limit = 20 } = req.query;

      if (currentUser.role !== 'ADMIN') {
        return res.status(403).json({
          error: 'Access denied',
          message: 'Only Admin can view activity logs'
        });
      }

      if (actionType && !allowedActivityTypes.includes(actionType)) {
        return res.status(400).json({
          error: 'Invalid actionType',
          validActionTypes: allowedActivityTypes
        });
      }

      const take = parseInt(limit, 10);
      const skip = (parseInt(page, 10) - 1) * take;
      const where = {};

      if (userId) {
        where.userId = userId;
      }

      if (actionType) {
        where.actionType = actionType;
      }

      const [activityLogs, total] = await Promise.all([
        prisma.activityLog.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                uid: true,
                name: true,
                email: true,
                role: true
              }
            }
          }
        }),
        prisma.activityLog.count({ where })
      ]);

      res.json({
        message: 'Activity logs retrieved successfully',
        activityLogs,
        pagination: {
          page: parseInt(page, 10),
          limit: take,
          total,
          pages: Math.ceil(total / take)
        }
      });
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      res.status(500).json({
        error: 'Failed to fetch activity logs',
        message: error.message
      });
    }
  }
}

module.exports = new ActivityLogController();