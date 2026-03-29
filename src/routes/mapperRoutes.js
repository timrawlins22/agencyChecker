const express = require('express');
const router = express.Router();
const mapperController = require('../controllers/mapperController');
const jwtAuthentication = require('../middleware/tenantJwt');

// All mapper routes require authentication
router.use(jwtAuthentication);

// Company listing (for the carrier selector dropdown)
router.get('/companies', mapperController.getCompanies);

// Pattern CRUD
router.get('/patterns', mapperController.getPatterns);
router.get('/patterns/:companyId', mapperController.getPatternByCompany);
router.post('/patterns/:companyId', mapperController.savePattern);
router.put('/patterns/:companyId', mapperController.updatePattern);
router.delete('/patterns/:companyId', mapperController.deletePattern);

// Custom Data Mapping
router.put('/companies/:companyId/mapping', mapperController.updateMapping);

// Sync data upload (from Chrome extension)
router.post('/sync/upload', mapperController.uploadSyncData);

module.exports = router;
