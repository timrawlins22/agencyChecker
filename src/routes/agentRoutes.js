const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agentController');
const jwtAuthentication = require('../middleware/tenantJwt');
const multer = require('multer');



const upload = multer({ storage: multer.memoryStorage() });
//login
router.post('/login', agentController.login);
//Carrier info
router.post('/carrier/credentials', jwtAuthentication, agentController.saveCarrierCredentials);
router.get('/carriers/manage', jwtAuthentication, agentController.getAgentCarriers);
router.delete('/carrier/credentials/:companyId', jwtAuthentication, agentController.deleteCarrierCredentials);

//leads
router.post('/leads/upload', jwtAuthentication, agentController.uploadLeads);
router.get('/leads', jwtAuthentication, agentController.getAgentLeads);
router.post('/:agentId/updatePassword', agentController.updatePassword);

//agent information
router.get('/:agentId', jwtAuthentication, agentController.getAgent);

module.exports = router;