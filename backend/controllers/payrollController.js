const Payroll = require('../models/Payroll');
const User = require('../models/User');

const isAdmin = (user) => user.role === 'admin';
const isHR = (user) => user.role === 'hr';
const isManager = (user) => user.role === 'manager';
const isEmployee = (user) => user.role === 'employee';

// 1. Generate payroll record for an employee (Admin & HR)
// POST /api/payroll
const generatePayroll = async (req, res) => {
  try {
    const user = req.user;

    if (!isAdmin(user) && !isHR(user)) {
      return res.status(403).json({ message: 'Only admin or HR can generate payroll' });
    }

    const { employeeId, baseSalary, allowances, deductions, month, year } = req.body;

    if (!employeeId || baseSalary === undefined || !month || !year) {
      return res
        .status(400)
        .json({ message: 'employeeId, baseSalary, month, and year are required' });
    }

    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Check if payroll already exists for this month/year
    const existing = await Payroll.findOne({
      employeeId,
      month,
      year,
    });

    if (existing) {
      return res
        .status(400)
        .json({ message: 'Payroll already exists for this employee for the specified month/year' });
    }

    const payroll = await Payroll.create({
      employeeId,
      baseSalary: baseSalary || employee.salary || 0,
      allowances: allowances || 0,
      deductions: deductions || 0,
      month,
      year,
      generatedBy: user._id,
    });

    const populatedPayroll = await Payroll.findById(payroll._id)
      .populate('employeeId', 'name email role departmentId')
      .populate('generatedBy', 'name email role');

    return res.status(201).json({
      message: 'Payroll generated successfully',
      payroll: populatedPayroll,
    });
  } catch (error) {
    console.error('Generate payroll error:', error);
    if (error.code === 11000) {
      return res
        .status(400)
        .json({ message: 'Payroll already exists for this employee for the specified month/year' });
    }
    return res.status(500).json({ message: 'Server error' });
  }
};

// 3. Update payroll record (Admin & HR)
// PUT /api/payroll/:id
const updatePayroll = async (req, res) => {
  try {
    const user = req.user;

    if (!isAdmin(user) && !isHR(user)) {
      return res.status(403).json({ message: 'Only admin or HR can update payroll' });
    }

    const { id } = req.params;
    const { baseSalary, allowances, deductions } = req.body;

    const payroll = await Payroll.findById(id);
    if (!payroll) {
      return res.status(404).json({ message: 'Payroll record not found' });
    }

    if (baseSalary !== undefined) payroll.baseSalary = baseSalary;
    if (allowances !== undefined) payroll.allowances = allowances;
    if (deductions !== undefined) payroll.deductions = deductions;

    // netSalary will be recalculated by pre-save hook
    await payroll.save();

    const updatedPayroll = await Payroll.findById(id)
      .populate('employeeId', 'name email role departmentId')
      .populate('generatedBy', 'name email role');

    return res.status(200).json({
      message: 'Payroll updated successfully',
      payroll: updatedPayroll,
    });
  } catch (error) {
    console.error('Update payroll error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Helper to build query based on user role
const buildPayrollQueryForUser = async (user, { employeeId, month, year }) => {
  let query = {};

  if (isAdmin(user) || isHR(user)) {
    // Can view all payrolls
    if (employeeId) {
      query.employeeId = employeeId;
    }
  } else if (isManager(user)) {
    // Can view payrolls of employees in their department
    const employees = await User.find({
      $or: [{ departmentId: user.departmentId }, { managerId: user._id }],
    }).select('_id');

    const managedEmployeeIds = employees.map((e) => e._id);

    if (employeeId) {
      if (!managedEmployeeIds.some((id) => String(id) === String(employeeId))) {
        throw new Error('NOT_AUTH_EMPLOYEE');
      }
      query.employeeId = employeeId;
    } else {
      query.employeeId = { $in: managedEmployeeIds };
    }
  } else if (isEmployee(user)) {
    // Can only view own payroll
    query.employeeId = user._id;
  }

  if (month) {
    query.month = parseInt(month);
  }

  if (year) {
    query.year = parseInt(year);
  }

  return query;
};

// 4 & 5. View payroll history/reports with filters
// GET /api/payroll
const getPayrollRecords = async (req, res) => {
  try {
    const user = req.user;
    const { employeeId, month, year } = req.query;

    let query;
    try {
      query = await buildPayrollQueryForUser(user, { employeeId, month, year });
    } catch (err) {
      if (err.message === 'NOT_AUTH_EMPLOYEE') {
        return res.status(403).json({ message: 'Not authorized to view this employee payroll' });
      }
      throw err;
    }

    const payrolls = await Payroll.find(query)
      .sort({ year: -1, month: -1, createdAt: -1 })
      .populate('employeeId', 'name email role departmentId')
      .populate('generatedBy', 'name email role');

    return res.status(200).json(payrolls);
  } catch (error) {
    console.error('Get payroll records error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// 4. View specific payroll record
// GET /api/payroll/:id
const getPayrollById = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const payroll = await Payroll.findById(id)
      .populate('employeeId', 'name email role departmentId')
      .populate('generatedBy', 'name email role');

    if (!payroll) {
      return res.status(404).json({ message: 'Payroll record not found' });
    }

    // Access control
    if (isAdmin(user) || isHR(user)) {
      // Can view any payroll
    } else if (isManager(user)) {
      const employee = payroll.employeeId;
      const sameDept =
        user.departmentId &&
        employee.departmentId &&
        String(user.departmentId) === String(employee.departmentId);
      const reportsToManager =
        employee.managerId && String(employee.managerId) === String(user._id);

      if (!sameDept && !reportsToManager) {
        return res.status(403).json({ message: 'Not authorized to view this payroll' });
      }
    } else if (isEmployee(user)) {
      if (String(user._id) !== String(payroll.employeeId._id)) {
        return res.status(403).json({ message: 'Not authorized to view this payroll' });
      }
    }

    return res.status(200).json(payroll);
  } catch (error) {
    console.error('Get payroll by id error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  generatePayroll,
  updatePayroll,
  getPayrollRecords,
  getPayrollById,
};

