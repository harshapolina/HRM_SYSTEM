const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Helper to generate JWT
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// POST /api/auth/register  (admin only)
const registerUser = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
      departmentId,
      managerId,
      phone,
      address,
      profileImage,
      joiningDate,
      salary,
      status,
    } = req.body;

    // Only admin can register new employees - enforced by middleware,
    // but we keep this as an extra guard.
    if (!req.user || req.user.role !== 'admin') {
      return res
        .status(403)
        .json({ message: 'Only admin can register new employees' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = new User({
      name,
      email,
      password, // will be hashed by User schema pre-save hook
      role,
      departmentId,
      managerId,
      phone,
      address,
      profileImage,
      joiningDate,
      salary,
      status,
    });

    await user.save();

    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId,
      managerId: user.managerId,
      phone: user.phone,
      address: user.address,
      profileImage: user.profileImage,
      joiningDate: user.joiningDate,
      salary: user.salary,
      status: user.status,
    };

    return res.status(201).json({
      message: 'User registered successfully',
      user: userData,
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/auth/login
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user);

    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId,
      managerId: user.managerId,
      phone: user.phone,
      address: user.address,
      profileImage: user.profileImage,
      joiningDate: user.joiningDate,
      salary: user.salary,
      status: user.status,
    };

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: userData,
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/auth/profile
const getProfile = async (req, res) => {
  try {
    // req.user is attached by auth middleware
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    return res.status(200).json({
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      departmentId: req.user.departmentId,
      managerId: req.user.managerId,
      phone: req.user.phone,
      address: req.user.address,
      profileImage: req.user.profileImage,
      joiningDate: req.user.joiningDate,
      salary: req.user.salary,
      status: req.user.status,
      createdAt: req.user.createdAt,
      updatedAt: req.user.updatedAt,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getProfile,
};


