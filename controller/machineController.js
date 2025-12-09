const prisma = require('../config/database');

class MachineController {

  // Create machine
  async createMachine(req, res) {
    try {
      const { name, category, brand, warrantyTimeInMonths, serialNumber } = req.body;

      // Validate required fields
      if (!name || !category || !brand || !warrantyTimeInMonths) {
        return res.status(400).json({ 
          error: 'Missing required fields',
          required: ['name', 'category', 'brand', 'warrantyTimeInMonths']
        });
      }

      // Validate warranty time
      if (warrantyTimeInMonths < 0 || warrantyTimeInMonths > 120) {
        return res.status(400).json({ 
          error: 'Invalid warranty time',
          message: 'Warranty time must be between 0 and 120 months'
        });
      }

      // Check if machine with same serial number exists (if provided)
      if (serialNumber) {
        const existingMachine = await prisma.machine.findFirst({
          where: { 
            serialNumber,
            brand
          }
        });

        if (existingMachine) {
          return res.status(409).json({ 
            error: 'Machine already exists',
            message: `Machine with serial number ${serialNumber} already exists for brand ${brand}`
          });
        }
      }

      // Create machine
      const machine = await prisma.machine.create({
        data: {
          name,
          category,
          brand,
          warrantyTimeInMonths: parseInt(warrantyTimeInMonths),
          serialNumber
        }
      });

      res.status(201).json({
        message: 'Machine created successfully',
        machine
      });

    } catch (error) {
      console.error('Error creating machine:', error);
      res.status(500).json({ 
        error: 'Failed to create machine',
        message: error.message
      });
    }
  }

  // Get all machines
  async getAllMachines(req, res) {
    try {
      const { category, brand, search, page = 1, limit = 20 } = req.query;
      const skip = (page - 1) * limit;

      const where = {};
      if (category) where.category = { contains: category, mode: 'insensitive' };
      if (brand) where.brand = { contains: brand, mode: 'insensitive' };
      
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { category: { contains: search, mode: 'insensitive' } },
          { brand: { contains: search, mode: 'insensitive' } },
          { serialNumber: { contains: search, mode: 'insensitive' } }
        ];
      }

      const [machines, total] = await Promise.all([
        prisma.machine.findMany({
          where,
          skip: parseInt(skip),
          take: parseInt(limit),
          orderBy: { createdAt: 'desc' },
          include: {
            _count: {
              select : {
                serviceRecords: true
              }
            }
          }
        }),
        prisma.machine.count({ where })
      ]);

      res.json({
        message: 'Machines retrieved successfully',
        machines,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      console.error('Error fetching machines:', error);
      res.status(500).json({ 
        error: 'Failed to fetch machines',
        message: error.message
      });
    }
  }

  // Get machine by ID
  async getMachineById(req, res) {
    try {
      const { id } = req.params;

      const machine = await prisma.machine.findUnique({
        where: { id },
        include: {
          serviceRecords: {
            include: {
              customer: {
                select: {
                  id: true,
                  uid: true,
                  name: true,
                  phone: true
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
                select : {
                  reports: true,
                points: true
                }
              }
            },
            orderBy: { createdAt: 'desc' }
          }
        }
      });

      if (!machine) {
        return res.status(404).json({ 
          error: 'Machine not found',
          message: `Machine with ID ${id} not found`
        });
      }

      res.json({
        message: 'Machine retrieved successfully',
        machine
      });

    } catch (error) {
      console.error('Error fetching machine:', error);
      res.status(500).json({ 
        error: 'Failed to fetch machine',
        message: error.message
      });
    }
  }

  // Get machines by serial number
  async getMachineBySerial(req, res) {
    try {
      const { serialNumber } = req.params;

      const machines = await prisma.machine.findMany({
        where: { 
          serialNumber: {
            contains: serialNumber,
            mode: 'insensitive'
          }
        },
        include: {
          serviceRecords: {
            include: {
              customer: {
                select: {
                  id: true,
                  uid: true,
                  name: true,
                  phone: true
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
              }
            },
            orderBy: { createdAt: 'desc' }
          }
        }
      });

      if (machines.length === 0) {
        return res.status(404).json({ 
          error: 'Machine not found',
          message: `No machines found with serial number containing "${serialNumber}"`
        });
      }

      // Calculate warranty status for each service record
      const now = new Date();
      machines.forEach(machine => {
        machine.serviceRecords.forEach(record => {
          record.warrantyStatus = record.warrantyExpiresAt > now ? 'ACTIVE' : 'EXPIRED';
          record.warrantyDaysRemaining = Math.max(0, Math.ceil((record.warrantyExpiresAt - now) / (1000 * 60 * 60 * 24)));
        });
      });

      res.json({
        message: 'Machines retrieved successfully',
        count: machines.length,
        machines
      });

    } catch (error) {
      console.error('Error fetching machine by serial:', error);
      res.status(500).json({ 
        error: 'Failed to fetch machine',
        message: error.message
      });
    }
  }

  // Update machine
  async updateMachine(req, res) {
    try {
      const { id } = req.params;
      const { name, category, brand, warrantyTimeInMonths, serialNumber } = req.body;

      // Check if machine exists
      const existingMachine = await prisma.machine.findUnique({
        where: { id }
      });

      if (!existingMachine) {
        return res.status(404).json({ 
          error: 'Machine not found',
          message: `Machine with ID ${id} not found`
        });
      }

      // Prepare update data
      const updateData = {};
      if (name) updateData.name = name;
      if (category) updateData.category = category;
      if (brand) updateData.brand = brand;
      if (warrantyTimeInMonths !== undefined) {
        if (warrantyTimeInMonths < 0 || warrantyTimeInMonths > 120) {
          return res.status(400).json({ 
            error: 'Invalid warranty time',
            message: 'Warranty time must be between 0 and 120 months'
          });
        }
        updateData.warrantyTimeInMonths = parseInt(warrantyTimeInMonths);
      }
      if (serialNumber !== undefined) updateData.serialNumber = serialNumber;

      // Check for duplicate serial number if updating serial number
      if (serialNumber && serialNumber !== existingMachine.serialNumber) {
        const duplicateMachine = await prisma.machine.findFirst({
          where: { 
            serialNumber,
            brand: updateData.brand || existingMachine.brand,
            id: { not: id }
          }
        });

        if (duplicateMachine) {
          return res.status(409).json({ 
            error: 'Serial number already exists',
            message: `Machine with serial number ${serialNumber} already exists for this brand`
          });
        }
      }

      // Update machine
      const machine = await prisma.machine.update({
        where: { id },
        data: updateData
      });

      res.json({
        message: 'Machine updated successfully',
        machine
      });

    } catch (error) {
      console.error('Error updating machine:', error);
      res.status(500).json({ 
        error: 'Failed to update machine',
        message: error.message
      });
    }
  }

  // Delete machine
  async deleteMachine(req, res) {
    try {
      const { id } = req.params;

      // Check if machine exists
      const existingMachine = await prisma.machine.findUnique({
        where: { id },
        include: {
          _count: {
            select : {
              serviceRecords: true
            }
          }
        }
      });

      if (!existingMachine) {
        return res.status(404).json({ 
          error: 'Machine not found',
          message: `Machine with ID ${id} not found`
        });
      }

      // Check if machine has service records
      if (existingMachine._count.serviceRecords > 0) {
        return res.status(400).json({ 
          error: 'Cannot delete machine',
          message: 'Machine has existing service records. Please delete or transfer them first.'
        });
      }

      // Delete machine
      await prisma.machine.delete({
        where: { id }
      });

      res.json({
        message: 'Machine deleted successfully'
      });

    } catch (error) {
      console.error('Error deleting machine:', error);
      res.status(500).json({ 
        error: 'Failed to delete machine',
        message: error.message
      });
    }
  }

  // Get machine categories
  async getCategories(req, res) {
    try {
      const categories = await prisma.machine.groupBy({
        by: ['category'],
        _count: {
          category: true
        },
        orderBy: {
          _count: {
            category: 'desc'
          }
        }
      });

      res.json({
        message: 'Machine categories retrieved successfully',
        categories: categories.map(cat => ({
          name: cat.category,
          count: cat._count.category
        }))
      });

    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ 
        error: 'Failed to fetch categories',
        message: error.message
      });
    }
  }

  // Get machine brands
  async getBrands(req, res) {
    try {
      const brands = await prisma.machine.groupBy({
        by: ['brand'],
        _count: {
          brand: true
        },
        orderBy: {
          _count: {
            brand: 'desc'
          }
        }
      });

      res.json({
        message: 'Machine brands retrieved successfully',
        brands: brands.map(brand => ({
          name: brand.brand,
          count: brand._count.brand
        }))
      });

    } catch (error) {
      console.error('Error fetching brands:', error);
      res.status(500).json({ 
        error: 'Failed to fetch brands',
        message: error.message
      });
    }
  }
}

module.exports = new MachineController();