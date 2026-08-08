const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { db } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

router.get('/', authenticate, async (req, res, next) => {
  try {
    const items = await db.manyOrNone(
      `SELECT c.id, p.id as product_id, p.name, p.price, c.quantity,
       (p.price * c.quantity) as subtotal, p.stock
       FROM cart_items c
       JOIN products p ON c.product_id = p.id
       WHERE c.user_id = $1
       ORDER BY c.created_at DESC`,
      [req.user.id]
    );

    const total = items.reduce((sum, item) => sum + (item.subtotal || 0), 0);

    res.json({
      items,
      total,
      count: items.length
    });
  } catch (error) {
    next(error);
  }
});

router.post('/add', authenticate, [
  body('productId').notEmpty(),
  body('quantity').isInt({ min: 1 })
], validate, async (req, res, next) => {
  try {
    const { productId, quantity } = req.body;

    const product = await db.oneOrNone(
      'SELECT id, stock FROM products WHERE id = $1 AND status = \'active\'',
      [productId]
    );

    if (!product || product.stock < quantity) {
      return res.status(400).json({ error: 'Product unavailable' });
    }

    const item = await db.oneOrNone(
      'SELECT id, quantity FROM cart_items WHERE user_id = $1 AND product_id = $2',
      [req.user.id, productId]
    );

    if (item) {
      await db.none(
        'UPDATE cart_items SET quantity = quantity + $3 WHERE id = $1',
        [item.id, productId, quantity]
      );
    } else {
      await db.none(
        'INSERT INTO cart_items (user_id, product_id, quantity, created_at) VALUES ($1, $2, $3, NOW())',
        [req.user.id, productId, quantity]
      );
    }

    res.status(201).json({ message: 'Added to cart' });
  } catch (error) {
    next(error);
  }
});

router.delete('/:itemId', authenticate, async (req, res, next) => {
  try {
    await db.none(
      'DELETE FROM cart_items WHERE id = $1 AND user_id = $2',
      [req.params.itemId, req.user.id]
    );
    res.json({ message: 'Item removed' });
  } catch (error) {
    next(error);
  }
});

router.delete('/', authenticate, async (req, res, next) => {
  try {
    await db.none('DELETE FROM cart_items WHERE user_id = $1', [req.user.id]);
    res.json({ message: 'Cart cleared' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
