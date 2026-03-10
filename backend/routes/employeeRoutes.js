const express = require('express');
const {
  createEmployee,
  listEmployees,
  getEmployeeById,
  updateEmployee,
  deactivateEmployee,
  deleteEmployee,
} = require('../controllers/employeeController');
const { auth } = require('../middleware/authMiddleware');

const router = express.Router();

// All employee routes require authentication
router.use(auth);

// 1. Create new employee (Admin, HR)
router.post('/', createEmployee);

// 2. List employees with search/filter
router.get('/', listEmployees);

// 3. Get specific employee
router.get('/:id', getEmployeeById);

// 4. Update employee
router.put('/:id', updateEmployee);

// 5. Deactivate employee
router.patch('/:id/deactivate', deactivateEmployee);

// 6. Delete employee (Admin only)
router.delete('/:id', deleteEmployee);

module.exports = router;


