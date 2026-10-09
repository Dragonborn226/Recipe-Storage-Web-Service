# Recipe Storage Web Service

A full-stack web app for saving, browsing, editing, and organizing recipes. Users can create authors and categories, attach them to recipes, and filter the collection by either. All data is stored in MongoDB Atlas, so it persists when the server restarts.

**Team:** _(add team member names and roles here)_

## Tech Stack
- **Backend:** Node.js, Express
- **Database:** MongoDB Atlas, accessed through Mongoose
- **Frontend:** Vanilla HTML/CSS/JavaScript (ES modules), served by Express from `public/`
- The frontend talks to the backend only through the REST API and never touches MongoDB directly.

## Quick Start
Requirements: [Node.js](https://nodejs.org) 18 or newer.

1. Open a terminal in the project folder.
2. Install dependencies:
   ```
   npm install
   ```
3. A working `.env` file (with the MongoDB Atlas connection string) is included in the project folder. Keep it next to `server.js`.
4. Start the server:
   ```
   npm start
   ```
5. When you see `Connected to MongoDB Atlas` and `Server running on http://localhost:3000`, open **http://localhost:3000** in your browser.

For auto-reload while developing, use `npm run dev`.

### Using the app
1. Open **Authors & categories** and add at least one author and one category.
2. Click **+ Add a recipe**, fill in the form, and save.
3. Click a recipe card to view it, then edit or delete it from the detail page.
4. Use the search box and the author/category dropdowns to filter the collection.

### Troubleshooting
| Problem | Fix |
|---|---|
| `Missing MONGODB_URI` | The `.env` file is missing or not in the same folder as `server.js`. |
| `Could not connect to any servers` | Your IP is not allowed in Atlas. Go to Network Access and add your current IP. |
| `bad auth : Authentication failed` | The username or password in `.env` is wrong. |
| Page loads but shows an error | Check that the terminal running `npm start` is still open and connected. |
| Old frontend shows after an update | Hard refresh with Ctrl+Shift+R. |

## Project Structure
```
├── server.js            Connects to MongoDB, starts the server
├── app.js               Express app setup (also importable for tests)
├── models/              Mongoose models: User, Category, Recipe
├── routes/              API routes: recipes, categories, users
├── middleware/          Error handling and ID validation
├── public/              Frontend (index.html, app.js, api.js, styles.css)
├── .env                 MongoDB connection string and port
└── package.json
```

## Data Models
| Model | Fields |
|---|---|
| **User** | `username` (required, unique), `email` (required, unique, valid format) |
| **Category** | `name` (required, unique) |
| **Recipe** | `title` (required), `ingredients` (required, list of strings), `instructions` (required), `cookingTime` (required, minutes, at least 1), `author` (required, references User), `category` (optional, references Category) |

Every document gets a unique `_id` from MongoDB. Relationships:
- A **User** can have many **Recipes** (`Recipe.author`).
- A **Category** can have many **Recipes** (`Recipe.category`).

## API Routes
Base path: `/api`

| Method | Route | Purpose | Success |
|---|---|---|---|
| POST | `/api/recipes` | Create a recipe | 201 |
| GET | `/api/recipes` | Get all recipes | 200 |
| GET | `/api/recipes/:id` | Get one recipe | 200 |
| PUT | `/api/recipes/:id` | Update a recipe | 200 |
| DELETE | `/api/recipes/:id` | Delete a recipe | 200 |
| POST | `/api/categories` | Create a category | 201 |
| GET | `/api/categories` | Get all categories | 200 |
| GET | `/api/categories/:id/recipes` | Get recipes in a category | 200 |
| POST | `/api/users` | Create a user (author) | 201 |
| GET | `/api/users` | Get all users | 200 |
| GET | `/api/users/:id/recipes` | Get recipes by a user | 200 |
| GET | `/api/health` | Health check | 200 |

### Example request
```
POST /api/recipes
Content-Type: application/json

{
  "title": "Pancakes",
  "ingredients": ["flour", "milk", "eggs"],
  "instructions": "Mix the batter.\nFry until golden.",
  "cookingTime": 20,
  "author": "<userId>",
  "category": "<categoryId>"
}
```
`ingredients` can also be a comma- or newline-separated string. `instructions` can also be an array of steps; it is stored as one newline-separated string.

## Validation and Error Handling
Input is validated before anything is saved. Bad requests never crash the server. Every error returns JSON in the form `{ "error": "message" }`, and validation errors also include a `details` array.

| Status | Meaning |
|---|---|
| 400 | Missing or invalid fields, malformed ID, or a nonexistent author/category reference |
| 404 | Recipe, user, or category not found, or unknown route |
| 409 | Duplicate username, email, or category name |
| 500 | Unexpected server or database error |

## Manual Testing Checklist
- [ ] Create a valid recipe (appears in the list and has a unique ID)
- [ ] Try creating a recipe with a missing title, ingredients, instructions, or cooking time (rejected with a clear message)
- [ ] View all recipes, and view the empty state with no recipes
- [ ] View one recipe, and open a nonexistent or malformed ID (404 / 400)
- [ ] Edit a recipe and confirm the change shows after reload
- [ ] Delete a recipe and confirm it no longer appears
- [ ] Create categories and authors, and filter recipes by each
- [ ] Try a duplicate username, email, or category name (409)
- [ ] Stop and restart the server, then confirm all data is still there

## Automated Testing
`app.js` exports the Express app without starting the server, so tests can use it directly with a testing library such as Jest and Supertest against a test database.