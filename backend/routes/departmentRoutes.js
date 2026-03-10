const express = require('express');
const {
  createDepartment,
  getDepartments,
  getDepartmentById,
  updateDepartment,
  deleteDepartment,
  getMyDepartment,
  assignEmployeeToDepartment,
  getMyDepartmentEmployees,
  getDepartmentEmployees,
} = require('../controllers/departmentController');
const { auth, adminOnly } = require('../middleware/authMiddleware');

const router = express.Router();

// Admin: create department
router.post('/', auth, adminOnly, createDepartment);

// Admin / HR / Manager: get all departments (auth required)
router.get('/', auth, getDepartments);

// Any authenticated user: get department by id
router.get('/:id', auth, getDepartmentById);

// Admin: update & delete department
router.put('/:id', auth, adminOnly, updateDepartment);
router.delete('/:id', auth, adminOnly, deleteDepartment);

// Manager: get their own department and employees
router.get('/my/department', auth, getMyDepartment);
router.get('/my/employees', auth, getMyDepartmentEmployees);

// HR/Admin: assign employee to department
router.put('/:id/assign-employee', auth, assignEmployeeToDepartment);

// HR/Admin/Manager: view employees in a specific department
router.get('/:id/employees', auth, getDepartmentEmployees);

module.exports = router;


