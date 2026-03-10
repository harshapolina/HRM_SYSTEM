const User = require('../models/User');

const isAdmin = (user) => user.role === 'admin';
const isHR = (user) => user.role === 'hr';
const isManager = (user) => user.role === 'manager';
const isEmployee = (user) => user.role === 'employee';

// 1. Create new employee (Admin & HR)
// POST /api/employees
const createEmployee = async (req, res) => {
  try {
    if (!(isAdmin(req.user) || isHR(req.user))) {
      return res.status(403).json({ message: 'Only admin or HR can create employees' });
    }

    const {
      name,
      email,
      password,
      role,
      departmentId,
      managerId,
      phone,
      address,
      joiningDate,
      salary,
      status,
    } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: 'Name, email and password are required' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'Employee with this email already exists' });
    }

    const user = new User({
      name,
      email,
      password, // hashed by pre-save hook
      role: role || 'employee',
      departmentId,
      managerId,
      phone,
      address,
      joiningDate,
      salary,
      status,
    });

    await user.save();

    const safeUser = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId,
      managerId: user.managerId,
      phone: user.phone,
      address: user.address,
      joiningDate: user.joiningDate,
      salary: user.salary,
      status: user.status,
    };

    return res.status(201).json({
      message: 'Employee created successfully',
      employee: safeUser,
    });
  } catch (error) {
    console.error('Create employee error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// 2. List employees with search/filter
// GET /api/employees
const listEmployees = async (req, res) => {
  try {
    const user = req.user;

    let query = {};

    // Base access control:
    if (isAdmin(user) || isHR(user)) {
      // can view all; no base restriction
    } else if (isManager(user)) {
      // view employees in their department or who report to them
      query.$or = [
        { departmentId: user.departmentId },
        { managerId: user._id },
      ];
    } else if (isEmployee(user)) {
      // employee: can only view self
      query._id = user._id;
    }

    // Search and filters
    const { search, department, role } = req.query;

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$and = (query.$and || []).concat([
        {
          $or: [{ name: searchRegex }, { email: searchRegex }],
        },
      ]);
    }

    if (department) {
      query.$and = (query.$and || []).concat([{ departmentId: department }]);
    }

    if (role) {
      query.$and = (query.$and || []).concat([{ role }]);
    }

    const employees = await User.find(query).select('-password').sort({ createdAt: -1 });

    return res.status(200).json(employees);
  } catch (error) {
    console.error('List employees error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// 3. Get single employee details
// GET /api/employees/:id
const getEmployeeById = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const employee = await User.findById(id).select('-password');
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Access control:
    if (isAdmin(user) || isHR(user)) {
      // ok
    } else if (isManager(user)) {
      const sameDept =
        user.departmentId && employee.departmentId &&
        String(user.departmentId) === String(employee.departmentId);
      const reportsToManager = employee.managerId && String(employee.managerId) === String(user._id);

      if (!sameDept && !reportsToManager) {
        return res.status(403).json({ message: 'Not authorized to view this employee' });
      }
    } else if (isEmployee(user)) {
      if (String(user._id) !== String(employee._id)) {
        return res
          .status(403)
          .json({ message: 'Employees cannot access other employee records' });
      }
    }

    return res.status(200).json(employee);
  } catch (error) {
    console.error('Get employee error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// 4. Update employee information
// PUT /api/employees/:id
const updateEmployee = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const updateData = { ...req.body };

    // Prevent role/status changes by normal employees when updating themselves
    if (isEmployee(user)) {
      if (String(user._id) !== String(id)) {
        return res
          .status(403)
          .json({ message: 'Employees cannot update other employee records' });
      }

      // Allow only limited fields for self-update
      const allowedFields = ['phone', 'address', 'profileImage'];
      Object.keys(updateData).forEach((key) => {
        if (!allowedFields.includes(key)) {
          delete updateData[key];
        }
      });
    } else if (isManager(user)) {
      // Managers can view but not arbitrarily update others in this spec,
      // so we restrict them similar to employees for now (self-only).
      if (String(user._id) !== String(id)) {
        return res
          .status(403)
          .json({ message: 'Managers cannot update other employees via this endpoint' });
      }

      const allowedFields = ['phone', 'address', 'profileImage'];
      Object.keys(updateData).forEach((key) => {
        if (!allowedFields.includes(key)) {
          delete updateData[key];
        }
      });
    } else if (isAdmin(user) || isHR(user)) {
      // Admin/HR can update full employee info except password via this endpoint
      delete updateData.password;
      delete updateData.email; // optional: protect email if you like
    }

    const employee = await User.findById(id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    Object.assign(employee, updateData);
    await employee.save();

    const safeEmployee = await User.findById(id).select('-password');

    return res.status(200).json({
      message: 'Employee updated successfully',
      employee: safeEmployee,
    });
  } catch (error) {
    console.error('Update employee error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// 5. Deactivate employee (status -> inactive)
// PATCH /api/employees/:id/deactivate
const deactivateEmployee = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    if (!(isAdmin(user) || isHR(user))) {
      return res
        .status(403)
        .json({ message: 'Only admin or HR can deactivate employees' });
    }

    const employee = await User.findById(id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    employee.status = 'inactive';
    await employee.save();

    const safeEmployee = await User.findById(id).select('-password');

    return res.status(200).json({
      message: 'Employee deactivated successfully',
      employee: safeEmployee,
    });
  } catch (error) {
    console.error('Deactivate employee error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// 6. Delete employee
// DELETE /api/employees/:id
const deleteEmployee = async (req, res) => {
  try {
    const user = req.user;

    if (!isAdmin(user)) {
      return res.status(403).json({ message: 'Only admin can delete employees' });
    }

    const { id } = req.params;
    const employee = await User.findById(id);

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    await employee.deleteOne();

    return res.status(200).json({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('Delete employee error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createEmployee,
  listEmployees,
  getEmployeeById,
  updateEmployee,
  deactivateEmployee,
  deleteEmployee,
};


