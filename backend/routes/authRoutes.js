const express = require('express');
const {
  registerUser,
  loginUser,
  getProfile,
} = require('../controllers/authController');
const { auth, adminOnly } = require('../middleware/authMiddleware');

const router = express.Router();

// Public: login
router.post('/login', loginUser);

// Protected: get current user profile
router.get('/profile', auth, getProfile);

// Protected & admin-only: register new employee/user
router.post('/register', auth, adminOnly, registerUser);

module.exports = router;


