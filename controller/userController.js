const prisma = require('../config/database');
const bcrypt = require('bcrypt');
const { canCreateUser } = require('../config/auth');

class UserController {

  // Login user
  async login(req, res) {
    try {
      const { uid, password , fcmToken } = req.body;
      console.log('Login attempt for UID:', uid);
      console.log('Login attempt for UID:', password);
      console.log('Received login request:', fcmToken);

      // Validate required fields
      if (!uid || !password) {
        return res.status(400).json({ 
          error: 'Missing required fields',
          required: ['uid', 'password']
        });
      }

      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email : uid },
        select: {
          id: true,
          uid: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          password: true, // We'll add this field to the schema
          createdAt: true
        }
      });

      console.log('User fetched from DB:', user);

      if (!user) {
        return res.status(401).json({ 
          error: 'Invalid credentials',
          message: 'User not found or invalid credentials'
        });
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(401).json({ 
          error: 'Account disabled',
          message: 'Your account has been disabled. Please contact administrator.'
        });
      }

      // For now, we'll use a simple password check
      // In production, you should use bcrypt to hash passwords
      const isPasswordValid = password === 'default123' || 
                             (user.password && await bcrypt.compare(password, user.password));

      if (!isPasswordValid) {
        return res.status(401).json({ 
          error: 'Invalid credentials',
          message: 'Invalid password'
        });
      }

      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;

      // If an fcmToken was provided during login, persist it on the user record
      if (fcmToken) {
        try {
          await prisma.user.update({ where: { id: user.id }, data: { fcmToken } });
          userWithoutPassword.fcmToken = fcmToken;
        } catch (e) {
          console.warn('Failed to persist fcmToken during login:', e.message);
        }
      }
      // Generate session token (simple approach - in production use JWT)
      const sessionToken = user.id; // For simplicity, using user ID as token

      res.json({
        message: 'Login successful',
        user: userWithoutPassword,
        token: sessionToken,
        expiresIn: '24h'
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ 
        error: 'Login failed',
        message: 'An error occurred during login'
      });
    }
  }

  // Update FCM token for authenticated user
  async updateFcmToken(req, res) {
    try {
      const currentUser = req.user;
      if (!currentUser) return res.status(401).json({ error: 'Unauthorized' });

      const { fcmToken } = req.body;
      if (!fcmToken) {
        return res.status(400).json({ error: 'Missing required field', required: ['fcmToken'] });
      }

      const user = await prisma.user.update({ where: { id: currentUser.id }, data: { fcmToken }, select: { id: true, uid: true, name: true, email: true, fcmToken: true } });

      res.json({ message: 'FCM token updated', user });
    } catch (error) {
      console.error('Error updating fcmToken:', error);
      res.status(500).json({ error: 'Failed to update fcmToken', message: error.message });
    }
  }
  
  // Create user (Admin only)
  async createUser(req, res) {
    try {
      const { name, email, phone, role, password } = req.body;
      const currentUser = req.user;

      // Check if current user can create users
      if (!canCreateUser(currentUser.role)) {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'Only Admin can create users'
        });
      }

      // Validate required fields
      if (!name || !phone || !role) {
        return res.status(400).json({ 
          error: 'Missing required fields',
          required: ['name', 'phone', 'role']
        });
      }

      // Validate role
      const validRoles = ['ADMIN', 'SERVICE_HEAD', 'ENGINEER', 'SALES', 'COMMERCIAL'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ 
          error: 'Invalid role',
          validRoles
        });
      }

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email }
      });

      if (existingUser) {
        return res.status(409).json({ 
          error: 'User already exists',
          message: `User with UID ${uid} already exists`
        });
      }

      // Hash password if provided, otherwise use default
      let hashedPassword = null;
      if (password) {
        if (password.length < 6) {
          return res.status(400).json({ 
            error: 'Invalid password',
            message: 'Password must be at least 6 characters long'
          });
        }
        hashedPassword = await bcrypt.hash(password, 10);
      }

      // Create user
      const user = await prisma.user.create({
        data: {
          name,
          email,
          phone,
          role,
          password: hashedPassword
        },
        select: {
          id: true,
          uid: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          createdAt: true
        }
      });

      res.status(201).json({
        message: 'User created successfully',
        user,
        note: hashedPassword ? 'Custom password set' : 'Default password assigned (default123)'
      });

    } catch (error) {
      console.error('Error creating user:', error);
      
      if (error.code === 'P2002') {
        return res.status(409).json({ 
          error: 'User already exists',
          message: 'A user with this UID already exists'
        });
      }

      res.status(500).json({ 
        error: 'Failed to create user',
        message: error.message
      });
    }
  }

  // Get all users
  async getAllUsers(req, res) {
    try {
      const { role, isActive } = req.query;

      console.log("Role to be selected  :" , role )
      // By default, return only active users. Allow override via ?isActive=true|false
      const where = { isActive: true };

      if (role) where.role = role;
      if (isActive !== undefined) {
        where.isActive = isActive === 'true';
      }

      const users = await prisma.user.findMany({
        where : where,
        select: {
          id: true,
          uid: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { createdAt: 'desc' }
      });

      res.json({
        message: 'Users retrieved successfully',
        count: users.length,
        users
      });

    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ 
        error: 'Failed to fetch users',
        message: error.message
      });
    }
  }

  // Get user by ID
  async getUserById(req, res) {
    try {
      const { id } = req.params;

      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          uid: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            createdServiceRecords: true,
            assignedPoints: true,
            reports: true
          }
        }
      });

      if (!user) {
        return res.status(404).json({ 
          error: 'User not found',
          message: `User with ID ${id} not found`
        });
      }

      res.json({
        message: 'User retrieved successfully',
        user
      });

    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ 
        error: 'Failed to fetch user',
        message: error.message
      });
    }
  }

  // Update user
  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const { name, email, phone, role, isActive } = req.body;
      const currentUser = req.user;

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { id }
      });

      if (!existingUser) {
        return res.status(404).json({ 
          error: 'User not found',
          message: `User with ID ${id} not found`
        });
      }

      // Only admin can update other users or change roles
      if (currentUser.id !== id && currentUser.role !== 'ADMIN') {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'Only Admin can update other users'
        });
      }

      // Only admin can change roles
      if (role && role !== existingUser.role && currentUser.role !== 'ADMIN') {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'Only Admin can change user roles'
        });
      }

      // Prepare update data
      const updateData = {};
      if (name) updateData.name = name;
      if (email !== undefined) updateData.email = email;
      if (phone) updateData.phone = phone;
      if (role) {
        const validRoles = ['ADMIN', 'SERVICE_HEAD', 'ENGINEER', 'SALES', 'COMMERCIAL'];
        if (!validRoles.includes(role)) {
          return res.status(400).json({ 
            error: 'Invalid role',
            validRoles
          });
        }
        updateData.role = role;
      }
      if (isActive !== undefined) updateData.isActive = isActive;

      // Update user
      const user = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          uid: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          updatedAt: true
        }
      });

      res.json({
        message: 'User updated successfully',
        user
      });

    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ 
        error: 'Failed to update user',
        message: error.message
      });
    }
  }

  // Delete user (soft delete)
  async deleteUser(req, res) {
    try {
      const { id } = req.params;
      const currentUser = req.user;

      // Only admin can delete users
      if (currentUser.role !== 'ADMIN') {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'Only Admin can delete users'
        });
      }

      // Cannot delete yourself
      if (currentUser.id === id) {
        return res.status(400).json({ 
          error: 'Invalid operation',
          message: 'Cannot delete your own account'
        });
      }

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { id }
      });

      if (!existingUser) {
        return res.status(404).json({ 
          error: 'User not found',
          message: `User with ID ${id} not found`
        });
      }

      // Soft delete (deactivate)
      const user = await prisma.user.update({
        where: { id },
        data: { isActive: false },
        select: {
          id: true,
          uid: true,
          name: true,
          isActive: true
        }
      });

      res.json({
        message: 'User deactivated successfully',
        user
      });

    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ 
        error: 'Failed to delete user',
        message: error.message
      });
    }
  }

  // Logout user (invalidate token)
  async logout(req, res) {
    try {
      // For now, just return success message
      // In a production app with JWT, you'd add the token to a blacklist
      // or handle token invalidation on the client side
      
      res.json({
        message: 'Logout successful',
        note: 'Please remove the token from client storage'
      });

    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ 
        error: 'Logout failed',
        message: error.message
      });
    }
  }

  // Change password
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const currentUser = req.user;

      // Validate required fields
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ 
          error: 'Missing required fields',
          required: ['currentPassword', 'newPassword']
        });
      }

      // Validate new password strength
      if (newPassword.length < 6) {
        return res.status(400).json({ 
          error: 'Invalid password',
          message: 'Password must be at least 6 characters long'
        });
      }

      // Get user with current password
      const user = await prisma.user.findUnique({
        where: { id: currentUser.id },
        select: {
          id: true,
          password: true
        }
      });

      if (!user) {
        return res.status(404).json({ 
          error: 'User not found'
        });
      }

      // Verify current password
      const isCurrentPasswordValid = currentPassword === 'default123' || 
                                   (user.password && await bcrypt.compare(currentPassword, user.password));

      if (!isCurrentPasswordValid) {
        return res.status(401).json({ 
          error: 'Invalid current password'
        });
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);

      // Update password
      await prisma.user.update({
        where: { id: currentUser.id },
        data: {
          password: hashedNewPassword
        }
      });

      res.json({
        message: 'Password changed successfully'
      });

    } catch (error) {
      console.error('Error changing password:', error);
      res.status(500).json({ 
        error: 'Failed to change password',
        message: error.message
      });
    }
  }

  // Get current user profile
  async getCurrentUser(req, res) {
    try {
      const currentUser = req.user;

      const user = await prisma.user.findUnique({
        where: { id: currentUser.id },
        select: {
          id: true,
          uid: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          createdAt: true,
          _count: {
            createdServiceRecords: true,
            assignedPoints: true,
            reports: true,
            notifications: true
          }
        }
      });

      res.json({
        message: 'Current user profile retrieved successfully',
        user
      });

    } catch (error) {
      console.error('Error fetching current user:', error);
      res.status(500).json({ 
        error: 'Failed to fetch user profile',
        message: error.message
      });
    }
  }

  // Role-based dashboard data
  async getDashboard(req, res) {
    try {
      const { role } = req.query;
      const currentUser = req.user;
      // ensure authenticated user present for user-scoped metrics
      if (!currentUser) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      }
      if (!role) {
        return res.status(400).json({ error: 'Missing role query parameter', message: 'Provide ?role=ADMIN|ENGINEER|SERVICE_HEAD|SALES' });
      }

      const upperRole = role.toUpperCase();

      // Shared counts
      const totalUsers = await prisma.user.count({ where: { isActive: true } });
      const totalCustomers = await prisma.customer.count();
      const totalMachines = await prisma.machine.count();

      switch (upperRole) {
        case 'ADMIN': {
          // active services = service records with status ACTIVE
          const activeServices = await prisma.serviceRecord.count({ where: { status: 'ACTIVE' } });
          // total customers already computed
          // open issues: points not completed
          const openIssues = await prisma.point.count({ where: { status: { not: 'COMPLETED' } } });

          return res.json({
            role: 'ADMIN',
            totalUsers,
            activeServices,
            totalCustomers,
            openIssues
          });
        }

        case 'ENGINEER': {
                    // total machines
          const totalMachines = await prisma.machine.count();

          // open assigned points assigned to this engineer and not completed
          const openAssignedPoints = await prisma.point.count({ where: { assignedToId: currentUser.id, status: { not: 'COMPLETED' } } });
          // total assigned points assigned to this engineer
          const totalAssignedPoints = await prisma.point.count({ where: { assignedToId: currentUser.id } });
          // completed assigned points assigned to this engineer
          const completedAssignedPoints = await prisma.point.count({ where: { assignedToId: currentUser.id, status: 'COMPLETED' } });

          return res.json({
            role: 'ENGINEER',
            totalMachines,
            openAssignedPoints,
            totalAssignedPoints,
            completedAssignedPoints
          });
        }

        case 'SERVICE_HEAD': {
          const totalServices = await prisma.serviceRecord.count();
          const activeServices = await prisma.serviceRecord.count({ where: { status: 'ACTIVE' } });
          const openIssues = await prisma.point.count({ where: { status: { not: 'COMPLETED' } } });
          const totalEngineers = await prisma.user.count({ where: { role: 'ENGINEER' } });

          return res.json({
            role: 'SERVICE_HEAD',
            totalServices,
            activeServices,
            openIssues,
            totalEngineers
          });
        }

        case 'SALES': {
          const totalCustomers = await prisma.customer.count();
          const activeServices = await prisma.serviceRecord.count({ where: { status: 'ACTIVE' } });
          const completedServices = await prisma.serviceRecord.count({ where: { status: 'COMPLETED' } });
          // pending amounts: sum of pendingAmount across service records
          const pendingAgg = await prisma.serviceRecord.aggregate({ _sum: { pendingAmount: true } });
          const pendingAmounts = pendingAgg._sum.pendingAmount || 0;

          return res.json({
            role: 'SALES',
            totalCustomers,
            activeServices,
            completedServices,
            pendingAmounts
          });
        }

        default:
          return res.status(400).json({ error: 'Invalid role', message: 'Supported roles: ADMIN, ENGINEER, SERVICE_HEAD, SALES' });
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard', message: error.message });
    }
  }
}

module.exports = new UserController();
