const express = require('express');
const {
  createLeaveRequest,
  getEmployeeLeaves,
  listLeaves,
  updateLeaveStatus,
} = require('../controllers/leaveController');
const { auth } = require('../middleware/authMiddleware');

const router = express.Router();

// All leave routes require authentication
router.use(auth);

// 1. Employee submit leave request
router.post('/', createLeaveRequest);

// 2. View leave history for a specific employee
router.get('/employee/:employeeId', getEmployeeLeaves);

// 5 & 6. List leaves with filters (employee, status)
router.get('/', listLeaves);

// 3 & 4. Approve / reject leave
router.patch('/:id/status', updateLeaveStatus);

module.exports = router;


