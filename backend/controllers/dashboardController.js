const User = require('../models/User');
const Department = require('../models/Department');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const Payroll = require('../models/Payroll');

const isAdmin = (user) => user.role === 'admin';
const isHR = (user) => user.role === 'hr';
const isManager = (user) => user.role === 'manager';
const isEmployee = (user) => user.role === 'employee';

// Helper: Get start and end of today
const getTodayRange = () => {
  const today = new Date();
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

// Helper: Get current month/year
const getCurrentMonthYear = () => {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
};

// Helper: Get employee IDs for manager's department/team
const getManagedEmployeeIds = async (manager) => {
  const employees = await User.find({
    $or: [{ departmentId: manager.departmentId }, { managerId: manager._id }],
  }).select('_id');
  return employees.map((e) => e._id);
};

// 1. Company-level dashboard (Admin)
// GET /api/dashboard/company
const getCompanyDashboard = async (req, res) => {
  try {
    const user = req.user;

    if (!isAdmin(user)) {
      return res.status(403).json({ message: 'Only admin can view company dashboard' });
    }

    const { start, end } = getTodayRange();
    const { month, year } = getCurrentMonthYear();

    // Employee statistics
    const totalEmployees = await User.countDocuments();
    const activeEmployees = await User.countDocuments({ status: 'active' });
    const inactiveEmployees = await User.countDocuments({ status: 'inactive' });
    const totalDepartments = await Department.countDocuments();

    // Attendance summary for today
    const todayAttendance = await Attendance.find({
      date: { $gte: start, $lte: end },
    });

    const presentToday = todayAttendance.filter((a) => a.status === 'present').length;
    const absentToday = todayAttendance.filter((a) => a.status === 'absent').length;
    const lateToday = todayAttendance.filter((a) => a.status === 'late').length;

    // Leave summary
    const totalLeaves = await Leave.countDocuments();
    const pendingLeaves = await Leave.countDocuments({ status: 'pending' });
    const approvedLeaves = await Leave.countDocuments({ status: 'approved' });
    const rejectedLeaves = await Leave.countDocuments({ status: 'rejected' });

    // Payroll summary for current month
    const currentMonthPayrolls = await Payroll.find({ month, year });
    const totalSalaryExpense = currentMonthPayrolls.reduce(
      (sum, p) => sum + (p.netSalary || 0),
      0
    );
    const employeesPaidThisMonth = currentMonthPayrolls.length;

    return res.status(200).json({
      totalEmployees,
      totalDepartments,
      activeEmployees,
      inactiveEmployees,
      attendanceSummary: {
        presentToday,
        absentToday,
        lateToday,
      },
      leaveSummary: {
        total: totalLeaves,
        pending: pendingLeaves,
        approved: approvedLeaves,
        rejected: rejectedLeaves,
      },
      payrollSummary: {
        totalSalaryExpense,
        employeesPaidThisMonth,
        month,
        year,
      },
    });
  } catch (error) {
    console.error('Get company dashboard error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// 2. Department-level dashboard (Manager)
// GET /api/dashboard/department
const getDepartmentDashboard = async (req, res) => {
  try {
    const user = req.user;

    if (!isManager(user)) {
      return res.status(403).json({ message: 'Only managers can view department dashboard' });
    }

    const { start, end } = getTodayRange();
    const { month, year } = getCurrentMonthYear();

    const managedEmployeeIds = await getManagedEmployeeIds(user);

    // Department employee statistics
    const totalEmployees = managedEmployeeIds.length;
    const activeEmployees = await User.countDocuments({
      _id: { $in: managedEmployeeIds },
      status: 'active',
    });
    const inactiveEmployees = totalEmployees - activeEmployees;

    // Attendance summary for today (team only)
    const todayAttendance = await Attendance.find({
      employeeId: { $in: managedEmployeeIds },
      date: { $gte: start, $lte: end },
    });

    const presentToday = todayAttendance.filter((a) => a.status === 'present').length;
    const absentToday = todayAttendance.filter((a) => a.status === 'absent').length;
    const lateToday = todayAttendance.filter((a) => a.status === 'late').length;

    // Leave summary (team only)
    const teamLeaves = await Leave.find({ employeeId: { $in: managedEmployeeIds } });
    const totalLeaves = teamLeaves.length;
    const pendingLeaves = teamLeaves.filter((l) => l.status === 'pending').length;
    const approvedLeaves = teamLeaves.filter((l) => l.status === 'approved').length;
    const rejectedLeaves = teamLeaves.filter((l) => l.status === 'rejected').length;

    // Payroll summary for current month (team only)
    const currentMonthPayrolls = await Payroll.find({
      employeeId: { $in: managedEmployeeIds },
      month,
      year,
    });
    const totalSalaryExpense = currentMonthPayrolls.reduce(
      (sum, p) => sum + (p.netSalary || 0),
      0
    );
    const employeesPaidThisMonth = currentMonthPayrolls.length;

    return res.status(200).json({
      totalEmployees,
      activeEmployees,
      inactiveEmployees,
      attendanceSummary: {
        presentToday,
        absentToday,
        lateToday,
      },
      leaveSummary: {
        total: totalLeaves,
        pending: pendingLeaves,
        approved: approvedLeaves,
        rejected: rejectedLeaves,
      },
      payrollSummary: {
        totalSalaryExpense,
        employeesPaidThisMonth,
        month,
        year,
      },
    });
  } catch (error) {
    console.error('Get department dashboard error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// 3. Personal dashboard (Employee)
// GET /api/dashboard/personal
const getPersonalDashboard = async (req, res) => {
  try {
    const user = req.user;

    if (!isEmployee(user)) {
      return res.status(403).json({ message: 'Only employees can view personal dashboard' });
    }

    const { start, end } = getTodayRange();
    const { month, year } = getCurrentMonthYear();

    // Personal attendance summary
    const todayAttendance = await Attendance.findOne({
      employeeId: user._id,
      date: { $gte: start, $lte: end },
    });

    const attendanceStatus = todayAttendance
      ? todayAttendance.status
      : 'absent';
    const hasCheckedIn = !!todayAttendance?.checkIn;
    const hasCheckedOut = !!todayAttendance?.checkOut;

    // Personal leave history
    const personalLeaves = await Leave.find({ employeeId: user._id })
      .sort({ startDate: -1 })
      .limit(10);
    const totalLeaves = await Leave.countDocuments({ employeeId: user._id });
    const pendingLeaves = await Leave.countDocuments({
      employeeId: user._id,
      status: 'pending',
    });
    const approvedLeaves = await Leave.countDocuments({
      employeeId: user._id,
      status: 'approved',
    });

    // Personal payroll history
    const personalPayrolls = await Payroll.find({ employeeId: user._id })
      .sort({ year: -1, month: -1 })
      .limit(12);
    const currentMonthPayroll = await Payroll.findOne({
      employeeId: user._id,
      month,
      year,
    });

    return res.status(200).json({
      attendanceSummary: {
        status: attendanceStatus,
        hasCheckedIn,
        hasCheckedOut,
        checkIn: todayAttendance?.checkIn || null,
        checkOut: todayAttendance?.checkOut || null,
      },
      leaveSummary: {
        total: totalLeaves,
        pending: pendingLeaves,
        approved: approvedLeaves,
        recentLeaves: personalLeaves,
      },
      payrollSummary: {
        currentMonth: currentMonthPayroll
          ? {
              baseSalary: currentMonthPayroll.baseSalary,
              allowances: currentMonthPayroll.allowances,
              deductions: currentMonthPayroll.deductions,
              netSalary: currentMonthPayroll.netSalary,
              month: currentMonthPayroll.month,
              year: currentMonthPayroll.year,
            }
          : null,
        history: personalPayrolls.map((p) => ({
          baseSalary: p.baseSalary,
          allowances: p.allowances,
          deductions: p.deductions,
          netSalary: p.netSalary,
          month: p.month,
          year: p.year,
        })),
      },
    });
  } catch (error) {
    console.error('Get personal dashboard error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// 4. HR Dashboard (HR)
// GET /api/dashboard/hr
const getHRDashboard = async (req, res) => {
  try {
    const user = req.user;

    if (!isHR(user) && !isAdmin(user)) {
      return res.status(403).json({ message: 'Only HR or Admin can view HR dashboard' });
    }

    const { start, end } = getTodayRange();
    const { month, year } = getCurrentMonthYear();

    // Employee statistics
    const totalEmployees = await User.countDocuments();
    const activeEmployees = await User.countDocuments({ status: 'active' });
    const inactiveEmployees = await User.countDocuments({ status: 'inactive' });
    const totalDepartments = await Department.countDocuments();

    // Attendance summary for today
    const todayAttendance = await Attendance.find({
      date: { $gte: start, $lte: end },
    });

    const presentToday = todayAttendance.filter((a) => a.status === 'present').length;
    const absentToday = todayAttendance.filter((a) => a.status === 'absent').length;
    const lateToday = todayAttendance.filter((a) => a.status === 'late').length;

    // Leave summary
    const totalLeaves = await Leave.countDocuments();
    const pendingLeaves = await Leave.countDocuments({ status: 'pending' });
    const approvedLeaves = await Leave.countDocuments({ status: 'approved' });
    const rejectedLeaves = await Leave.countDocuments({ status: 'rejected' });

    // Payroll summary for current month
    const currentMonthPayrolls = await Payroll.find({ month, year });
    const totalSalaryExpense = currentMonthPayrolls.reduce(
      (sum, p) => sum + (p.netSalary || 0),
      0
    );
    const employeesPaidThisMonth = currentMonthPayrolls.length;

    return res.status(200).json({
      totalEmployees,
      totalDepartments,
      activeEmployees,
      inactiveEmployees,
      attendanceSummary: {
        presentToday,
        absentToday,
        lateToday,
      },
      leaveSummary: {
        total: totalLeaves,
        pending: pendingLeaves,
        approved: approvedLeaves,
        rejected: rejectedLeaves,
      },
      payrollSummary: {
        totalSalaryExpense,
        employeesPaidThisMonth,
        month,
        year,
      },
    });
  } catch (error) {
    console.error('Get HR dashboard error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Universal dashboard endpoint that returns appropriate dashboard based on role
// GET /api/dashboard
const getDashboard = async (req, res) => {
  try {
    const user = req.user;

    if (isAdmin(user)) {
      return getCompanyDashboard(req, res);
    } else if (isHR(user)) {
      return getHRDashboard(req, res);
    } else if (isManager(user)) {
      return getDepartmentDashboard(req, res);
    } else if (isEmployee(user)) {
      return getPersonalDashboard(req, res);
    } else {
      return res.status(403).json({ message: 'Invalid user role' });
    }
  } catch (error) {
    console.error('Get dashboard error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getCompanyDashboard,
  getDepartmentDashboard,
  getPersonalDashboard,
  getHRDashboard,
  getDashboard,
};

