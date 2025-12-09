const express = require('express');
const router = express.Router();
const customerController = require('../controller/customerController');
const { authenticateUser } = require('../config/auth');

// All routes require authentication
router.use(authenticateUser);

// Customer management routes
router.post('/', customerController.createCustomer);
router.get('/', customerController.getAllCustomers);
router.get('/search', customerController.searchCustomers);
router.get('/:id', customerController.getCustomerById);
router.get('/uid/:uid', customerController.getCustomerByUid);
router.put('/:id', customerController.updateCustomer);
router.delete('/:id', customerController.deleteCustomer);

module.exports = router;