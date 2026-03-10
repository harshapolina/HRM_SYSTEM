const Attendance = require('../models/Attendance');
const User = require('../models/User');

const isAdmin = (user) => user.role === 'admin';
const isHR = (user) => user.role === 'hr';
const isManager = (user) => user.role === 'manager';
const isEmployee = (user) => user.role === 'employee';

const startOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

// 1. Employee check-in
// POST /api/attendance/check-in
const checkIn = async (req, res) => {
  try {
    const user = req.user;

    if (!isEmployee(user) && !isManager(user) && !isHR(user) && !isAdmin(user)) {
      return res.status(403).json({ message: 'Not allowed to perform check-in' });
    }

    const todayStart = startOfDay();
    const todayEnd = endOfDay();

    const existing = await Attendance.findOne({
      employeeId: user._id,
      date: { $gte: todayStart, $lte: todayEnd },
    });

    if (existing && existing.checkIn) {
      return res
        .status(400)
        .json({ message: 'Already checked in for today' });
    }

    const now = new Date();

    let attendance;
    if (existing) {
      existing.checkIn = now;
      attendance = await existing.save();
    } else {
      attendance = await Attendance.create({
        employeeId: user._id,
        date: now,
        checkIn: now,
        status: 'present',
      });
    }

    return res.status(200).json({
      message: 'Check-in successful',
      attendance,
    });
  } catch (error) {
    console.error('Check-in error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// 2. Employee check-out
// POST /api/attendance/check-out
const checkOut = async (req, res) => {
  try {
    const user = req.user;

    const todayStart = startOfDay();
    const todayEnd = endOfDay();

    const attendance = await Attendance.findOne({
      employeeId: user._id,
      date: { $gte: todayStart, $lte: todayEnd },
    });

    if (!attendance || !attendance.checkIn) {
      return res
        .status(400)
        .json({ message: 'No check-in record found for today' });
    }

    if (attendance.checkOut) {
      return res
        .status(400)
        .json({ message: 'Already checked out for today' });
    }

    attendance.checkOut = new Date();
    await attendance.save();

    return res.status(200).json({
      message: 'Check-out successful',
      attendance,
    });
  } catch (error) {
    console.error('Check-out error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// 3 & 4. View attendance history (self) and generic listing with filters
// GET /api/attendance (self) or with filters for roles
const getAttendanceRecords = async (req, res) => {
  try {
    const user = req.user;
    const { employeeId, startDate, endDate } = req.query;

    let query = {};

    if (isAdmin(user) || isHR(user)) {
      if (employeeId) {
        query.employeeId = employeeId;
      }
    } else if (isManager(user)) {
      // Managers: can see attendance of employees in their department or who report to them
      let managedEmployeeIds = [];

      const employees = await User.find({
        $or: [
          { departmentId: user.departmentId },
          { managerId: user._id },
        ],
      }).select('_id');

      managedEmployeeIds = employees.map((e) => e._id);

      if (employeeId) {
        // ensure requested employee is in managed list
        if (!managedEmployeeIds.some((id) => String(id) === String(employeeId))) {
          return res.status(403).json({ message: 'Not authorized to view this employee' });
        }
        query.employeeId = employeeId;
      } else {
        query.employeeId = { $in: managedEmployeeIds };
      }
    } else if (isEmployee(user)) {
      query.employeeId = user._id;
    }

    // Date range filter
    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = startOfDay(new Date(startDate));
      }
      if (endDate) {
        query.date.$lte = endOfDay(new Date(endDate));
      }
    }

    const records = await Attendance.find(query)
      .populate('employeeId', 'name email role departmentId')
      .sort({ date: -1, createdAt: -1 });

    return res.status(200).json(records);
  } catch (error) {
    console.error('Get attendance records error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// 5. HR/Admin correct attendance record
// PUT /api/attendance/:id
const updateAttendanceRecord = async (req, res) => {
  try {
    const user = req.user;

    if (!isAdmin(user) && !isHR(user)) {
      return res
        .status(403)
        .json({ message: 'Only admin or HR can modify attendance records' });
    }

    const { id } = req.params;
    const updateData = { ...req.body };

    // prevent changing employeeId in updates by default
    delete updateData.employeeId;

    const record = await Attendance.findById(id);
    if (!record) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    Object.assign(record, updateData);
    await record.save();

    const updatedRecord = await Attendance.findById(id).populate(
      'employeeId',
      'name email role departmentId'
    );

    return res.status(200).json({
      message: 'Attendance record updated successfully',
      record: updatedRecord,
    });
  } catch (error) {
    console.error('Update attendance record error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  checkIn,
  checkOut,
  getAttendanceRecords,
  updateAttendanceRecord,
};


