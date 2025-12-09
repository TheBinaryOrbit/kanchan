const express = require('express');
const router = express.Router();
const machineController = require('../controller/machineController');
const { authenticateUser } = require('../config/auth');

// All routes require authentication
router.use(authenticateUser);

// Machine management routes
router.post('/', machineController.createMachine);
router.get('/', machineController.getAllMachines);
router.get('/categories', machineController.getCategories);
router.get('/brands', machineController.getBrands);
router.get('/:id', machineController.getMachineById);
router.get('/serial/:serialNumber', machineController.getMachineBySerial);
router.put('/:id', machineController.updateMachine);
router.delete('/:id', machineController.deleteMachine);

module.exports = router;