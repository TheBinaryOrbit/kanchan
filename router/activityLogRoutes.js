const express = require('express');
const router = express.Router();
const activityLogController = require('../controller/activityLogController');
const { authenticateUser } = require('../config/auth');

router.use(authenticateUser);

router.post('/', activityLogController.createActivityLog);
router.get('/', activityLogController.getActivityLogs);

module.exports = router;