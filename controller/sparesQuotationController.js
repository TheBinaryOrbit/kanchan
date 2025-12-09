const prisma = require('../config/database');

class SparesQuotationController {

  // Create spares quotation (Step 11)
  async createSparesQuotation(req, res) {
    try {
      const { customerName, machineInfo, partDetails, quotationAmount, notes } = req.body;

      // Validate required fields
      if (!customerName || !machineInfo || !partDetails) {
        return res.status(400).json({ 
          error: 'Missing required fields',
          required: ['customerName', 'machineInfo', 'partDetails']
        });
      }

      // Validate partDetails is an array or object
      if (typeof partDetails !== 'object') {
        return res.status(400).json({ 
          error: 'Invalid part details format',
          message: 'partDetails must be an object or array containing spare part information'
        });
      }

      // Create spares quotation
      const sparesQuotation = await prisma.sparesQuotation.create({
        data: {
          customerName,
          machineInfo,
          partDetails,
          quotationAmount: quotationAmount ? parseFloat(quotationAmount) : null,
          notes
        }
      });

      res.status(201).json({
        message: 'Spares quotation created successfully',
        sparesQuotation
      });

    } catch (error) {
      console.error('Error creating spares quotation:', error);
      res.status(500).json({ 
        error: 'Failed to create spares quotation',
        message: error.message
      });
    }
  }

  // Get all spares quotations
  async getAllSparesQuotations(req, res) {
    try {
      const { status, search, page = 1, limit = 20 } = req.query;
      const skip = (page - 1) * limit;

      const where = {};
      if (status) where.status = status;
      
      if (search) {
        where.OR = [
          { customerName: { contains: search, mode: 'insensitive' } },
          { machineInfo: { contains: search, mode: 'insensitive' } },
          { notes: { contains: search, mode: 'insensitive' } }
        ];
      }

      const [quotations, total] = await Promise.all([
        prisma.sparesQuotation.findMany({
          where,
          skip: parseInt(skip),
          take: parseInt(limit),
          orderBy: { createdAt: 'desc' }
        }),
        prisma.sparesQuotation.count({ where })
      ]);

      res.json({
        message: 'Spares quotations retrieved successfully',
        quotations,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      console.error('Error fetching spares quotations:', error);
      res.status(500).json({ 
        error: 'Failed to fetch spares quotations',
        message: error.message
      });
    }
  }

  // Get spares quotation by ID
  async getSparesQuotationById(req, res) {
    try {
      const { id } = req.params;

      const quotation = await prisma.sparesQuotation.findUnique({
        where: { id }
      });

      if (!quotation) {
        return res.status(404).json({ 
          error: 'Spares quotation not found',
          message: `Spares quotation with ID ${id} not found`
        });
      }

      res.json({
        message: 'Spares quotation retrieved successfully',
        quotation
      });

    } catch (error) {
      console.error('Error fetching spares quotation:', error);
      res.status(500).json({ 
        error: 'Failed to fetch spares quotation',
        message: error.message
      });
    }
  }

  // Update spares quotation
  async updateSparesQuotation(req, res) {
    try {
      const { id } = req.params;
      const { customerName, machineInfo, partDetails, status, quotationAmount, notes } = req.body;
      const currentUser = req.user;

      // Check if quotation exists
      const existingQuotation = await prisma.sparesQuotation.findUnique({
        where: { id }
      });

      if (!existingQuotation) {
        return res.status(404).json({ 
          error: 'Spares quotation not found',
          message: `Spares quotation with ID ${id} not found`
        });
      }

      // Validate status if provided
      const validStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'];
      if (status && !validStatuses.includes(status)) {
        return res.status(400).json({ 
          error: 'Invalid status',
          validStatuses
        });
      }

      // Prepare update data
      const updateData = {};
      if (customerName) updateData.customerName = customerName;
      if (machineInfo) updateData.machineInfo = machineInfo;
      if (partDetails) updateData.partDetails = partDetails;
      if (status) updateData.status = status;
      if (quotationAmount !== undefined) updateData.quotationAmount = quotationAmount ? parseFloat(quotationAmount) : null;
      if (notes !== undefined) updateData.notes = notes;

      // Update quotation
      const quotation = await prisma.sparesQuotation.update({
        where: { id },
        data: updateData
      });

      res.json({
        message: 'Spares quotation updated successfully',
        quotation
      });

    } catch (error) {
      console.error('Error updating spares quotation:', error);
      res.status(500).json({ 
        error: 'Failed to update spares quotation',
        message: error.message
      });
    }
  }

  // Delete spares quotation
  async deleteSparesQuotation(req, res) {
    try {
      const { id } = req.params;
      const currentUser = req.user;

      // Only Admin or Service Head can delete quotations
      if (!['ADMIN', 'SERVICE_HEAD'].includes(currentUser.role)) {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'Only Admin or Service Head can delete spares quotations'
        });
      }

      // Check if quotation exists
      const existingQuotation = await prisma.sparesQuotation.findUnique({
        where: { id }
      });

      if (!existingQuotation) {
        return res.status(404).json({ 
          error: 'Spares quotation not found',
          message: `Spares quotation with ID ${id} not found`
        });
      }

      // Delete quotation
      await prisma.sparesQuotation.delete({
        where: { id }
      });

      res.json({
        message: 'Spares quotation deleted successfully'
      });

    } catch (error) {
      console.error('Error deleting spares quotation:', error);
      res.status(500).json({ 
        error: 'Failed to delete spares quotation',
        message: error.message
      });
    }
  }

  // Search spares quotations by customer or machine
  async searchSparesQuotations(req, res) {
    try {
      const { query } = req.query;

      if (!query) {
        return res.status(400).json({ 
          error: 'Search query required'
        });
      }

      const quotations = await prisma.sparesQuotation.findMany({
        where: {
          OR: [
            { customerName: { contains: query, mode: 'insensitive' } },
            { machineInfo: { contains: query, mode: 'insensitive' } }
          ]
        },
        orderBy: { createdAt: 'desc' },
        take: 20
      });

      res.json({
        message: 'Search results retrieved successfully',
        count: quotations.length,
        quotations
      });

    } catch (error) {
      console.error('Error searching spares quotations:', error);
      res.status(500).json({ 
        error: 'Failed to search spares quotations',
        message: error.message
      });
    }
  }

  // Get quotations by status
  async getQuotationsByStatus(req, res) {
    try {
      const { status } = req.params;

      const validStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ 
          error: 'Invalid status',
          validStatuses
        });
      }

      const quotations = await prisma.sparesQuotation.findMany({
        where: { status },
        orderBy: { createdAt: 'desc' }
      });

      res.json({
        message: `${status} quotations retrieved successfully`,
        count: quotations.length,
        quotations
      });

    } catch (error) {
      console.error('Error fetching quotations by status:', error);
      res.status(500).json({ 
        error: 'Failed to fetch quotations',
        message: error.message
      });
    }
  }

  // Get spares quotation statistics
  async getSparesQuotationStatistics(req, res) {
    try {
      const [
        totalQuotations,
        pendingQuotations,
        approvedQuotations,
        rejectedQuotations,
        completedQuotations,
        totalQuotationValue,
        statusCounts
      ] = await Promise.all([
        prisma.sparesQuotation.count(),
        prisma.sparesQuotation.count({ where: { status: 'PENDING' } }),
        prisma.sparesQuotation.count({ where: { status: 'APPROVED' } }),
        prisma.sparesQuotation.count({ where: { status: 'REJECTED' } }),
        prisma.sparesQuotation.count({ where: { status: 'COMPLETED' } }),
        prisma.sparesQuotation.aggregate({
          where: { 
            status: { in: ['APPROVED', 'COMPLETED'] },
            quotationAmount: { not: null }
          },
          _sum: { quotationAmount: true }
        }),
        prisma.sparesQuotation.groupBy({
          by: ['status'],
          _count: { status: true }
        })
      ]);

      const statistics = {
        totalQuotations,
        pendingQuotations,
        approvedQuotations,
        rejectedQuotations,
        completedQuotations,
        totalQuotationValue: totalQuotationValue._sum.quotationAmount || 0,
        statusCounts: statusCounts.reduce((acc, item) => {
          acc[item.status] = item._count.status;
          return acc;
        }, {})
      };

      res.json({
        message: 'Spares quotation statistics retrieved successfully',
        statistics
      });

    } catch (error) {
      console.error('Error fetching spares quotation statistics:', error);
      res.status(500).json({ 
        error: 'Failed to fetch statistics',
        message: error.message
      });
    }
  }

  // Approve quotation
  async approveQuotation(req, res) {
    try {
      const { id } = req.params;
      const { quotationAmount, notes } = req.body;
      const currentUser = req.user;

      // Check permissions
      if (!['ADMIN', 'SERVICE_HEAD', 'SALES'].includes(currentUser.role)) {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'Only Admin, Service Head, or Sales can approve quotations'
        });
      }

      // Check if quotation exists
      const existingQuotation = await prisma.sparesQuotation.findUnique({
        where: { id }
      });

      if (!existingQuotation) {
        return res.status(404).json({ 
          error: 'Spares quotation not found',
          message: `Spares quotation with ID ${id} not found`
        });
      }

      // Update quotation
      const updateData = { 
        status: 'APPROVED' 
      };
      
      if (quotationAmount) updateData.quotationAmount = parseFloat(quotationAmount);
      if (notes) updateData.notes = notes;

      const quotation = await prisma.sparesQuotation.update({
        where: { id },
        data: updateData
      });

      res.json({
        message: 'Spares quotation approved successfully',
        quotation
      });

    } catch (error) {
      console.error('Error approving spares quotation:', error);
      res.status(500).json({ 
        error: 'Failed to approve quotation',
        message: error.message
      });
    }
  }

  // Reject quotation
  async rejectQuotation(req, res) {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      const currentUser = req.user;

      // Check permissions
      if (!['ADMIN', 'SERVICE_HEAD', 'SALES'].includes(currentUser.role)) {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'Only Admin, Service Head, or Sales can reject quotations'
        });
      }

      // Check if quotation exists
      const existingQuotation = await prisma.sparesQuotation.findUnique({
        where: { id }
      });

      if (!existingQuotation) {
        return res.status(404).json({ 
          error: 'Spares quotation not found',
          message: `Spares quotation with ID ${id} not found`
        });
      }

      // Update quotation
      const updateData = { 
        status: 'REJECTED' 
      };
      
      if (notes) updateData.notes = notes;

      const quotation = await prisma.sparesQuotation.update({
        where: { id },
        data: updateData
      });

      res.json({
        message: 'Spares quotation rejected successfully',
        quotation
      });

    } catch (error) {
      console.error('Error rejecting spares quotation:', error);
      res.status(500).json({ 
        error: 'Failed to reject quotation',
        message: error.message
      });
    }
  }
}

module.exports = new SparesQuotationController();