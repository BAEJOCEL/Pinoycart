const express = require('express');
const { body, query } = require('express-validator');
const router = express.Router();
const { db } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { v4: uuidv4 } = require('uuid');

router.get('/', [
  query('category').optional().trim(),
  query('minPrice').optional().isInt({ min: 0 }),
  query('maxPrice').optional().isInt({ min: 0 }),
  query('search').optional().trim(),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
], validate, async (req, res, next) => {
  try {
    const { category, minPrice, maxPrice, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let queryStr = 'SELECT * FROM products WHERE status = \'active\' AND stock > 0';
    const params = [];

    if (category) {
      params.push(category);
      queryStr += ` AND category = $${params.length}`;
    }

    if (minPrice) {
      params.push(minPrice);
      queryStr += ` AND price >= $${params.length}`;
    }

    if (maxPrice) {
      params.push(maxPrice);
      queryStr += ` AND price <= $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      params.push(`%${search}%`);
      queryStr += ` AND (name ILIKE $${params.length - 1} OR description ILIKE $${params.length})`;
    }

    const total = await db.one(`SELECT COUNT(*) as count FROM (${queryStr}) t`, params);
    
    params.push(limit);
    queryStr += ` ORDER BY created_at DESC LIMIT $${params.length}`;
    params.push(offset);
    queryStr += ` OFFSET $${params.length}`;

    const products = await db.manyOrNone(queryStr, params);

    res.json({
      data: products,
      pagination: {
        page,
        limit,
        total: parseInt(total.count),
        pages: Math.ceil(total.count / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:productId', async (req, res, next) => {
  try {
    const product = await db.one(
      `SELECT p.*, u.first_name, u.last_name, u.avatar_url,
       (SELECT AVG(rating) FROM reviews WHERE product_id = $1) as avg_rating,
       (SELECT COUNT(*) FROM reviews WHERE product_id = $1) as review_count
       FROM products p
       JOIN users u ON p.seller_id = u.id
       WHERE p.id = $1 AND p.status = 'active'`,
      [req.params.productId]
    );
    res.json(product);
  } catch (error) {
    res.status(404).json({ error: 'Product not found' });
  }
});

router.post('/', authenticate, authorize(['seller', 'admin']), [
  body('name').notEmpty().trim(),
  body('description').notEmpty().trim(),
  body('price').isFloat({ min: 0 }),
  body('category').notEmpty().trim(),
  body('stock').isInt({ min: 0 })
], validate, async (req, res, next) => {
  try {
    const { name, description, price, category, stock } = req.body;
    const productId = uuidv4();

    const product = await db.one(
      `INSERT INTO products (id, seller_id, name, description, price, category, stock, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', NOW())
       RETURNING *`,
      [productId, req.user.id, name, description, price, category, stock]
    );

    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
});

router.put('/:productId', authenticate, authorize(['seller', 'admin']), async (req, res, next) => {
  try {
    const { productId } = req.params;
    const product = await db.oneOrNone('SELECT seller_id FROM products WHERE id = $1', [productId]);

    if (!product || (req.user.role === 'seller' && product.seller_id !== req.user.id)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const updated = await db.one(
      `UPDATE products SET name = COALESCE($2, name), 
       description = COALESCE($3, description),
       price = COALESCE($4, price),
       stock = COALESCE($5, stock),
       updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [productId, req.body.name, req.body.description, req.body.price, req.body.stock]
    );

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
