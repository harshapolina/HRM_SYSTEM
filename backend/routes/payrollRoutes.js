const express = require('express');
const {
  generatePayroll,
  updatePayroll,
  getPayrollRecords,
  getPayrollById,
} = require('../controllers/payrollController');
const { auth } = require('../middleware/authMiddleware');

const router = express.Router();

// All payroll routes require authentication
router.use(auth);

// 1. Generate payroll record (Admin & HR)
router.post('/', generatePayroll);

// 4 & 5. View payroll records with filters (month, year, employee)
router.get('/', getPayrollRecords);

// 4. View specific payroll record
router.get('/:id', getPayrollById);

// 3. Update payroll record (Admin & HR)
router.put('/:id', updatePayroll);

module.exports = router;

