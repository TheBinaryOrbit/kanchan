const prisma = require('../config/database');

class CustomerController {

  // Create customer
  async createCustomer(req, res) {
    try {
      const {name, phone, email, address } = req.body;

      // Validate required fields
      if (!name || !phone) {
        return res.status(400).json({ 
          error: 'Missing required fields',
          required: ['uid', 'name', 'phone']
        });
      }

      

      // Create customer
      const customer = await prisma.customer.create({
        data: {
          name,
          phone,
          email,
          address
        }
      });

      res.status(201).json({
        message: 'Customer created successfully',
        customer
      });

    } catch (error) {
      console.error('Error creating customer:', error);
      
      if (error.code === 'P2002') {
        return res.status(409).json({ 
          error: 'Customer already exists',
          message: 'A customer with this UID already exists'
        });
      }

      res.status(500).json({ 
        error: 'Failed to create customer',
        message: error.message
      });
    }
  }

  // Get all customers
  async getAllCustomers(req, res) {
    try {
      const { search, page = 1, limit = 20 } = req.query;
      const skip = (page - 1) * limit;

      const where = {};
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { uid: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
          { email: { contains: search, mode: 'insensitive' } }
        ];
      }

      const [customers, total] = await Promise.all([
        prisma.customer.findMany({
          where,
          skip: parseInt(skip),
          take: parseInt(limit),
          orderBy: { createdAt: 'desc' },
          include: {
            _count: {
              select: {
                serviceRecords: true
              }
            }
          }
        }),
        prisma.customer.count({ where })
      ]);

      res.json({
        message: 'Customers retrieved successfully',
        customers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      console.error('Error fetching customers:', error);
      res.status(500).json({ 
        error: 'Failed to fetch customers',
        message: error.message
      });
    }
  }

  // Get customer by ID
  async getCustomerById(req, res) {
    try {
      const { id } = req.params;

      const customer = await prisma.customer.findUnique({
        where: { id },
        include: {
          serviceRecords: {
            include: {
              machine: true,
              createdBy: {
                select: {
                  id: true,
                  name: true,
                  role: true
                }
              },
              // _count: {
              //   reports: true,
              //   points: true
              // }
            },
            orderBy: { createdAt: 'desc' }
          }
        }
      });

      if (!customer) {
        return res.status(404).json({ 
          error: 'Customer not found',
          message: `Customer with ID ${id} not found`
        });
      }

      res.json({
        message: 'Customer retrieved successfully',
        customer
      });

    } catch (error) {
      console.error('Error fetching customer:', error);
      res.status(500).json({ 
        error: 'Failed to fetch customer',
        message: error.message
      });
    }
  }

  // Get customer by UID
  async getCustomerByUid(req, res) {
    try {
      const { uid } = req.params;

      const customer = await prisma.customer.findUnique({
        where: { uid },
        include: {
          serviceRecords: {
            include: {
              machine: true,
              createdBy: {
                select: {
                  id: true,
                  name: true,
                  role: true
                }
              },
              points: {
                where: {
                  status: { not: 'COMPLETED' }
                },
                select: {
                  id: true,
                  title: true,
                  status: true,
                  priority: true
                }
              },
              _count: {
                reports: true,
                points: true
              }
            },
            orderBy: { createdAt: 'desc' }
          }
        }
      });

      if (!customer) {
        return res.status(404).json({ 
          error: 'Customer not found',
          message: `Customer with UID ${uid} not found`
        });
      }

      // Calculate warranty status for each service record
      const now = new Date();
      customer.serviceRecords.forEach(record => {
        record.warrantyStatus = record.warrantyExpiresAt > now ? 'ACTIVE' : 'EXPIRED';
        record.warrantyDaysRemaining = Math.max(0, Math.ceil((record.warrantyExpiresAt - now) / (1000 * 60 * 60 * 24)));
      });

      res.json({
        message: 'Customer retrieved successfully',
        customer
      });

    } catch (error) {
      console.error('Error fetching customer by UID:', error);
      res.status(500).json({ 
        error: 'Failed to fetch customer',
        message: error.message
      });
    }
  }

  // Update customer
  async updateCustomer(req, res) {
    try {
      const { id } = req.params;
      const { name, phone, email, address } = req.body;

      // Check if customer exists
      const existingCustomer = await prisma.customer.findUnique({
        where: { id }
      });

      if (!existingCustomer) {
        return res.status(404).json({ 
          error: 'Customer not found',
          message: `Customer with ID ${id} not found`
        });
      }

      // Prepare update data
      const updateData = {};
      if (name) updateData.name = name;
      if (phone) updateData.phone = phone;
      if (email !== undefined) updateData.email = email;
      if (address !== undefined) updateData.address = address;

      // Update customer
      const customer = await prisma.customer.update({
        where: { id },
        data: updateData
      });

      res.json({
        message: 'Customer updated successfully',
        customer
      });

    } catch (error) {
      console.error('Error updating customer:', error);
      res.status(500).json({ 
        error: 'Failed to update customer',
        message: error.message
      });
    }
  }

  // Delete customer
  async deleteCustomer(req, res) {
    try {
      const { id } = req.params;

      // Check if customer exists
      const existingCustomer = await prisma.customer.findUnique({
        where: { id },
        include: {
          serviceRecords: {
            select: {
              id: true
            }
          }
        }
      });

      if (!existingCustomer) {
        return res.status(404).json({ 
          error: 'Customer not found',
          message: `Customer with ID ${id} not found`
        });
      }

      // Get service record IDs for cascade delete
      const serviceRecordIds = existingCustomer.serviceRecords.map(sr => sr.id);

      // Use transaction to delete customer and all related data
      await prisma.$transaction(async (tx) => {
        if (serviceRecordIds.length > 0) {
          // Delete points related to service records
          await tx.point.deleteMany({
            where: {
              serviceRecordId: { in: serviceRecordIds }
            }
          });

          // Delete reports related to service records
          await tx.report.deleteMany({
            where: {
              serviceRecordId: { in: serviceRecordIds }
            }
          });

          // Delete service records
          await tx.serviceRecord.deleteMany({
            where: {
              customerId: id
            }
          });
        }

        // Delete customer
        await tx.customer.delete({
          where: { id }
        });
      });

      res.json({
        message: 'Customer and all related service records deleted successfully',
        deletedServiceRecords: serviceRecordIds.length
      });

    } catch (error) {
      console.error('Error deleting customer:', error);
      res.status(500).json({ 
        error: 'Failed to delete customer',
        message: error.message
      });
    }
  }

  // Search customers for service calls
  async searchCustomers(req, res) {
    try {
      const { query } = req.query;

      console.log('Search query:', query);

      if (!query) {
        return res.status(400).json({ 
          error: 'Search query required'
        });
      }

      // Search by name, UID, phone, or machine serial number
      const customers = await prisma.customer.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { uid: { contains: query, mode: 'insensitive' } },
            { phone: { contains: query } },
            { 
              serviceRecords: {
                some: {
                  machine: {
                    serialNumber: { contains: query, mode: 'insensitive' }
                  }
                }
              }
            }
          ]
        },
        include: {
          serviceRecords: {
            include: {
              machine: true
            },
            orderBy: { createdAt: 'desc' }
          }
        },
        take: 10
      });

      // Check warranty status and pending amounts
      const now = new Date();
      const results = customers.map(customer => {
        customer.serviceRecords.forEach(record => {
          record.warrantyStatus = record.warrantyExpiresAt > now ? 'ACTIVE' : 'EXPIRED';
          record.hasPendingAmount = record.pendingAmount > 0;
        });
        return customer;
      });

      res.json({
        message: 'Search results retrieved successfully',
        count: results.length,
        customers: results
      });

    } catch (error) {
      console.error('Error searching customers:', error);
      res.status(500).json({ 
        error: 'Failed to search customers',
        message: error.message
      });
    }
  }
}

module.exports = new CustomerController();