const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const authService = {
  hashPassword: async (password) => {
    return await bcrypt.hash(password, 12);
  },

  comparePassword: async (password, hash) => {
    return await bcrypt.compare(password, hash);
  },

  generateTokens: (userId) => {
    const accessToken = jwt.sign(
      { userId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    const refreshToken = jwt.sign(
      { userId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRE || '30d' }
    );

    return { accessToken, refreshToken };
  },

  register: async (email, password, firstName, lastName, role = 'buyer') => {
    // Check if user exists
    const existing = await db.oneOrNone(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existing) {
      throw new Error('Email already registered');
    }

    const userId = uuidv4();
    const hashedPassword = await authService.hashPassword(password);

    const user = await db.one(
      `INSERT INTO users (id, email, password, first_name, last_name, role, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING id, email, first_name, last_name, role`,
      [userId, email.toLowerCase(), hashedPassword, firstName, lastName, role, 'active']
    );

    const tokens = authService.generateTokens(userId);
    return { user, tokens };
  },

  login: async (email, password) => {
    const user = await db.oneOrNone(
      'SELECT id, email, password, first_name, last_name, role, status FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (!user) {
      throw new Error('Invalid credentials');
    }

    if (user.status !== 'active') {
      throw new Error('Account is not active');
    }

    const isMatch = await authService.comparePassword(password, user.password);
    if (!isMatch) {
      throw new Error('Invalid credentials');
    }

    const tokens = authService.generateTokens(user.id);
    
    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role
      },
      tokens
    };
  }
};

module.exports = authService;
