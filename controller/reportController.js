const prisma = require('../config/database');
const notificationService = require('../config/notificationService');
const { canUpdateReport } = require('../config/auth');

class ReportController {

  // Create/Submit report (Step 4)
  async createReport(req, res) {
    try {
      const { serviceRecordId, reportData, scanData, manualUrl, eDrawingsUrl } = req.body;
      const currentUser = req.user;

      // Check if current user can update reports
      if (!canUpdateReport(currentUser.role)) {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'Only Admin, Service Head, or Engineer can create reports'
        });
      }

      // Validate required fields
      if (!serviceRecordId) {
        return res.status(400).json({ 
          error: 'Missing required fields',
          required: ['serviceRecordId']
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

      // Create report
      const report = await prisma.report.create({
        data: {
          serviceRecordId,
          engineerId: currentUser.id,
          reportData: reportData || {},
          scanData: scanData || {},
          manualUrl,
          eDrawingsUrl
        },
        include: {
          engineer: {
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

      // Send notification to Management, Service Head, Sales, and Commercial (Step 5)
      await notificationService.sendReportSubmissionNotification(serviceRecord, reportData);

      res.status(201).json({
        message: 'Report created successfully',
        report
      });

    } catch (error) {
      console.error('Error creating report:', error);
      res.status(500).json({ 
        error: 'Failed to create report',
        message: error.message
      });
    }
  }

  // Get all reports
  async getAllReports(req, res) {
    try {
      const { serviceRecordId, engineerId, page = 1, limit = 20 } = req.query;
      const skip = (page - 1) * limit;

      const where = {};
      if (serviceRecordId) where.serviceRecordId = serviceRecordId;
      if (engineerId) where.engineerId = engineerId;

      const [reports, total] = await Promise.all([
        prisma.report.findMany({
          where,
          skip: parseInt(skip),
          take: parseInt(limit),
          orderBy: { createdAt: 'desc' },
          include: {
            engineer: {
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
        prisma.report.count({ where })
      ]);

      res.json({
        message: 'Reports retrieved successfully',
        reports,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      console.error('Error fetching reports:', error);
      res.status(500).json({ 
        error: 'Failed to fetch reports',
        message: error.message
      });
    }
  }

  // Get report by ID
  async getReportById(req, res) {
    try {
      const { id } = req.params;

      const report = await prisma.report.findUnique({
        where: { id },
        include: {
          engineer: {
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
              points: {
                where: {
                  status: { not: 'COMPLETED' }
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
              }
            }
          }
        }
      });

      if (!report) {
        return res.status(404).json({ 
          error: 'Report not found',
          message: `Report with ID ${id} not found`
        });
      }

      res.json({
        message: 'Report retrieved successfully',
        report
      });

    } catch (error) {
      console.error('Error fetching report:', error);
      res.status(500).json({ 
        error: 'Failed to fetch report',
        message: error.message
      });
    }
  }

  // Upload and attach a manual or e-drawing to a report
  async uploadReportAsset(req, res) {
    try {
      const { id, type } = req.params; // type: 'manual' | 'edrawings'
      const currentUser = req.user;

      const allowedTypes = ['manual', 'edrawings'];
      if (!allowedTypes.includes(type)) {
        return res.status(400).json({
          error: 'Invalid upload type',
          message: `Type must be one of: ${allowedTypes.join(', ')}`
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: 'No file uploaded',
          message: "Expecting form-data with field name 'file'"
        });
      }

      // Fetch and validate report
      const report = await prisma.report.findUnique({ where: { id } });
      if (!report) {
        return res.status(404).json({
          error: 'Report not found',
          message: `Report with ID ${id} not found`
        });
      }

      // Permission: engineers may only update their own reports
      if (currentUser.role === 'ENGINEER' && report.engineerId !== currentUser.id) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'Engineers can only update their own reports'
        });
      }

      // Build URL based on mapped folder
      const folder = type === 'manual' ? 'manuals' : 'drawings';
      const fileUrl = `/uploads/${folder}/${req.file.filename}`;

      // Update the report record
      const updated = await prisma.report.update({
        where: { id },
        data: type === 'manual' ? { manualUrl: fileUrl } : { eDrawingsUrl: fileUrl },
        include: {
          engineer: { select: { id: true, name: true, role: true } },
          serviceRecord: true,
        },
      });

      return res.json({
        message: `${type === 'manual' ? 'Manual' : 'E-drawing'} uploaded and attached successfully`,
        fileUrl,
        report: updated,
      });
    } catch (error) {
      console.error('Error uploading report asset:', error);
      res.status(500).json({
        error: 'Failed to upload report asset',
        message: error.message,
      });
    }
  }

  // Update report (Step 9 - Follow-up)
  async updateReport(req, res) {
    try {
      const { id } = req.params;
      const { reportData, scanData, manualUrl, eDrawingsUrl } = req.body;
      const currentUser = req.user;

      // Check if current user can update reports
      if (!canUpdateReport(currentUser.role)) {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'Only Admin, Service Head, or Engineer can update reports'
        });
      }

      // Check if report exists
      const existingReport = await prisma.report.findUnique({
        where: { id },
        include: {
          serviceRecord: {
            include: {
              customer: true,
              machine: true
            }
          }
        }
      });

      if (!existingReport) {
        return res.status(404).json({ 
          error: 'Report not found',
          message: `Report with ID ${id} not found`
        });
      }

      // Engineers can only update their own reports (unless admin/service head)
      if (currentUser.role === 'ENGINEER' && existingReport.engineerId !== currentUser.id) {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'Engineers can only update their own reports'
        });
      }

      // Prepare update data
      const updateData = {};
      if (reportData) updateData.reportData = reportData;
      if (scanData) updateData.scanData = scanData;
      if (manualUrl !== undefined) updateData.manualUrl = manualUrl;
      if (eDrawingsUrl !== undefined) updateData.eDrawingsUrl = eDrawingsUrl;

      // Update report
      const report = await prisma.report.update({
        where: { id },
        data: updateData,
        include: {
          engineer: {
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

      // Send follow-up notification
      await notificationService.sendReportSubmissionNotification(
        existingReport.serviceRecord, 
        reportData || existingReport.reportData
      );

      res.json({
        message: 'Report updated successfully',
        report
      });

    } catch (error) {
      console.error('Error updating report:', error);
      res.status(500).json({ 
        error: 'Failed to update report',
        message: error.message
      });
    }
  }

  // Delete report
  async deleteReport(req, res) {
    try {
      const { id } = req.params;
      const currentUser = req.user;

      // Check if report exists
      const existingReport = await prisma.report.findUnique({
        where: { id }
      });

      if (!existingReport) {
        return res.status(404).json({ 
          error: 'Report not found',
          message: `Report with ID ${id} not found`
        });
      }

      // Only admin, service head, or the engineer who created the report can delete it
      if (currentUser.role === 'ENGINEER' && existingReport.engineerId !== currentUser.id) {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'Engineers can only delete their own reports'
        });
      }

      if (!['ADMIN', 'SERVICE_HEAD', 'ENGINEER'].includes(currentUser.role)) {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'Only Admin, Service Head, or Engineer can delete reports'
        });
      }

      // Delete report
      await prisma.report.delete({
        where: { id }
      });

      res.json({
        message: 'Report deleted successfully'
      });

    } catch (error) {
      console.error('Error deleting report:', error);
      res.status(500).json({ 
        error: 'Failed to delete report',
        message: error.message
      });
    }
  }

  // Get reports by service record
  async getReportsByServiceRecord(req, res) {
    try {
      const { serviceRecordId } = req.params;

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

      const reports = await prisma.report.findMany({
        where: { serviceRecordId },
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
      });

      res.json({
        message: 'Reports retrieved successfully',
        count: reports.length,
        reports
      });

    } catch (error) {
      console.error('Error fetching reports by service record:', error);
      res.status(500).json({ 
        error: 'Failed to fetch reports',
        message: error.message
      });
    }
  }

  // Get reports by engineer
  async getReportsByEngineer(req, res) {
    try {
      const { engineerId } = req.params;
      const { page = 1, limit = 20 } = req.query;
      const skip = (page - 1) * limit;

      // Validate engineer exists
      const engineer = await prisma.user.findUnique({
        where: { id: engineerId }
      });

      if (!engineer) {
        return res.status(404).json({ 
          error: 'Engineer not found',
          message: `Engineer with ID ${engineerId} not found`
        });
      }

      const [reports, total] = await Promise.all([
        prisma.report.findMany({
          where: { engineerId },
          skip: parseInt(skip),
          take: parseInt(limit),
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
          },
          orderBy: { createdAt: 'desc' }
        }),
        prisma.report.count({ where: { engineerId } })
      ]);

      res.json({
        message: 'Engineer reports retrieved successfully',
        reports,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      console.error('Error fetching reports by engineer:', error);
      res.status(500).json({ 
        error: 'Failed to fetch reports',
        message: error.message
      });
    }
  }

  // Upload file for report (helper method for file uploads)
  async uploadFile(req, res) {
    try {
      const { type } = req.params; // 'manual' | 'edrawings' | 'general'
      const allowedTypes = ['manual', 'edrawings', 'general'];
      if (!allowedTypes.includes(type)) {
        return res.status(400).json({
          error: 'Invalid upload type',
          message: `Type must be one of: ${allowedTypes.join(', ')}`
        });
      }
      
      if (!req.file) {
        return res.status(400).json({ 
          error: 'No file uploaded'
        });
      }

      // Map type to folder used in storage config
      const folder = type === 'manual' ? 'manuals' : type === 'edrawings' ? 'drawings' : 'general';

      // Here you would typically upload to cloud storage (AWS S3, Google Cloud, etc.)
      // For now, we return the local static URL that is served by Express
      const fileUrl = `/uploads/${folder}/${req.file.filename}`;

      res.json({
        message: 'File uploaded successfully',
        fileUrl,
        fileName: req.file.originalname,
        fileSize: req.file.size
      });

    } catch (error) {
      console.error('Error uploading file:', error);
      res.status(500).json({ 
        error: 'Failed to upload file',
        message: error.message
      });
    }
  }
}

module.exports = new ReportController();