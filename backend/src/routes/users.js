const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { db } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

router.get('/profile', authenticate, async (req, res, next) => {
  try {
    const user = await db.one(
      'SELECT id, email, first_name, last_name, phone, role, status, avatar_url, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json(user);
  } catch (error) {
    next(error);
  }
});

router.put('/profile', authenticate, [
  body('firstName').optional().trim(),
  body('lastName').optional().trim(),
  body('phone').optional()
], validate, async (req, res, next) => {
  try {
    const { firstName, lastName, phone } = req.body;
    const user = await db.one(
      `UPDATE users SET first_name = COALESCE($2, first_name), 
       last_name = COALESCE($3, last_name), 
       phone = COALESCE($4, phone), 
       updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, first_name, last_name, phone, role`,
      [req.user.id, firstName, lastName, phone]
    );
    res.json(user);
  } catch (error) {
    next(error);
  }
});

router.get('/:userId/public', async (req, res, next) => {
  try {
    const user = await db.oneOrNone(
      `SELECT id, first_name, last_name, avatar_url, role, 
       (SELECT COUNT(*) FROM products WHERE seller_id = $1) as product_count,
       (SELECT AVG(rating) FROM reviews WHERE seller_id = $1) as avg_rating
       FROM users WHERE id = $1`,
      [req.params.userId]
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
