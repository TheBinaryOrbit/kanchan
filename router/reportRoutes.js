const express = require('express');
const router = express.Router();
const reportController = require('../controller/reportController');
const { authenticateUser, authorizeRoles } = require('../config/auth');
const { upload, handleMulterError } = require('../config/upload');

// All routes require authentication
router.use(authenticateUser);

// Report management routes
router.post('/', authorizeRoles('ADMIN', 'SERVICE_HEAD', 'ENGINEER'), reportController.createReport);
router.get('/', reportController.getAllReports);
router.get('/:id', reportController.getReportById);
router.put('/:id', authorizeRoles('ADMIN', 'SERVICE_HEAD', 'ENGINEER'), reportController.updateReport);
router.delete('/:id', authorizeRoles('ADMIN', 'SERVICE_HEAD', 'ENGINEER'), reportController.deleteReport);

// Reports by service record or engineer
router.get('/service-record/:serviceRecordId', reportController.getReportsByServiceRecord);
router.get('/engineer/:engineerId', reportController.getReportsByEngineer);

// File upload for reports (implement with multer if needed)
// type can be: 'manual' | 'edrawings' | 'general'
router.post(
	'/upload/:type',
	authorizeRoles('ADMIN', 'SERVICE_HEAD', 'ENGINEER'),
	(req, res, next) => {
		// Attach type to request for storage/fileFilter decisions
		req.uploadType = req.params.type;
		next();
	},
	upload.single('file'),
	handleMulterError,
	reportController.uploadFile
);

// Upload and attach a manual or e-drawing to a specific report
router.post(
	'/:id/upload/:type',
	authorizeRoles('ADMIN', 'SERVICE_HEAD', 'ENGINEER'),
	(req, res, next) => {
		req.uploadType = req.params.type; // 'manual' | 'edrawings'
		next();
	},
	upload.single('file'),
	handleMulterError,
	reportController.uploadReportAsset
);

module.exports = router;