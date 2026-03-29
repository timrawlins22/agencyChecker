
const express = require('express');
const router = express.Router();
//const dashboardController = require('../controllers/dashboardController');
const jwtAuthentication = require('../middleware/tenantJwt'); 
const dashboardController = require('../controllers/dashboardController');

// Apply authentication to all dashboard routes
router.use(jwtAuthentication);

// 1. Endpoint for all high-level KPIs and Alerts
router.get('/summary', dashboardController.getDashboardSummary);

// 2. Endpoint for detailed carrier job status (for the sidebar)
router.get('/jobs', dashboardController.getJobStatus); 

// 3. Endpoints for the full CRM Book of Business
router.get('/policies', dashboardController.getAllPolicies);
router.post('/policies', dashboardController.createPolicy);

// The frontend will hit /api/dashboard/summary, /api/dashboard/jobs, and /api/dashboard/policies
module.exports = router;