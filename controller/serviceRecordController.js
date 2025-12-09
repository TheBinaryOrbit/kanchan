const prisma = require('../config/database');
const notificationService = require('../config/notificationService');
const { canCreateServiceRecord } = require('../config/auth');

class ServiceRecordController {

  // Create service record (Step 1)
  async createServiceRecord(req, res) {
    try {
      const { customerId, machineId, purchaseDate, pendingAmount, kpis } = req.body;
      const currentUser = req.user;

      // Check if current user can create service records
      if (!canCreateServiceRecord(currentUser.role)) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'Only Admin, Service Head, or Engineer can create service records'
        });
      }

      // Validate required fields
      if (!customerId || !machineId || !purchaseDate) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['customerId', 'machineId', 'purchaseDate']
        });
      }

      // Validate customer exists
      const customer = await prisma.customer.findUnique({
        where: { id: customerId }
      });

      if (!customer) {
        return res.status(404).json({
          error: 'Customer not found',
          message: `Customer with ID ${customerId} not found`
        });
      }

      // Validate machine exists
      const machine = await prisma.machine.findUnique({
        where: { id: machineId }
      });

      if (!machine) {
        return res.status(404).json({
          error: 'Machine not found',
          message: `Machine with ID ${machineId} not found`
        });
      }

      // Calculate warranty expiry date
      const purchaseDateObj = new Date(purchaseDate);
      const warrantyExpiresAt = new Date(purchaseDateObj);
      warrantyExpiresAt.setMonth(warrantyExpiresAt.getMonth() + machine.warrantyTimeInMonths);

      // Create service record
      const serviceRecord = await prisma.serviceRecord.create({
        data: {
          customerId,
          machineId,
          purchaseDate: purchaseDateObj,
          warrantyExpiresAt,
          pendingAmount: pendingAmount || 0,
          kpis: kpis || {},
          createdById: currentUser.id
        },
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
      });

      // Send notification to Management, Service Head, Sales, and Commercial (Step 2)
      await notificationService.sendInstallationNotification(serviceRecord);

      // Send pending payment notification if applicable
      if (serviceRecord.pendingAmount > 0) {
        await notificationService.sendPendingPaymentNotification(serviceRecord);
      }

      res.status(201).json({
        message: 'Service record created successfully',
        serviceRecord
      });

    } catch (error) {
      console.error('Error creating service record:', error);
      res.status(500).json({
        error: 'Failed to create service record',
        message: error.message
      });
    }
  }

  // Get all service records
  async getAllServiceRecords(req, res) {
    try {
      const { status, customerId, machineId, engineerId, page = 1, limit = 20 } = req.query;
      const skip = (page - 1) * limit;

      const where = {};
      if (status) where.status = status;
      if (customerId) where.customerId = customerId;
      if (machineId) where.machineId = machineId;
      if (engineerId) where.createdById = engineerId;

      const [serviceRecords, total] = await Promise.all([
        prisma.serviceRecord.findMany({
          where,
          skip: parseInt(skip),
          take: parseInt(limit),
          orderBy: { createdAt: 'desc' },
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
                brand: true,
                serialNumber: true
              }
            },
            createdBy: {
              select: {
                id: true,
                name: true,
                role: true
              }
            },
            _count: {
              select: {
                reports: true,
                points: true
              }
            }
          }
        }),
        prisma.serviceRecord.count({ where })
      ]);

      // Calculate warranty status
      const now = new Date();
      const enrichedRecords = serviceRecords.map(record => ({
        ...record,
        warrantyStatus: record.warrantyExpiresAt > now ? 'ACTIVE' : 'EXPIRED',
        warrantyDaysRemaining: Math.max(0, Math.ceil((record.warrantyExpiresAt - now) / (1000 * 60 * 60 * 24))),
        hasPendingAmount: record.pendingAmount > 0
      }));

      res.json({
        message: 'Service records retrieved successfully',
        serviceRecords: enrichedRecords,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      console.error('Error fetching service records:', error);
      res.status(500).json({
        error: 'Failed to fetch service records',
        message: error.message
      });
    }
  }

  // Get service record by ID
  async getServiceRecordById(req, res) {
    try {
      const { id } = req.params;

      const serviceRecord = await prisma.serviceRecord.findUnique({
        where: { id },
        include: {
          customer: true,
          machine: true,
          createdBy: {
            select: {
              id: true,
              name: true,
              role: true
            }
          },
          reports: {
            include: {
              engineer: {
                select: {
                  id: true,
                  name: true,
                  role: true
                }
              }
            },
            orderBy: { createdAt: 'desc' }
          },
          points: {
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
            orderBy: { createdAt: 'desc' }
          },
          notifications: {
            orderBy: { createdAt: 'desc' },
            take: 10
          }
        }
      });

      if (!serviceRecord) {
        return res.status(404).json({
          error: 'Service record not found',
          message: `Service record with ID ${id} not found`
        });
      }

      // Calculate warranty status
      const now = new Date();
      const enrichedRecord = {
        ...serviceRecord,
        warrantyStatus: serviceRecord.warrantyExpiresAt > now ? 'ACTIVE' : 'EXPIRED',
        warrantyDaysRemaining: Math.max(0, Math.ceil((serviceRecord.warrantyExpiresAt - now) / (1000 * 60 * 60 * 24))),
        hasPendingAmount: serviceRecord.pendingAmount > 0,
        openPointsCount: serviceRecord.points.filter(p => p.status !== 'COMPLETED').length
      };

      res.json({
        message: 'Service record retrieved successfully',
        serviceRecord: enrichedRecord
      });

    } catch (error) {
      console.error('Error fetching service record:', error);
      res.status(500).json({
        error: 'Failed to fetch service record',
        message: error.message
      });
    }
  }

  // Update service record (Step 3 - Sales/Commercial verification)
  async updateServiceRecord(req, res) {
    try {
      const { id } = req.params;
      const { pendingAmount, kpis, status } = req.body;
      const currentUser = req.user;

      // Check if service record exists
      const existingRecord = await prisma.serviceRecord.findUnique({
        where: { id },
        include: {
          customer: true,
          machine: true
        }
      });

      if (!existingRecord) {
        return res.status(404).json({
          error: 'Service record not found',
          message: `Service record with ID ${id} not found`
        });
      }

      // Prepare update data
      const updateData = {};
      if (pendingAmount !== undefined) updateData.pendingAmount = parseFloat(pendingAmount);
      if (kpis) updateData.kpis = kpis;
      if (status) updateData.status = status;

      // Update service record
      const serviceRecord = await prisma.serviceRecord.update({
        where: { id },
        data: updateData,
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
      });

      // Send notification if pending amount is updated
      if (pendingAmount !== undefined && pendingAmount > 0) {
        await notificationService.sendPendingPaymentNotification(serviceRecord);
      }

      res.json({
        message: 'Service record updated successfully',
        serviceRecord
      });

    } catch (error) {
      console.error('Error updating service record:', error);
      res.status(500).json({
        error: 'Failed to update service record',
        message: error.message
      });
    }
  }

  // Delete service record
  async deleteServiceRecord(req, res) {
    try {
      const { id } = req.params;
      const currentUser = req.user;

      // Only Admin or Service Head can delete service records
      if (!['ADMIN', 'SERVICE_HEAD'].includes(currentUser.role)) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'Only Admin or Service Head can delete service records'
        });
      }

      // Check if service record exists
      const existingRecord = await prisma.serviceRecord.findUnique({
        where: { id },
        include: {
          _count: {
            select : {
              reports: true,
            points: true,
            notifications: true
            }
          }
        }
      });

      if (!existingRecord) {
        return res.status(404).json({
          error: 'Service record not found',
          message: `Service record with ID ${id} not found`
        });
      }

      // Check if there are related records
      const hasRelatedRecords = existingRecord._count.reports > 0 ||
        existingRecord._count.points > 0;

      if (hasRelatedRecords) {
        return res.status(400).json({
          error: 'Cannot delete service record',
          message: 'Service record has related reports or points. Please delete them first or change status to CANCELLED.'
        });
      }

      // Delete service record
      await prisma.serviceRecord.delete({
        where: { id }
      });

      res.json({
        message: 'Service record deleted successfully'
      });

    } catch (error) {
      console.error('Error deleting service record:', error);
      res.status(500).json({
        error: 'Failed to delete service record',
        message: error.message
      });
    }
  }

  // Get warranty expiring soon
  async getWarrantyExpiringSoon(req, res) {
    try {
      const { days = 30 } = req.query;
      const now = new Date();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + parseInt(days));

      const serviceRecords = await prisma.serviceRecord.findMany({
        where: {
          warrantyExpiresAt: {
            gte: now,
            lte: futureDate
          },
          status: 'ACTIVE'
        },
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
        },
        orderBy: { warrantyExpiresAt: 'asc' }
      });

      // Calculate days remaining
      const enrichedRecords = serviceRecords.map(record => ({
        ...record,
        warrantyDaysRemaining: Math.ceil((record.warrantyExpiresAt - now) / (1000 * 60 * 60 * 24))
      }));

      res.json({
        message: 'Warranty expiring records retrieved successfully',
        count: enrichedRecords.length,
        serviceRecords: enrichedRecords
      });

    } catch (error) {
      console.error('Error fetching warranty expiring records:', error);
      res.status(500).json({
        error: 'Failed to fetch warranty expiring records',
        message: error.message
      });
    }
  }

  // Get pending amounts summary
  async getPendingAmountsSummary(req, res) {
    try {
      const pendingRecords = await prisma.serviceRecord.findMany({
        where: {
          pendingAmount: { gt: 0 },
          status: 'ACTIVE'
        },
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
              brand: true
            }
          }
        },
        orderBy: { pendingAmount: 'desc' }
      });

      const totalPending = pendingRecords.reduce((sum, record) => sum + record.pendingAmount, 0);

      res.json({
        message: 'Pending amounts summary retrieved successfully',
        totalPending,
        count: pendingRecords.length,
        serviceRecords: pendingRecords
      });

    } catch (error) {
      console.error('Error fetching pending amounts summary:', error);
      res.status(500).json({
        error: 'Failed to fetch pending amounts summary',
        message: error.message
      });
    }
  }

  // Get service statistics
  async getServiceStatistics(req, res) {
    try {
      const [
        totalRecords,
        activeRecords,
        completedRecords,
        totalPendingAmount,
        warrantyExpiringSoon,
        openPoints
      ] = await Promise.all([
        prisma.serviceRecord.count(),
        prisma.serviceRecord.count({ where: { status: 'ACTIVE' } }),
        prisma.serviceRecord.count({ where: { status: 'COMPLETED' } }),
        prisma.serviceRecord.aggregate({
          where: { status: 'ACTIVE' },
          _sum: { pendingAmount: true }
        }),
        prisma.serviceRecord.count({
          where: {
            warrantyExpiresAt: {
              gte: new Date(),
              lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            },
            status: 'ACTIVE'
          }
        }),
        prisma.point.count({
          where: {
            status: { notIn: ['COMPLETED', 'CLOSED'] }
          }
        })
      ]);

      const statistics = {
        totalRecords,
        activeRecords,
        completedRecords,
        totalPendingAmount: totalPendingAmount._sum.pendingAmount || 0,
        warrantyExpiringSoon,
        openPoints
      };

      res.json({
        message: 'Service statistics retrieved successfully',
        statistics
      });

    } catch (error) {
      console.error('Error fetching service statistics:', error);
      res.status(500).json({
        error: 'Failed to fetch service statistics',
        message: error.message
      });
    }
  }
}

module.exports = new ServiceRecordController();