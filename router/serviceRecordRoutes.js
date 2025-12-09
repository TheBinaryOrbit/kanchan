const express = require('express');
const router = express.Router();
const serviceRecordController = require('../controller/serviceRecordController');
const { authenticateUser, authorizeRoles } = require('../config/auth');

// All routes require authentication
router.use(authenticateUser);

// Service record management routes
router.post('/', authorizeRoles('ADMIN', 'SERVICE_HEAD', 'ENGINEER'), serviceRecordController.createServiceRecord);
router.get('/', serviceRecordController.getAllServiceRecords);
router.get('/statistics', serviceRecordController.getServiceStatistics);
router.get('/warranty-expiring', serviceRecordController.getWarrantyExpiringSoon);
router.get('/pending-amounts', serviceRecordController.getPendingAmountsSummary);
router.get('/:id', serviceRecordController.getServiceRecordById);
router.put('/:id', serviceRecordController.updateServiceRecord);
router.delete('/:id', authorizeRoles('ADMIN', 'SERVICE_HEAD'), serviceRecordController.deleteServiceRecord);

module.exports = router;