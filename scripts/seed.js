const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed process...');

  try {
    // Hash default password
    const defaultPassword = await bcrypt.hash('123456', 10);

    // Create default admin user
    const adminUser = await prisma.user.upsert({
      where: { uid: 'admin001' },
      update: {},
      create: {
        uid: 'admin001',
        name: 'System Administrator',
        email: 'admin@kanchan.com',
        phone: '+91-9999999999',
        role: 'ADMIN',
        password: defaultPassword,
        isActive: true
      }
    });

    console.log('✅ Created admin user:', adminUser.name);

    // Create sample service head
    const serviceHead = await prisma.user.upsert({
      where: { uid: 'sh001' },
      update: {},
      create: {
        uid: 'sh001',
        name: 'Service Head Manager',
        email: 'servicehead@kanchan.com',
        phone: '+91-9999999998',
        role: 'SERVICE_HEAD',
        password: defaultPassword,
        isActive: true
      }
    });

    console.log('✅ Created service head:', serviceHead.name);

    // Create sample engineers
    const engineer1 = await prisma.user.upsert({
      where: { uid: 'eng001' },
      update: {},
      create: {
        uid: 'eng001',
        name: 'Rajesh Kumar',
        email: 'rajesh@kanchan.com',
        phone: '+91-9999999997',
        role: 'ENGINEER',
        password: defaultPassword,
        isActive: true
      }
    });

    const engineer2 = await prisma.user.upsert({
      where: { uid: 'eng002' },
      update: {},
      create: {
        uid: 'eng002',
        name: 'Priya Sharma',
        email: 'priya@kanchan.com',
        phone: '+91-9999999996',
        role: 'ENGINEER',
        password: defaultPassword,
        isActive: true
      }
    });

    console.log('✅ Created engineers:', engineer1.name, 'and', engineer2.name);

    // Create sample sales user
    const salesUser = await prisma.user.upsert({
      where: { uid: 'sales001' },
      update: {},
      create: {
        uid: 'sales001',
        name: 'Sales Manager',
        email: 'sales@kanchan.com',
        phone: '+91-9999999995',
        role: 'SALES',
        password: defaultPassword,
        isActive: true
      }
    });

    console.log('✅ Created sales user:', salesUser.name);

    // Create sample commercial user
    const commercialUser = await prisma.user.upsert({
      where: { uid: 'comm001' },
      update: {},
      create: {
        uid: 'comm001',
        name: 'Commercial Manager',
        email: 'commercial@kanchan.com',
        phone: '+91-9999999994',
        role: 'COMMERCIAL',
        password: defaultPassword,
        isActive: true
      }
    });

    console.log('✅ Created commercial user:', commercialUser.name);

    // Create sample customers
    const customer1 = await prisma.customer.upsert({
      where: { uid: 'CUST001' },
      update: {},
      create: {
        uid: 'CUST001',
        name: 'ABC Manufacturing Ltd',
        phone: '+91-9876543210',
        email: 'contact@abcmfg.com',
        address: 'Industrial Area, Phase 1, Chandigarh'
      }
    });

    const customer2 = await prisma.customer.upsert({
      where: { uid: 'CUST002' },
      update: {},
      create: {
        uid: 'CUST002',
        name: 'XYZ Industries Pvt Ltd',
        phone: '+91-9876543211',
        email: 'info@xyzind.com',
        address: 'Plot No. 15, Industrial Estate, Mumbai'
      }
    });

    console.log('✅ Created customers:', customer1.name, 'and', customer2.name);

    // Create sample machines
    const machine1 = await prisma.machine.upsert({
      where: { id: 'machine1' },
      update: {},
      create: {
        id: 'machine1',
        name: 'Industrial Lathe Machine',
        category: 'CNC Machines',
        brand: 'Kanchan Industries',
        warrantyTimeInMonths: 24,
        serialNumber: 'KI-LTH-2024-001'
      }
    });

    const machine2 = await prisma.machine.upsert({
      where: { id: 'machine2' },
      update: {},
      create: {
        id: 'machine2',
        name: 'Milling Machine',
        category: 'CNC Machines',
        brand: 'Kanchan Industries',
        warrantyTimeInMonths: 36,
        serialNumber: 'KI-MIL-2024-002'
      }
    });

    const machine3 = await prisma.machine.upsert({
      where: { id: 'machine3' },
      update: {},
      create: {
        id: 'machine3',
        name: 'Power Press',
        category: 'Press Machines',
        brand: 'Kanchan Heavy Industries',
        warrantyTimeInMonths: 18,
        serialNumber: 'KHI-PP-2024-001'
      }
    });

    console.log('✅ Created machines:', machine1.name, machine2.name, 'and', machine3.name);

    // Create sample service records
    const purchaseDate1 = new Date('2024-01-15');
    const warrantyExpiry1 = new Date(purchaseDate1);
    warrantyExpiry1.setMonth(warrantyExpiry1.getMonth() + machine1.warrantyTimeInMonths);

    const serviceRecord1 = await prisma.serviceRecord.create({
      data: {
        customerId: customer1.id,
        machineId: machine1.id,
        purchaseDate: purchaseDate1,
        warrantyExpiresAt: warrantyExpiry1,
        pendingAmount: 25000,
        kpis: {
          installationRating: 5,
          customerSatisfaction: 4.5,
          onTimeDelivery: true
        },
        createdById: engineer1.id,
        status: 'ACTIVE'
      }
    });

    const purchaseDate2 = new Date('2024-03-10');
    const warrantyExpiry2 = new Date(purchaseDate2);
    warrantyExpiry2.setMonth(warrantyExpiry2.getMonth() + machine2.warrantyTimeInMonths);

    const serviceRecord2 = await prisma.serviceRecord.create({
      data: {
        customerId: customer2.id,
        machineId: machine2.id,
        purchaseDate: purchaseDate2,
        warrantyExpiresAt: warrantyExpiry2,
        pendingAmount: 0,
        kpis: {
          installationRating: 4,
          customerSatisfaction: 4.0,
          onTimeDelivery: true
        },
        createdById: engineer2.id,
        status: 'ACTIVE'
      }
    });

    console.log('✅ Created service records for customers');

    // Create sample reports
    const report1 = await prisma.report.create({
      data: {
        serviceRecordId: serviceRecord1.id,
        engineerId: engineer1.id,
        reportData: {
          installationDate: '2024-01-20',
          installationStatus: 'Completed',
          testResults: 'All tests passed',
          customerFeedback: 'Very satisfied with installation'
        },
        scanData: {
          qrCodeScanned: true,
          timestamp: new Date().toISOString()
        },
        manualUrl: '/uploads/manuals/ki-lth-2024-001-manual.pdf',
        eDrawingsUrl: '/uploads/drawings/ki-lth-2024-001-electrical.dwg'
      }
    });

    console.log('✅ Created sample report');

    // Create sample points
    const point1 = await prisma.point.create({
      data: {
        serviceRecordId: serviceRecord1.id,
        title: 'Calibration Required',
        description: 'Machine requires fine calibration after installation',
        status: 'ASSIGNED',
        priority: 'HIGH',
        assignedToId: engineer1.id,
        createdById: serviceHead.id,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
      }
    });

    const point2 = await prisma.point.create({
      data: {
        serviceRecordId: serviceRecord1.id,
        title: 'Training Documentation',
        description: 'Provide operator training documentation to customer',
        status: 'IN_PROGRESS',
        priority: 'MEDIUM',
        assignedToId: engineer1.id,
        createdById: serviceHead.id,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days from now
      }
    });

    console.log('✅ Created sample points');

    // Create sample spares quotation
    const sparesQuotation = await prisma.sparesQuotation.create({
      data: {
        customerName: 'ABC Manufacturing Ltd',
        machineInfo: 'Industrial Lathe Machine - KI-LTH-2024-001',
        partDetails: {
          parts: [
            {
              name: 'Cutting Tool Set',
              partNumber: 'CTS-001',
              quantity: 2,
              unitPrice: 5000
            },
            {
              name: 'Chuck Assembly',
              partNumber: 'CA-002',
              quantity: 1,
              unitPrice: 15000
            }
          ]
        },
        quotationAmount: 25000,
        status: 'PENDING',
        notes: 'Customer requested quotation for spare parts due to wear and tear'
      }
    });

    console.log('✅ Created sample spares quotation');

    // Create sample notifications
    await prisma.notification.createMany({
      data: [
        {
          userId: serviceHead.id,
          title: 'New Installation Completed',
          message: `Installation completed for ${customer1.name} - ${machine1.name}`,
          type: 'INFO',
          serviceRecordId: serviceRecord1.id,
          isRead: false
        },
        {
          userId: salesUser.id,
          title: 'Pending Payment Alert',
          message: `Pending payment of ₹25,000 for ${customer1.name}`,
          type: 'WARNING',
          serviceRecordId: serviceRecord1.id,
          isRead: false
        },
        {
          userId: engineer1.id,
          title: 'Point Assigned',
          message: 'You have been assigned a new high priority point: Calibration Required',
          type: 'WARNING',
          serviceRecordId: serviceRecord1.id,
          isRead: false
        }
      ]
    });

    console.log('✅ Created sample notifications');

    console.log('🎉 Seed completed successfully!');
    console.log('\n📊 Summary:');
    console.log('- 6 Users created (1 Admin, 1 Service Head, 2 Engineers, 1 Sales, 1 Commercial)');
    console.log('- 2 Customers created');
    console.log('- 3 Machines created');
    console.log('- 2 Service Records created');
    console.log('- 1 Report created');
    console.log('- 2 Points created');
    console.log('- 1 Spares Quotation created');
    console.log('- 3 Notifications created');
    console.log('\n🔑 Default Admin Credentials:');
    console.log('- UID: admin001');
    console.log('- Name: System Administrator');
    console.log('- Email: admin@kanchan.com');

  } catch (error) {
    console.error('❌ Error during seed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });