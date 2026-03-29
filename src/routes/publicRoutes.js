const express = require('express');
const publicController = require('../controllers/publicController');
const router = express.Router();

// No JWT required since the company list is public information
router.get('/carriers', publicController.getCompanyList); 

router.post('/contact', publicController.submitContactForm);

module.exports = router;