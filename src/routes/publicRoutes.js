const express = require('express');
const publicController = require('../controllers/publicController');
const router = express.Router();

// No JWT required since the company list is public information
router.get('/carriers', publicController.getCompanyList); 

module.exports = router;