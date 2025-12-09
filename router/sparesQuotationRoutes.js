const express = require('express');
const router = express.Router();
const sparesQuotationController = require('../controller/sparesQuotationController');
const { authenticateUser, authorizeRoles } = require('../config/auth');

// All routes require authentication
router.use(authenticateUser);

// Spares quotation management routes
router.post('/', sparesQuotationController.createSparesQuotation);
router.get('/', sparesQuotationController.getAllSparesQuotations);
router.get('/search', sparesQuotationController.searchSparesQuotations);
router.get('/statistics', sparesQuotationController.getSparesQuotationStatistics);
router.get('/status/:status', sparesQuotationController.getQuotationsByStatus);
router.get('/:id', sparesQuotationController.getSparesQuotationById);
router.put('/:id', sparesQuotationController.updateSparesQuotation);
router.delete('/:id', authorizeRoles('ADMIN', 'SERVICE_HEAD'), sparesQuotationController.deleteSparesQuotation);

// Approval/Rejection routes
router.put('/:id/approve', authorizeRoles('ADMIN', 'SERVICE_HEAD', 'SALES'), sparesQuotationController.approveQuotation);
router.put('/:id/reject', authorizeRoles('ADMIN', 'SERVICE_HEAD', 'SALES'), sparesQuotationController.rejectQuotation);

module.exports = router;