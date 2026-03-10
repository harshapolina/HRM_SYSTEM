const Department = require('../models/Department');
const User = require('../models/User');

// Helper to check role
const hasRole = (user, roles = []) => roles.includes(user.role);

// Admin: create department
// POST /api/departments
const createDepartment = async (req, res) => {
  try {
    const { name, description, managerId } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Department name is required' });
    }

    const department = new Department({
      name,
      description,
      managerId,
    });

    await department.save();

    return res.status(201).json({
      message: 'Department created successfully',
      department,
    });
  } catch (error) {
    console.error('Create department error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Admin / HR / Manager: get all departments
// GET /api/departments
const getDepartments = async (req, res) => {
  try {
    const departments = await Department.find().populate('managerId', 'name email role');
    return res.status(200).json(departments);
  } catch (error) {
    console.error('Get departments error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Any authenticated user: get department by id
// GET /api/departments/:id
const getDepartmentById = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id).populate(
      'managerId',
      'name email role'
    );

    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    return res.status(200).json(department);
  } catch (error) {
    console.error('Get department by id error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Admin: update department
// PUT /api/departments/:id
const updateDepartment = async (req, res) => {
  try {
    const { name, description, managerId } = req.body;

    const department = await Department.findById(req.params.id);

    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    if (name !== undefined) department.name = name;
    if (description !== undefined) department.description = description;
    if (managerId !== undefined) department.managerId = managerId;

    await department.save();

    return res.status(200).json({
      message: 'Department updated successfully',
      department,
    });
  } catch (error) {
    console.error('Update department error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Admin: delete department
// DELETE /api/departments/:id
const deleteDepartment = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);

    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    await department.deleteOne();

    return res.status(200).json({ message: 'Department deleted successfully' });
  } catch (error) {
    console.error('Delete department error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Manager: view their own department
// GET /api/departments/my
const getMyDepartment = async (req, res) => {
  try {
    if (!hasRole(req.user, ['manager'])) {
      return res.status(403).json({ message: 'Only managers can view their department' });
    }

    const department = await Department.findOne({ managerId: req.user._id }).populate(
      'managerId',
      'name email role'
    );

    if (!department) {
      return res.status(404).json({ message: 'No department assigned to this manager' });
    }

    return res.status(200).json(department);
  } catch (error) {
    console.error('Get my department error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// HR: assign employee to department
// PUT /api/departments/:id/assign-employee
const assignEmployeeToDepartment = async (req, res) => {
  try {
    if (!hasRole(req.user, ['hr', 'admin'])) {
      return res.status(403).json({ message: 'Only HR or Admin can assign employees' });
    }

    const { userId } = req.body;
    const { id: departmentId } = req.params;

    const department = await Department.findById(departmentId);
    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.departmentId = departmentId;
    await user.save();

    return res.status(200).json({
      message: 'Employee assigned to department successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        departmentId: user.departmentId,
      },
    });
  } catch (error) {
    console.error('Assign employee error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Manager: view employees in their department
// GET /api/departments/my/employees
const getMyDepartmentEmployees = async (req, res) => {
  try {
    if (!hasRole(req.user, ['manager'])) {
      return res
        .status(403)
        .json({ message: 'Only managers can view employees in their department' });
    }

    const department = await Department.findOne({ managerId: req.user._id });
    if (!department) {
      return res.status(404).json({ message: 'No department assigned to this manager' });
    }

    const employees = await User.find({ departmentId: department._id }).select(
      '-password'
    );

    return res.status(200).json({
      departmentId: department._id,
      employees,
    });
  } catch (error) {
    console.error('Get my department employees error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// HR/Admin: list employees in a department
// GET /api/departments/:id/employees
const getDepartmentEmployees = async (req, res) => {
  try {
    if (!hasRole(req.user, ['hr', 'admin', 'manager'])) {
      return res.status(403).json({ message: 'Not authorized to view employees' });
    }

    const departmentId = req.params.id;

    const department = await Department.findById(departmentId);
    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    // If manager, ensure they own this department
    if (req.user.role === 'manager' && String(department.managerId) !== String(req.user._id)) {
      return res
        .status(403)
        .json({ message: 'Managers can only view employees in their own department' });
    }

    const employees = await User.find({ departmentId }).select('-password');

    return res.status(200).json({
      departmentId,
      employees,
    });
  } catch (error) {
    console.error('Get department employees error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createDepartment,
  getDepartments,
  getDepartmentById,
  updateDepartment,
  deleteDepartment,
  getMyDepartment,
  assignEmployeeToDepartment,
  getMyDepartmentEmployees,
  getDepartmentEmployees,
};


