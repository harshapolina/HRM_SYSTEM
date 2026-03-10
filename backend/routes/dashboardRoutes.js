const express = require('express');
const {
  getCompanyDashboard,
  getDepartmentDashboard,
  getPersonalDashboard,
  getHRDashboard,
  getDashboard,
} = require('../controllers/dashboardController');
const { auth } = require('../middleware/authMiddleware');

const router = express.Router();

// All dashboard routes require authentication
router.use(auth);

// Universal dashboard endpoint (returns appropriate dashboard based on role)
router.get('/', getDashboard);

// Specific dashboard endpoints
router.get('/company', getCompanyDashboard);
router.get('/department', getDepartmentDashboard);
router.get('/personal', getPersonalDashboard);
router.get('/hr', getHRDashboard);

module.exports = router;

