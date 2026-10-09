const express = require('express');
const Category = require('../models/Category');
const Recipe = require('../models/Recipe');
const { asyncHandler, validateObjectId } = require('../middleware/errorHandler');

const router = express.Router();

// POST /api/categories - create category
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const category = await Category.create({ name: (req.body || {}).name });
    res.status(201).json(category);
  })
);

// GET /api/categories - all categories
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const categories = await Category.find().sort({ name: 1 });
    res.status(200).json(categories);
  })
);

// GET /api/categories/:id/recipes - recipes in a category
router.get(
  '/:id/recipes',
  validateObjectId,
  asyncHandler(async (req, res) => {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ error: 'Category not found' });

    const recipes = await Recipe.find({ category: category._id })
      .populate('author', 'username email')
      .populate('category', 'name')
      .sort({ createdAt: -1 });
    res.status(200).json(recipes);
  })
);

module.exports = router;
