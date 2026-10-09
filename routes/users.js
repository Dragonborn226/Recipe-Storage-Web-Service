const express = require('express');
const User = require('../models/User');
const Recipe = require('../models/Recipe');
const { asyncHandler, validateObjectId } = require('../middleware/errorHandler');

const router = express.Router();

// POST /api/users - create user
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { username, email } = req.body || {};
    const user = await User.create({ username, email });
    res.status(201).json(user);
  })
);

// GET /api/users - all users (frontend uses this for the author dropdown)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const users = await User.find().sort({ username: 1 });
    res.status(200).json(users);
  })
);

// GET /api/users/:id/recipes - recipes written by a user
router.get(
  '/:id/recipes',
  validateObjectId,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const recipes = await Recipe.find({ author: user._id })
      .populate('author', 'username email')
      .populate('category', 'name')
      .sort({ createdAt: -1 });
    res.status(200).json(recipes);
  })
);

module.exports = router;
