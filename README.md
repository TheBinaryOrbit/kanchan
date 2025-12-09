# 🔧 Kanchan Service App

A comprehensive service management system for tracking installations, reports, customer service workflows, and spare parts management.

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Database Setup](#-database-setup)
- [Usage](#-usage)
- [API Documentation](#-api-documentation)
- [Workflow](#-workflow)
- [Project Structure](#-project-structure)
- [Contributing](#-contributing)

## ✨ Features

### 🏭 Core Service Management
- **Installation Management**: Track customer and machine details with automatic ID generation
- **Report Management**: Digital report submission with file uploads (manuals, e-drawings)
- **Point Tracking**: Manage open points with status tracking and escalation
- **Notification System**: Automated notifications to relevant teams
- **Service Records**: Complete service history for each customer-machine combination

### 👥 User Management
- **Role-based Access Control**: Admin, Service Head, Engineer, Sales, Commercial roles
- **User Authentication**: Secure user management with proper permissions
- **Team Collaboration**: Assignment and delegation of tasks

### 📊 Business Intelligence
- **Warranty Tracking**: Monitor warranty status and expiry dates
- **Pending Payments**: Track and manage outstanding amounts
- **Service Statistics**: Comprehensive reporting and analytics
- **Escalation Management**: Automatic escalation for overdue issues

### 🔧 Spare Parts Management
- **Quotation System**: Create and manage spare parts quotations
- **Approval Workflow**: Multi-level approval process
- **Customer History**: Access complete service and spare parts history

## 🛠 Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Custom role-based system
- **File Handling**: Multer for file uploads
- **Real-time**: Socket.io support
- **Development**: Nodemon for hot reloading

## 🚀 Installation

### Prerequisites
- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

### Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd kanchan
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up the database**
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Run database migrations
   npm run db:migrate
   
   # Seed the database with sample data
   npm run db:seed
   ```

5. **Start the application**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/kanchan_service_db"

# Server
PORT=3000
NODE_ENV=development

# Optional configurations
JWT_SECRET=your_secret_key
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760
```

### Database Configuration

1. **Create PostgreSQL database**
   ```sql
   CREATE DATABASE kanchan_service_db;
   ```

2. **Update DATABASE_URL** in `.env` file

3. **Run migrations**
   ```bash
   npm run db:migrate
   ```

## 💾 Database Setup

### Initial Migration
```bash
# Create and apply initial migration
npm run db:migrate

# Generate Prisma client
npm run db:generate

# Seed with sample data
npm run db:seed
```

### Database Management
```bash
# Open Prisma Studio
npm run db:studio

# Reset database (development only)
npx prisma migrate reset

# Push schema changes without migration
npm run db:push
```

## 🎯 Usage

### Default Users (After Seeding)

| Role | UID | Name | Email | Phone |
|------|-----|------|-------|-------|
| Admin | admin001 | System Administrator | admin@kanchan.com | +91-9999999999 |
| Service Head | sh001 | Service Head Manager | servicehead@kanchan.com | +91-9999999998 |
| Engineer | eng001 | Rajesh Kumar | rajesh@kanchan.com | +91-9999999997 |
| Engineer | eng002 | Priya Sharma | priya@kanchan.com | +91-9999999996 |
| Sales | sales001 | Sales Manager | sales@kanchan.com | +91-9999999995 |
| Commercial | comm001 | Commercial Manager | commercial@kanchan.com | +91-9999999994 |

### Authentication

Send the user ID in the Authorization header:
```
Authorization: Bearer <user_id>
```

### Health Check

```
GET /health
```

## 📚 API Documentation

### Base URL
```
http://localhost:3000/api
```

### Endpoints Overview

#### 👤 Users
- `POST /users` - Create user (Admin only)
- `GET /users` - Get all users
- `GET /users/me` - Get current user profile
- `GET /users/:id` - Get user by ID
- `PUT /users/:id` - Update user
- `DELETE /users/:id` - Delete user (Admin only)

#### 🏢 Customers
- `POST /customers` - Create customer
- `GET /customers` - Get all customers
- `GET /customers/search?query=` - Search customers
- `GET /customers/:id` - Get customer by ID
- `GET /customers/uid/:uid` - Get customer by UID
- `PUT /customers/:id` - Update customer
- `DELETE /customers/:id` - Delete customer

#### 🔧 Machines
- `POST /machines` - Create machine
- `GET /machines` - Get all machines
- `GET /machines/categories` - Get machine categories
- `GET /machines/brands` - Get machine brands
- `GET /machines/:id` - Get machine by ID
- `GET /machines/serial/:serialNumber` - Get machine by serial
- `PUT /machines/:id` - Update machine
- `DELETE /machines/:id` - Delete machine

#### 📋 Service Records
- `POST /service-records` - Create service record
- `GET /service-records` - Get all service records
- `GET /service-records/statistics` - Get service statistics
- `GET /service-records/warranty-expiring` - Get warranty expiring records
- `GET /service-records/pending-amounts` - Get pending amounts summary
- `GET /service-records/:id` - Get service record by ID
- `PUT /service-records/:id` - Update service record
- `DELETE /service-records/:id` - Delete service record

#### 📊 Reports
- `POST /reports` - Create report
- `GET /reports` - Get all reports
- `GET /reports/:id` - Get report by ID
- `GET /reports/service-record/:serviceRecordId` - Get reports by service record
- `GET /reports/engineer/:engineerId` - Get reports by engineer
- `PUT /reports/:id` - Update report
- `DELETE /reports/:id` - Delete report

#### ⚠️ Points
- `POST /points` - Create point
- `GET /points` - Get all points
- `GET /points/my-points` - Get my assigned points
- `GET /points/statistics` - Get points statistics
- `GET /points/:id` - Get point by ID
- `GET /points/service-record/:serviceRecordId` - Get points by service record
- `PUT /points/:id` - Update point
- `DELETE /points/:id` - Delete point
- `POST /points/escalation/:serviceRecordId` - Check escalation

#### 🔔 Notifications
- `GET /notifications` - Get user notifications
- `GET /notifications/unread-count` - Get unread count
- `GET /notifications/:id` - Get notification by ID
- `PUT /notifications/:id/read` - Mark notification as read
- `PUT /notifications/mark-all-read` - Mark all notifications as read
- `DELETE /notifications/:id` - Delete notification
- `POST /notifications/send` - Send custom notification (Admin/Service Head)

#### 💰 Spares Quotations
- `POST /spares-quotations` - Create spares quotation
- `GET /spares-quotations` - Get all spares quotations
- `GET /spares-quotations/search?query=` - Search quotations
- `GET /spares-quotations/statistics` - Get quotation statistics
- `GET /spares-quotations/status/:status` - Get quotations by status
- `GET /spares-quotations/:id` - Get quotation by ID
- `PUT /spares-quotations/:id` - Update quotation
- `PUT /spares-quotations/:id/approve` - Approve quotation
- `PUT /spares-quotations/:id/reject` - Reject quotation
- `DELETE /spares-quotations/:id` - Delete quotation

## 🔄 Workflow

### Installation Process (Steps 1-2)
1. **Engineer Input**: Engineer enters customer and machine details
2. **Auto Generation**: System generates customer ID automatically
3. **Notification**: Automatic notification sent to Management, Service Head, Sales, and Commercial teams

### Verification Process (Step 3)
1. **Sales/Commercial Review**: Teams verify machine details
2. **KPI Entry**: Enter performance indicators and pending amounts
3. **Status Update**: Update service record with verification details

### Reporting Process (Steps 4-5)
1. **Report Scanning**: Engineer scans and enters report data
2. **File Upload**: Upload machine manuals and electrical drawings
3. **Point Entry**: Add any open points or issues
4. **Submission**: Submit report through the app
5. **Notification**: Automatic notification with all details sent to relevant teams

### Escalation Process (Step 6)
1. **Time Check**: System monitors open points within time frame
2. **Auto Escalation**: Send notification to Service Head for overdue points
3. **Priority Handling**: High priority issues get immediate attention

### Resolution Process (Step 7)
1. **Assignment**: Service Head assigns points to engineers
2. **Delegation**: Can delegate to other engineers if needed
3. **Progress Tracking**: Track point status and completion
4. **Closure**: Close points through email or app

### Follow-up Process (Step 9)
1. **Report Update**: Engineer updates report with latest status
2. **Continuous Monitoring**: Ongoing tracking of service status

### Service Call Process (Step 10)
1. **Customer Search**: Search by name or machine serial number
2. **History Check**: View complete machine and service history
3. **Warranty Verification**: Check warranty status automatically
4. **Payment Alert**: Notify if pending payments exist

### Spares Quotation Process (Step 11)
1. **Request Entry**: Enter spare parts quotation details
2. **Team Processing**: Concerned team works on quotation
3. **Approval Flow**: Multi-level approval process
4. **Customer Communication**: Quotation sent to customer

## 📁 Project Structure

```
kanchan/
├── config/
│   ├── auth.js              # Authentication middleware
│   ├── database.js          # Database configuration
│   └── notificationService.js # Notification service
├── controller/
│   ├── userController.js
│   ├── customerController.js
│   ├── machineController.js
│   ├── serviceRecordController.js
│   ├── reportController.js
│   ├── pointController.js
│   ├── notificationController.js
│   └── sparesQuotationController.js
├── router/
│   ├── userRoutes.js
│   ├── customerRoutes.js
│   ├── machineRoutes.js
│   ├── serviceRecordRoutes.js
│   ├── reportRoutes.js
│   ├── pointRoutes.js
│   ├── notificationRoutes.js
│   └── sparesQuotationRoutes.js
├── prisma/
│   └── schema.prisma        # Database schema
├── scripts/
│   └── seed.js             # Database seeding script
├── index.js                # Main application file
├── package.json
├── .env.example
└── README.md
```

## 🔐 Security Features

- **Role-based Access Control**: Different permissions for each user role
- **Input Validation**: Comprehensive validation for all API endpoints
- **Error Handling**: Proper error messages without exposing sensitive data
- **Authentication**: Secure user authentication system

## 📊 Data Models

### Core Models
- **User**: System users with role-based permissions
- **Customer**: Customer information and contact details
- **Machine**: Machine specifications and warranty information
- **ServiceRecord**: Main service tracking entity
- **Report**: Service reports with file attachments
- **Point**: Open issues and action items
- **Notification**: System notifications and alerts
- **SparesQuotation**: Spare parts quotation management

## 🚀 Production Deployment

### Environment Setup
```bash
# Set production environment
NODE_ENV=production

# Use production database URL
DATABASE_URL="postgresql://prod_user:prod_pass@prod_host:5432/prod_db"

# Configure proper secrets
JWT_SECRET=your_strong_production_secret
```

### Database Migration
```bash
# Run migrations in production
npx prisma migrate deploy

# Generate production client
npx prisma generate
```

## 🧪 Testing

```bash
# Run tests (when implemented)
npm test

# Test database connection
npx prisma studio
```

## 📈 Monitoring and Analytics

The application provides comprehensive statistics and monitoring:

- **Service Statistics**: Track service records, warranty status, pending amounts
- **Point Statistics**: Monitor open points, assignments, escalations
- **Notification Analytics**: Track notification delivery and read rates
- **Quotation Metrics**: Monitor spare parts quotation workflow

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the API documentation for endpoint details

## 📄 License

This project is licensed under the ISC License - see the LICENSE file for details.

---

**Built with ❤️ for efficient service management**