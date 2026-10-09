const express = require('express');
const mongoose = require('mongoose');
const Recipe = require('../models/Recipe');
const User = require('../models/User');
const Category = require('../models/Category');
const { asyncHandler, validateObjectId } = require('../middleware/errorHandler');

const router = express.Router();

const populateFields = [
  { path: 'author', select: 'username email' },
  { path: 'category', select: 'name' },
];

// Confirms referenced author/category exist. Returns an error message or null.
async function checkReferences({ author, category }) {
  if (author !== undefined) {
    if (!mongoose.Types.ObjectId.isValid(author)) return 'Invalid author ID';
    if (!(await User.exists({ _id: author }))) return 'Author does not exist';
  }
  if (category !== undefined && category !== null) {
    if (!mongoose.Types.ObjectId.isValid(category)) return 'Invalid category ID';
    if (!(await Category.exists({ _id: category }))) return 'Category does not exist';
  }
  return null;
}

// Lets the frontend send ingredients as an array or a newline/comma-separated string.
function normalizeIngredients(value) {
  if (typeof value === 'string') {
    return value.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
  }
  return value;
}

// Frontend sends instructions as an array of steps; store them as one newline-separated string.
function normalizeInstructions(value) {
  if (Array.isArray(value)) {
    return value.filter((s) => typeof s === 'string').map((s) => s.trim()).filter(Boolean).join('\n');
  }
  return value;
}

// POST /api/recipes - create recipe
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { title, ingredients, instructions, cookingTime, author, category } = req.body || {};

    if (!author) return res.status(400).json({ error: 'Validation failed', details: ['Author is required'] });

    const refError = await checkReferences({ author, category: category || null });
    if (refError) return res.status(400).json({ error: refError });

    const recipe = await Recipe.create({
      title,
      ingredients: normalizeIngredients(ingredients),
      instructions: normalizeInstructions(instructions),
      cookingTime,
      author,
      category: category || null,
    });
    await recipe.populate(populateFields);
    res.status(201).json(recipe);
  })
);

// GET /api/recipes - all recipes
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const recipes = await Recipe.find().populate(populateFields).sort({ createdAt: -1 });
    res.status(200).json(recipes);
  })
);

// GET /api/recipes/:id - one recipe
router.get(
  '/:id',
  validateObjectId,
  asyncHandler(async (req, res) => {
    const recipe = await Recipe.findById(req.params.id).populate(populateFields);
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });
    res.status(200).json(recipe);
  })
);

// PUT /api/recipes/:id - update recipe
router.put(
  '/:id',
  validateObjectId,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const updates = {};
    for (const key of ['title', 'ingredients', 'instructions', 'cookingTime', 'author', 'category']) {
      if (body[key] !== undefined) updates[key] = body[key];
    }
    if (updates.ingredients !== undefined) updates.ingredients = normalizeIngredients(updates.ingredients);
    if (updates.instructions !== undefined) updates.instructions = normalizeInstructions(updates.instructions);
    if (updates.category === '') updates.category = null;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided to update' });
    }

    const refError = await checkReferences({ author: updates.author, category: updates.category });
    if (refError) return res.status(400).json({ error: refError });

    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });

    recipe.set(updates);
    await recipe.save(); // runs full validation
    await recipe.populate(populateFields);
    res.status(200).json(recipe);
  })
);

// DELETE /api/recipes/:id - delete recipe
router.delete(
  '/:id',
  validateObjectId,
  asyncHandler(async (req, res) => {
    const recipe = await Recipe.findByIdAndDelete(req.params.id);
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });
    res.status(200).json({ message: 'Recipe deleted', id: recipe._id });
  })
);

module.exports = router;
