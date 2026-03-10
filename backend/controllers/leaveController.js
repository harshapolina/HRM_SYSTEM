const Leave = require('../models/Leave');
const User = require('../models/User');

const isAdmin = (user) => user.role === 'admin';
const isHR = (user) => user.role === 'hr';
const isManager = (user) => user.role === 'manager';
const isEmployee = (user) => user.role === 'employee';

// 1. Employee submit leave request
// POST /api/leaves
const createLeaveRequest = async (req, res) => {
  try {
    const user = req.user;

    if (!isEmployee(user) && !isManager(user) && !isHR(user) && !isAdmin(user)) {
      return res.status(403).json({ message: 'Not allowed to create leave request' });
    }

    const { leaveType, startDate, endDate, reason } = req.body;

    if (!leaveType || !startDate || !endDate || !reason) {
      return res
        .status(400)
        .json({ message: 'leaveType, startDate, endDate and reason are required' });
    }

    const leave = await Leave.create({
      employeeId: user._id,
      leaveType,
      startDate,
      endDate,
      reason,
      status: 'pending',
    });

    return res.status(201).json({
      message: 'Leave request submitted successfully',
      leave,
    });
  } catch (error) {
    console.error('Create leave request error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// 2. View leave history for a specific employee (self / HR / Admin / Manager for their employees)
// GET /api/leaves/employee/:employeeId
const getEmployeeLeaves = async (req, res) => {
  try {
    const user = req.user;
    const { employeeId } = req.params;

    // Self
    if (isEmployee(user) && String(user._id) !== String(employeeId)) {
      return res.status(403).json({ message: 'Not authorized to view this leave history' });
    }

    if (isManager(user)) {
      // ensure employee is in manager's team / department
      const employee = await User.findById(employeeId);
      if (!employee) {
        return res.status(404).json({ message: 'Employee not found' });
      }

      const sameDept =
        user.departmentId &&
        employee.departmentId &&
        String(user.departmentId) === String(employee.departmentId);
      const reportsToManager =
        employee.managerId && String(employee.managerId) === String(user._id);

      if (!sameDept && !reportsToManager) {
        return res.status(403).json({ message: 'Not authorized to view this leave history' });
      }
    }

    // HR/Admin can view any employee

    const leaves = await Leave.find({ employeeId })
      .sort({ startDate: -1, createdAt: -1 })
      .populate('approvedBy', 'name email role');

    return res.status(200).json(leaves);
  } catch (error) {
    console.error('Get employee leaves error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Helper to build query for list API
const buildLeaveQueryForUser = async (user, { employeeId, status }) => {
  let query = {};

  if (isAdmin(user) || isHR(user)) {
    if (employeeId) {
      query.employeeId = employeeId;
    }
  } else if (isManager(user)) {
    // manager sees their team/department
    let managedEmployeeIds = [];
    const employees = await User.find({
      $or: [
        { departmentId: user.departmentId },
        { managerId: user._id },
      ],
    }).select('_id');

    managedEmployeeIds = employees.map((e) => e._id);

    if (employeeId) {
      if (!managedEmployeeIds.some((id) => String(id) === String(employeeId))) {
        throw new Error('NOT_AUTH_EMPLOYEE');
      }
      query.employeeId = employeeId;
    } else {
      query.employeeId = { $in: managedEmployeeIds };
    }
  } else if (isEmployee(user)) {
    // employee: only own leaves
    query.employeeId = user._id;
  }

  if (status) {
    query.status = status;
  }

  return query;
};

// 5 & 6. View leave records with filters (HR/Admin all, Manager team, Employee self)
// GET /api/leaves
const listLeaves = async (req, res) => {
  try {
    const user = req.user;
    const { employeeId, status } = req.query;

    let query;
    try {
      query = await buildLeaveQueryForUser(user, { employeeId, status });
    } catch (err) {
      if (err.message === 'NOT_AUTH_EMPLOYEE') {
        return res.status(403).json({ message: 'Not authorized to view this employee' });
      }
      throw err;
    }

    const leaves = await Leave.find(query)
      .sort({ startDate: -1, createdAt: -1 })
      .populate('employeeId', 'name email role departmentId')
      .populate('approvedBy', 'name email role');

    return res.status(200).json(leaves);
  } catch (error) {
    console.error('List leaves error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// 3 & 4. Manager/HR review, approve or reject leave
// PATCH /api/leaves/:id/status
const updateLeaveStatus = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { status } = req.body;

    if (!isManager(user) && !isHR(user) && !isAdmin(user)) {
      return res
        .status(403)
        .json({ message: 'Only manager, HR, or admin can update leave status' });
    }

    if (!['approved', 'rejected'].includes(status)) {
      return res
        .status(400)
        .json({ message: 'Status must be approved or rejected' });
    }

    const leave = await Leave.findById(id).populate('employeeId');
    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    // Managers can only act on their team/department
    if (isManager(user)) {
      const employee = leave.employeeId;
      const sameDept =
        user.departmentId &&
        employee.departmentId &&
        String(user.departmentId) === String(employee.departmentId);
      const reportsToManager =
        employee.managerId && String(employee.managerId) === String(user._id);

      if (!sameDept && !reportsToManager) {
        return res
          .status(403)
          .json({ message: 'Not authorized to approve/reject this request' });
      }
    }

    leave.status = status;
    leave.approvedBy = user._id;
    await leave.save();

    const updated = await Leave.findById(id)
      .populate('employeeId', 'name email role departmentId')
      .populate('approvedBy', 'name email role');

    return res.status(200).json({
      message: `Leave request ${status}`,
      leave: updated,
    });
  } catch (error) {
    console.error('Update leave status error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createLeaveRequest,
  getEmployeeLeaves,
  listLeaves,
  updateLeaveStatus,
};


