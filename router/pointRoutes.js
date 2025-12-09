const express = require('express');
const router = express.Router();
const pointController = require('../controller/pointController');
const { authenticateUser, authorizeRoles } = require('../config/auth');

// All routes require authentication
router.use(authenticateUser);

// Point management routes
router.post('/', authorizeRoles('ADMIN', 'SERVICE_HEAD', 'ENGINEER'), pointController.createPoint);
router.get('/', pointController.getAllPoints);
router.get('/my-points', pointController.getMyPoints);
router.get('/statistics', pointController.getPointsStatistics);
router.get('/:id', pointController.getPointById);
router.put('/:id', pointController.updatePoint);
router.delete('/:id', pointController.deletePoint);

// Points by service record
router.get('/service-record/:serviceRecordId', pointController.getPointsByServiceRecord);

// Escalation check
router.post('/escalation/:serviceRecordId', pointController.checkEscalation);

module.exports = router;