const express = require('express');
const {
  checkIn,
  checkOut,
  getAttendanceRecords,
  updateAttendanceRecord,
} = require('../controllers/attendanceController');
const { auth } = require('../middleware/authMiddleware');

const router = express.Router();

// All attendance routes require authentication
router.use(auth);

// 1. Employee check-in
router.post('/check-in', checkIn);

// 2. Employee check-out
router.post('/check-out', checkOut);

// 3,4,5,6. View attendance records (self / team / all) with filters
router.get('/', getAttendanceRecords);

// 5. HR/Admin correct attendance record
router.put('/:id', updateAttendanceRecord);

module.exports = router;


