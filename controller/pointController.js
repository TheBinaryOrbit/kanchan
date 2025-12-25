const prisma = require('../config/database');
const notificationService = require('../config/notificationService');
const { canManagePoints } = require('../config/auth');

class PointController {

  // Create point
  async createPoint(req, res) {
    try {
      const { serviceRecordId, title, description, priority, assignedToId, dueDate } = req.body;
      const currentUser = req.user;

      // Check if current user can manage points
      if (!canManagePoints(currentUser.role)) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'Only Admin, Service Head, or Engineer can create points'
        });
      }

      // Validate required fields
      if (!serviceRecordId || !title) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['serviceRecordId', 'title']
        });
      }

      // Validate service record exists
      const serviceRecord = await prisma.serviceRecord.findUnique({
        where: { id: serviceRecordId },
        include: {
          customer: true,
          machine: true
        }
      });

      if (!serviceRecord) {
        return res.status(404).json({
          error: 'Service record not found',
          message: `Service record with ID ${serviceRecordId} not found`
        });
      }

      // Validate assigned user exists (if provided)
      if (assignedToId) {
        const assignedUser = await prisma.user.findUnique({
          where: { id: assignedToId }
        });

        if (!assignedUser) {
          return res.status(404).json({
            error: 'Assigned user not found',
            message: `User with ID ${assignedToId} not found`
          });
        }
      }

      // Validate priority
      const validPriorities = ['HIGH', 'MEDIUM', 'LOW'];
      if (priority && !validPriorities.includes(priority)) {
        return res.status(400).json({
          error: 'Invalid priority',
          validPriorities
        });
      }

      // Create point
      const point = await prisma.point.create({
        data: {
          serviceRecordId,
          title,
          description,
          priority: priority || 'MEDIUM',
          assignedToId,
          createdById: currentUser.id,
          dueDate: dueDate ? new Date(dueDate) : null
        },
        include: {
          assignedTo: {
            select: {
              id: true,
              name: true,
              role: true
            }
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              role: true
            }
          },
          serviceRecord: {
            include: {
              customer: true,
              machine: true
            }
          }
        }
      });

      // Send assignment notification if point is assigned
      if (assignedToId) {
        await notificationService.sendPointAssignmentNotification(point, assignedToId);
      }

      res.status(201).json({
        message: 'Point created successfully',
        point
      });

    } catch (error) {
      console.error('Error creating point:', error);
      res.status(500).json({
        error: 'Failed to create point',
        message: error.message
      });
    }
  }

  // Get all points
  async getAllPoints(req, res) {
    try {
      const {
        serviceRecordId,
        assignedToId,
        createdById,
        status,
        priority,
        page = 1,
        limit = 20
      } = req.query;
      const skip = (page - 1) * limit;

      const where = {};
      if (serviceRecordId) where.serviceRecordId = serviceRecordId;
      if (assignedToId) where.assignedToId = assignedToId;
      if (createdById) where.createdById = createdById;
      if (status) where.status = status;
      if (priority) where.priority = priority;

      const [points, total] = await Promise.all([
        prisma.point.findMany({
          where,
          skip: parseInt(skip),
          take: parseInt(limit),
          orderBy: [
            { priority: 'desc' },
            { createdAt: 'desc' }
          ],
          include: {
            assignedTo: {
              select: {
                id: true,
                name: true,
                role: true
              }
            },
            createdBy: {
              select: {
                id: true,
                name: true,
                role: true
              }
            },
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
        prisma.point.count({ where })
      ]);

      res.json({
        message: 'Points retrieved successfully',
        points,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      console.error('Error fetching points:', error);
      res.status(500).json({
        error: 'Failed to fetch points',
        message: error.message
      });
    }
  }

  // Get point by ID
  async getPointById(req, res) {
    try {
      const { id } = req.params;

      const point = await prisma.point.findUnique({
        where: { id },
        include: {
          assignedTo: {
            select: {
              id: true,
              name: true,
              role: true,
              phone: true,
              email: true
            }
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              role: true
            }
          },
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

      if (!point) {
        return res.status(404).json({
          error: 'Point not found',
          message: `Point with ID ${id} not found`
        });
      }

      res.json({
        message: 'Point retrieved successfully',
        point
      });

    } catch (error) {
      console.error('Error fetching point:', error);
      res.status(500).json({
        error: 'Failed to fetch point',
        message: error.message
      });
    }
  }

  // Update point (Step 7 - Resolution/Delegation)
  async updatePoint(req, res) {
    try {
      const { id } = req.params;
      const { title, description, status, priority, assignedToId, dueDate } = req.body;
      const currentUser = req.user;

      // Check if point exists
      const existingPoint = await prisma.point.findUnique({
        where: { id },
        include: {
          serviceRecord: {
            include: {
              customer: true,
              machine: true
            }
          },
          assignedTo: true
        }
      });

      if (!existingPoint) {
        return res.status(404).json({
          error: 'Point not found',
          message: `Point with ID ${id} not found`
        });
      }

      // Check permissions
      const canUpdate = canManagePoints(currentUser.role) ||
        existingPoint.assignedToId === currentUser.id ||
        existingPoint.createdById === currentUser.id;

      if (!canUpdate) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You can only update points assigned to you or created by you'
        });
      }

      // Validate assigned user exists (if changing assignment)
      if (assignedToId && assignedToId !== existingPoint.assignedToId) {
        const assignedUser = await prisma.user.findUnique({
          where: { id: assignedToId }
        });

        if (!assignedUser) {
          return res.status(404).json({
            error: 'Assigned user not found',
            message: `User with ID ${assignedToId} not found`
          });
        }
      }

      // Validate status
      const validStatuses = ['CREATED', 'ASSIGNED', 'REASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED'];
      if (status && !validStatuses.includes(status)) {
        return res.status(400).json({
          error: 'Invalid status',
          validStatuses
        });
      }

      // Validate priority
      const validPriorities = ['HIGH', 'MEDIUM', 'LOW'];
      if (priority && !validPriorities.includes(priority)) {
        return res.status(400).json({
          error: 'Invalid priority',
          validPriorities
        });
      }

      // Prepare update data
      const updateData = {};
      if (title) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (status) {
        updateData.status = status;
        if (status === 'COMPLETED') {
          updateData.completedAt = new Date();
        }
      }
      if (priority) updateData.priority = priority;
      if (assignedToId !== undefined) updateData.assignedToId = assignedToId;
      if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;

      // Update point
      const point = await prisma.point.update({
        where: { id },
        data: updateData,
        include: {
          assignedTo: {
            select: {
              id: true,
              name: true,
              role: true
            }
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              role: true
            }
          },
          serviceRecord: {
            include: {
              customer: true,
              machine: true
            }
          }
        }
      });

      // Send notification for assignment changes
      if (assignedToId && assignedToId !== existingPoint.assignedToId) {
        const notificationStatus = existingPoint.assignedToId ? 'REASSIGNED' : 'ASSIGNED';
        await notificationService.sendPointAssignmentNotification(
          { ...point, status: notificationStatus },
          assignedToId
        );
      }

      res.json({
        message: 'Point updated successfully',
        point
      });

    } catch (error) {
      console.error('Error updating point:', error);
      res.status(500).json({
        error: 'Failed to update point',
        message: error.message
      });
    }
  }

  // Delete point
  async deletePoint(req, res) {
    try {
      const { id } = req.params;
      const currentUser = req.user;

      // Check if point exists
      const existingPoint = await prisma.point.findUnique({
        where: { id }
      });

      if (!existingPoint) {
        return res.status(404).json({
          error: 'Point not found',
          message: `Point with ID ${id} not found`
        });
      }

      // Only admin, service head, or the creator can delete points
      const canDelete = ['ADMIN', 'SERVICE_HEAD'].includes(currentUser.role) ||
        existingPoint.createdById === currentUser.id;

      if (!canDelete) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'Only Admin, Service Head, or the point creator can delete points'
        });
      }

      // Delete point
      await prisma.point.delete({
        where: { id }
      });

      res.json({
        message: 'Point deleted successfully'
      });

    } catch (error) {
      console.error('Error deleting point:', error);
      res.status(500).json({
        error: 'Failed to delete point',
        message: error.message
      });
    }
  }

  // Get points by service record
  async getPointsByServiceRecord(req, res) {
    try {
      const { serviceRecordId } = req.params;
      const { status } = req.query;

      // Validate service record exists
      const serviceRecord = await prisma.serviceRecord.findUnique({
        where: { id: serviceRecordId }
      });

      if (!serviceRecord) {
        return res.status(404).json({
          error: 'Service record not found',
          message: `Service record with ID ${serviceRecordId} not found`
        });
      }

      const where = { serviceRecordId };
      if (status) where.status = status;

      const points = await prisma.point.findMany({
        where,
        include: {
          assignedTo: {
            select: {
              id: true,
              name: true,
              role: true
            }
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              role: true
            }
          }
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' }
        ]
      });

      // Count points by status
      const statusCounts = await prisma.point.groupBy({
        by: ['status'],
        where: { serviceRecordId },
        _count: { status: true }
      });

      res.json({
        message: 'Points retrieved successfully',
        count: points.length,
        points,
        statusCounts: statusCounts.reduce((acc, item) => {
          acc[item.status] = item._count.status;
          return acc;
        }, {})
      });

    } catch (error) {
      console.error('Error fetching points by service record:', error);
      res.status(500).json({
        error: 'Failed to fetch points',
        message: error.message
      });
    }
  }

  // Get my assigned points
  async getMyPoints(req, res) {
    try {
      const currentUser = req.user;
      const { status, priority, page = 1, limit = 20 } = req.query;
      const skip = (page - 1) * limit;

      const where = { assignedToId: currentUser.id };

      if (status == 'OPEN') {
        where.OR = [
          { status: { not: 'COMPLETED' } },
          { status: { not : 'CLOSED'} }
        ]
      }

      if(status == 'completed') {
        where.OR =[
          { status: 'COMPLETED' },
          { status: 'CLOSED'}
        ]
      }


      if (priority) where.priority = priority;

      const [points, total] = await Promise.all([
        prisma.point.findMany({
          where,
          skip: parseInt(skip),
          take: parseInt(limit),
          orderBy: [
            { priority: 'desc' },
            { dueDate: 'asc' },
            { createdAt: 'desc' }
          ],
          include: {
            createdBy: {
              select: {
                id: true,
                name: true,
                role: true
              }
            },
            serviceRecord: {
              include: {
                customer: {
                  select: {
                    id: true,
                    uid: true,
                    name: true,
                    phone: true
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
        prisma.point.count({ where })
      ]);

      res.json({
        message: 'My assigned points retrieved successfully',
        points,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      console.error('Error fetching my points:', error);
      res.status(500).json({
        error: 'Failed to fetch points',
        message: error.message
      });
    }
  }

  // Check for escalation (Step 6)
  async checkEscalation(req, res) {
    try {
      const { serviceRecordId } = req.params;
      const { timeFrameHours = 72 } = req.query; // Default 72 hours

      // Validate service record exists
      const serviceRecord = await prisma.serviceRecord.findUnique({
        where: { id: serviceRecordId },
        include: {
          customer: true,
          machine: true
        }
      });

      if (!serviceRecord) {
        return res.status(404).json({
          error: 'Service record not found',
          message: `Service record with ID ${serviceRecordId} not found`
        });
      }

      // Get open points older than time frame
      const timeFrameAgo = new Date();
      timeFrameAgo.setHours(timeFrameAgo.getHours() - parseInt(timeFrameHours));

      const openPoints = await prisma.point.findMany({
        where: {
          serviceRecordId,
          status: { notIn: ['COMPLETED', 'CLOSED'] },
          createdAt: { lt: timeFrameAgo }
        },
        include: {
          assignedTo: {
            select: {
              id: true,
              name: true,
              role: true
            }
          }
        }
      });

      if (openPoints.length > 0) {
        // Send escalation notification
        await notificationService.sendEscalationNotification(serviceRecord, openPoints);

        res.json({
          message: 'Escalation required',
          escalationRequired: true,
          openPointsCount: openPoints.length,
          timeFrameHours: parseInt(timeFrameHours),
          openPoints
        });
      } else {
        res.json({
          message: 'No escalation required',
          escalationRequired: false,
          openPointsCount: 0
        });
      }

    } catch (error) {
      console.error('Error checking escalation:', error);
      res.status(500).json({
        error: 'Failed to check escalation',
        message: error.message
      });
    }
  }

  // Get points statistics
  async getPointsStatistics(req, res) {
    try {
      const currentUser = req.user;

      // Base statistics
      const [
        totalPoints,
        myAssignedPoints,
        highPriorityPoints,
        overduePoints,
        statusCounts
      ] = await Promise.all([
        prisma.point.count(),
        prisma.point.count({ where: { assignedToId: currentUser.id } }),
        prisma.point.count({
          where: {
            priority: 'HIGH',
            status: { notIn: ['COMPLETED', 'CLOSED'] }
          }
        }),
        prisma.point.count({
          where: {
            dueDate: { lt: new Date() },
            status: { notIn: ['COMPLETED', 'CLOSED'] }
          }
        }),
        prisma.point.groupBy({
          by: ['status'],
          _count: { status: true }
        })
      ]);

      const statistics = {
        totalPoints,
        myAssignedPoints,
        highPriorityPoints,
        overduePoints,
        statusCounts: statusCounts.reduce((acc, item) => {
          acc[item.status] = item._count.status;
          return acc;
        }, {})
      };

      res.json({
        message: 'Points statistics retrieved successfully',
        statistics
      });

    } catch (error) {
      console.error('Error fetching points statistics:', error);
      res.status(500).json({
        error: 'Failed to fetch points statistics',
        message: error.message
      });
    }
  }
}

module.exports = new PointController();