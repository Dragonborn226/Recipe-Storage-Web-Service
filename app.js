// Express app (kept separate from server.js so automated tests can import it).
const express = require('express');
const path = require('path');
const cors = require('cors');

const recipeRoutes = require('./routes/recipes');
const categoryRoutes = require('./routes/categories');
const userRoutes = require('./routes/users');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());

// Serves the frontend (put its files in ./public) so everything runs from one server.
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok' }));

app.use('/api/recipes', recipeRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/users', userRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
