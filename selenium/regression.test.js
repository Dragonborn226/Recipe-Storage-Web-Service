import test from "node:test";
import assert from "node:assert/strict";
import { Builder, By, until } from "selenium-webdriver";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const API_URL = process.env.API_URL || `${BASE_URL}/api`;
const TEST_PREFIX = `selenium-${Date.now()}`;

async function createDriver() {
    return await new Builder().forBrowser("firefox").build();
}

async function apiRequest(path, options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        },
        body: options.body === undefined
            ? undefined
            : JSON.stringify(options.body)
    });

    const data = response.status === 204
        ? null
        : await response.json().catch(() => null);

    assert.ok(
        response.ok,
        `API request ${options.method || "GET"} ${path} failed (${response.status}): ${JSON.stringify(data)}`
    );

    return data?.data ?? data;
}

async function rawApiRequest(path, options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        },
        body: options.body === undefined
            ? undefined
            : JSON.stringify(options.body)
    });

    const json = response.status === 204
        ? null
        : await response.json().catch(() => null);

    return {
        response,
        data: json?.data ?? json
    };
}

function resourceId(resource) {
    return resource?._id ?? resource?.id;
}

async function getResources() {
    const [users, categories] = await Promise.all([
        apiRequest("/users"),
        apiRequest("/categories")
    ]);

    return { users, categories };
}

async function ensureTestAuthorAndCategory() {
    const { users, categories } = await getResources();

    let author = users[0];

    if (!author) {
        author = await apiRequest("/users", {
            method: "POST",
            body: {
                username: `${TEST_PREFIX}-author`,
                email: `${TEST_PREFIX}@example.com`
            }
        });
    }

    let category = categories[0];

    if (!category) {
        category = await apiRequest("/categories", {
            method: "POST",
            body: {
                name: `${TEST_PREFIX}-category`
            }
        });
    }

    return { author, category };
}

async function waitForHeading(driver, expectedText, timeout = 15000) {
    await driver.wait(async () => {
        try {
            const heading = await driver.findElement(By.css("#app h1"));
            return (await heading.getText()).trim() === expectedText;
        } catch {
            return false;
        }
    }, timeout, `Timed out waiting for heading "${expectedText}"`);
}

async function waitForVisible(driver, locator, timeout = 15000) {
    return await driver.wait(async () => {
        try {
            const element = await driver.findElement(locator);

            if (await element.isDisplayed()) {
                return element;
            }

            return false;
        } catch {
            return false;
        }
    }, timeout, `Timed out waiting for visible element: ${locator}`);
}

async function fillRecipeForm(driver, recipe) {
    const form = await waitForVisible(driver, By.id("recipe-form"));

    const title = await form.findElement(By.name("title"));
    await title.clear();
    await title.sendKeys(recipe.title);

    const ingredients = await form.findElement(By.name("ingredients"));
    await ingredients.clear();
    await ingredients.sendKeys(recipe.ingredients.join("\n"));

    const instructions = await form.findElement(By.name("instructions"));
    await instructions.clear();
    await instructions.sendKeys(recipe.instructions.join("\n"));

    const cookingTime = await form.findElement(By.name("cookingTime"));
    await cookingTime.clear();
    await cookingTime.sendKeys(String(recipe.cookingTime));

    await form.findElement(By.name("author")).sendKeys(recipe.authorName);

    if (recipe.categoryName) {
        await form.findElement(By.name("category")).sendKeys(recipe.categoryName);
    }

    await form.findElement(By.css('button[type="submit"]')).click();
}

async function createRecipeThroughUI(driver, recipe) {
    await driver.get(`${BASE_URL}/#new`);
    await waitForVisible(driver, By.id("recipe-form"));
    await fillRecipeForm(driver, recipe);

    await driver.wait(
        until.urlContains("#recipe/"),
        15000,
        "Recipe was not redirected to its detail page after saving"
    );

    await waitForHeading(driver, recipe.title);

    const currentUrl = await driver.getCurrentUrl();
    const recipeId = currentUrl.split("#recipe/")[1];

    assert.ok(recipeId, "Could not find the saved recipe ID in the URL");

    return decodeURIComponent(recipeId);
}

async function deleteRecipeIfPresent(id) {
    if (!id) return;

    const response = await fetch(
        `${API_URL}/recipes/${encodeURIComponent(id)}`,
        { method: "DELETE" }
    );

    assert.ok(
        response.ok || response.status === 404,
        `Cleanup failed for recipe ${id}: HTTP ${response.status}`
    );
}

// ------------------------------------------------------------
// Existing UI regression tests
// ------------------------------------------------------------

test("Regression test - Valid recipe can be created and displayed", async () => {
    const driver = await createDriver();
    let recipeId;

    try {
        const { author, category } = await ensureTestAuthorAndCategory();

        const recipe = {
            title: `${TEST_PREFIX}-create`,
            ingredients: ["1 cup flour", "2 eggs"],
            instructions: ["Combine ingredients.", "Cook until ready."],
            cookingTime: 15,
            authorName: author.username,
            categoryName: category?.name
        };

        recipeId = await createRecipeThroughUI(driver, recipe);

        assert.ok(recipeId);

        assert.ok(
            (await driver.findElement(By.css(".ingredients")).getText())
                .includes("1 cup flour")
        );

        assert.ok(
            (await driver.findElement(By.css(".steps")).getText())
                .includes("Combine ingredients.")
        );

        const stored = await apiRequest(
            `/recipes/${encodeURIComponent(recipeId)}`
        );

        assert.equal(stored.title, recipe.title);
    } finally {
        await driver.quit();
        await deleteRecipeIfPresent(recipeId);
    }
});

test("Regression test - Editing a recipe persists changes", async () => {
    const driver = await createDriver();
    let recipeId;

    try {
        const { author, category } = await ensureTestAuthorAndCategory();

        const recipe = {
            title: `${TEST_PREFIX}-edit-original`,
            ingredients: ["1 apple"],
            instructions: ["Wash the apple."],
            cookingTime: 5,
            authorName: author.username,
            categoryName: category?.name
        };

        recipeId = await createRecipeThroughUI(driver, recipe);

        await driver.get(
            `${BASE_URL}/#edit/${encodeURIComponent(recipeId)}`
        );

        await waitForVisible(driver, By.id("recipe-form"));

        const title = await driver.findElement(By.name("title"));
        await title.clear();
        await title.sendKeys(`${TEST_PREFIX}-edit-updated`);

        const instructions = await driver.findElement(
            By.name("instructions")
        );

        await instructions.clear();
        await instructions.sendKeys(
            "Wash the apple.\nSlice it carefully."
        );

        await driver.findElement(
            By.css('#recipe-form button[type="submit"]')
        ).click();

        await driver.wait(until.urlContains("#recipe/"), 15000);
        await waitForHeading(driver, `${TEST_PREFIX}-edit-updated`);

        const stored = await apiRequest(
            `/recipes/${encodeURIComponent(recipeId)}`
        );

        assert.equal(stored.title, `${TEST_PREFIX}-edit-updated`);

        const storedInstructions = Array.isArray(stored.instructions)
            ? stored.instructions.join("\n")
            : stored.instructions;

        assert.ok(
            storedInstructions.includes("Slice it carefully."),
            "Updated instructions should be saved by the backend"
        );
    } finally {
        await driver.quit();
        await deleteRecipeIfPresent(recipeId);
    }
});

test("Regression test - Required recipe fields prevent an empty submission", async () => {
    const driver = await createDriver();

    try {
        await driver.get(`${BASE_URL}/#new`);

        const form = await waitForVisible(driver, By.id("recipe-form"));

        await form.findElement(
            By.css('button[type="submit"]')
        ).click();

        assert.ok(
            (await driver.getCurrentUrl()).includes("#new"),
            "The form should remain open when required fields are missing"
        );

        assert.equal(
            (await driver.findElements(By.css("#app .error"))).length,
            0,
            "Browser validation should prevent an empty submission"
        );
    } finally {
        await driver.quit();
    }
});

test("Regression test - Search finds a saved recipe and hides non-matches", async () => {
    const driver = await createDriver();
    let recipeId;

    try {
        const { author, category } = await ensureTestAuthorAndCategory();

        const recipe = {
            title: `${TEST_PREFIX}-search-target`,
            ingredients: ["2 pears"],
            instructions: ["Prepare the pears."],
            cookingTime: 12,
            authorName: author.username,
            categoryName: category?.name
        };

        recipeId = await createRecipeThroughUI(driver, recipe);

        await driver.get(`${BASE_URL}/#recipes`);

        const search = await waitForVisible(driver, By.id("search"));
        await search.sendKeys(`${TEST_PREFIX}-search-target`);

        await driver.wait(async () => {
            try {
                const cards = await driver.findElements(
                    By.css("#cards .card")
                );

                if (cards.length !== 1) return false;

                return (await cards[0].getText())
                    .includes(`${TEST_PREFIX}-search-target`);
            } catch {
                return false;
            }
        }, 10000, "Search did not display the matching recipe");

        await search.clear();
        await search.sendKeys("unmatched-search-term-xyz");

        await waitForVisible(driver, By.css("#cards .empty"));

        assert.ok(
            (await driver.findElement(By.css("#cards .empty")).getText())
                .includes("Nothing on this page yet")
        );
    } finally {
        await driver.quit();
        await deleteRecipeIfPresent(recipeId);
    }
});

test("Regression test - Recipe can be deleted and disappears from the backend", async () => {
    const driver = await createDriver();
    let recipeId;

    try {
        const { author, category } = await ensureTestAuthorAndCategory();

        const recipe = {
            title: `${TEST_PREFIX}-delete`,
            ingredients: ["1 tomato"],
            instructions: ["Wash the tomato."],
            cookingTime: 3,
            authorName: author.username,
            categoryName: category?.name
        };

        recipeId = await createRecipeThroughUI(driver, recipe);

        await driver.findElement(By.id("delete")).click();
        await waitForVisible(driver, By.id("confirm-delete"));
        await driver.findElement(By.id("confirm-delete")).click();

        await driver.wait(until.urlContains("#recipes"), 15000);
        await waitForVisible(driver, By.id("search"));

        const response = await fetch(
            `${API_URL}/recipes/${encodeURIComponent(recipeId)}`
        );

        assert.equal(
            response.status,
            404,
            "Deleted recipe should no longer exist in the API"
        );

        recipeId = null;
    } finally {
        await driver.quit();
        await deleteRecipeIfPresent(recipeId);
    }
});

test("Regression test - Canceling recipe deletion keeps the recipe", async () => {
    const driver = await createDriver();
    let recipeId;

    try {
        const { author, category } = await ensureTestAuthorAndCategory();

        const recipe = {
            title: `${TEST_PREFIX}-keep`,
            ingredients: ["1 potato"],
            instructions: ["Wash the potato."],
            cookingTime: 8,
            authorName: author.username,
            categoryName: category?.name
        };

        recipeId = await createRecipeThroughUI(driver, recipe);

        await driver.findElement(By.id("delete")).click();
        await waitForVisible(driver, By.id("cancel-delete"));
        await driver.findElement(By.id("cancel-delete")).click();

        await driver.wait(async () => {
            return await driver.executeScript(() => {
                const modal = document.querySelector("#modal");
                return !modal || !modal.open;
            });
        }, 10000, "Delete confirmation dialog did not close");

        const stored = await apiRequest(
            `/recipes/${encodeURIComponent(recipeId)}`
        );

        assert.equal(
            stored.title,
            recipe.title,
            "Canceling deletion should leave the recipe saved"
        );
    } finally {
        await driver.quit();
        await deleteRecipeIfPresent(recipeId);
    }
});

test("Regression test - Recipe category filter narrows the collection", async () => {
    const driver = await createDriver();
    let recipeId;

    try {
        const { author, category } = await ensureTestAuthorAndCategory();

        assert.ok(category, "A category is required for this test");

        const recipe = {
            title: `${TEST_PREFIX}-category-filter`,
            ingredients: ["1 cup rice"],
            instructions: ["Cook the rice."],
            cookingTime: 20,
            authorName: author.username,
            categoryName: category.name
        };

        recipeId = await createRecipeThroughUI(driver, recipe);

        await driver.get(`${BASE_URL}/#recipes`);

        const categorySelect = await waitForVisible(
            driver,
            By.id("category")
        );

        await categorySelect.sendKeys(category.name);

        await driver.wait(async () => {
            try {
                const cards = await driver.findElements(
                    By.css("#cards .card")
                );

                if (cards.length === 0) return false;

                const texts = await Promise.all(
                    cards.map(card => card.getText())
                );

                return texts.some(text => text.includes(recipe.title)) &&
                    texts.every(text =>
                        text.toLowerCase().includes(category.name.toLowerCase())
                    );
            } catch {
                return false;
            }
        }, 15000, "Category filter did not show the expected recipes");

        const cards = await driver.findElements(By.css("#cards .card"));

        for (const card of cards) {
            assert.equal(
                (await card.findElement(By.css(".tag")).getText()).toLowerCase(),
                category.name.toLowerCase()
            );
        }
    } finally {
        await driver.quit();
        await deleteRecipeIfPresent(recipeId);
    }
});

test("Regression test - Recipe detail can be opened from the collection", async () => {
    const driver = await createDriver();
    let recipeId;

    try {
        const { author, category } = await ensureTestAuthorAndCategory();

        const recipe = {
            title: `${TEST_PREFIX}-detail`,
            ingredients: ["2 carrots"],
            instructions: ["Peel the carrots."],
            cookingTime: 9,
            authorName: author.username,
            categoryName: category?.name
        };

        recipeId = await createRecipeThroughUI(driver, recipe);

        await driver.get(`${BASE_URL}/#recipes`);

        const search = await waitForVisible(driver, By.id("search"));
        await search.sendKeys(`${TEST_PREFIX}-detail`);

        const card = await driver.wait(
            until.elementLocated(By.css("#cards .card")),
            10000,
            "Recipe card was not found in the collection"
        );

        await driver.wait(until.elementIsVisible(card), 5000);
        await card.click();

        await driver.wait(
            until.urlContains(`#recipe/${encodeURIComponent(recipeId)}`),
            10000
        );

        await waitForHeading(driver, recipe.title);

        assert.ok(
            (await driver.findElement(By.css(".ingredients")).getText())
                .includes("2 carrots")
        );

        assert.ok(
            (await driver.findElement(By.css(".steps")).getText())
                .includes("Peel the carrots.")
        );
    } finally {
        await driver.quit();
        await deleteRecipeIfPresent(recipeId);
    }
});

// ------------------------------------------------------------
// Additional backend and integration regression tests
// ------------------------------------------------------------

test("Regression test - Recipe remains saved after a page refresh", async () => {
    const driver = await createDriver();
    let recipeId;

    try {
        const { author, category } = await ensureTestAuthorAndCategory();

        const recipe = {
            title: `${TEST_PREFIX}-refresh-persistence`,
            ingredients: ["1 cup oats"],
            instructions: ["Mix the oats."],
            cookingTime: 7,
            authorName: author.username,
            categoryName: category?.name
        };

        recipeId = await createRecipeThroughUI(driver, recipe);

        await driver.navigate().refresh();
        await waitForHeading(driver, recipe.title);

        const stored = await apiRequest(
            `/recipes/${encodeURIComponent(recipeId)}`
        );

        assert.equal(stored.title, recipe.title);

        assert.ok(
            (await driver.findElement(By.css(".ingredients")).getText())
                .includes("1 cup oats")
        );
    } finally {
        await driver.quit();
        await deleteRecipeIfPresent(recipeId);
    }
});

test("Regression test - API rejects a recipe with missing required fields", async () => {
    const { response, data } = await rawApiRequest("/recipes", {
        method: "POST",
        body: {
            title: `${TEST_PREFIX}-invalid`,
            ingredients: [],
            instructions: "",
            cookingTime: 0
        }
    });

    assert.equal(
        response.status,
        400,
        `Expected 400, got ${response.status}: ${JSON.stringify(data)}`
    );

    assert.equal(
        typeof data?.error,
        "string",
        "Validation response should include an error message"
    );
});

test("Regression test - Malformed and nonexistent recipe IDs return documented errors", async () => {
    const malformed = await rawApiRequest("/recipes/not-a-valid-id");

    assert.equal(malformed.response.status, 400);
    assert.equal(typeof malformed.data?.error, "string");

    const nonexistent = await rawApiRequest(
        "/recipes/000000000000000000000000"
    );

    assert.equal(nonexistent.response.status, 404);
    assert.equal(typeof nonexistent.data?.error, "string");
});

test("Regression test - Invalid author and category references are rejected", async () => {
    const invalidId = "000000000000000000000000";

    const { response, data } = await rawApiRequest("/recipes", {
        method: "POST",
        body: {
            title: `${TEST_PREFIX}-invalid-reference`,
            ingredients: ["1 cup rice"],
            instructions: "Cook the rice.",
            cookingTime: 10,
            author: invalidId,
            category: invalidId
        }
    });

    assert.equal(
        response.status,
        400,
        `Expected 400, got ${response.status}: ${JSON.stringify(data)}`
    );

    assert.equal(typeof data?.error, "string");
});

test("Regression test - Duplicate usernames and emails return HTTP 409", async () => {
    const { users } = await getResources();

    assert.ok(users.length > 0, "At least one existing author is required");

    const existing = users[0];

    const duplicateUsername = await rawApiRequest("/users", {
        method: "POST",
        body: {
            username: existing.username,
            email: `${TEST_PREFIX}-duplicate-username@example.com`
        }
    });

    assert.equal(duplicateUsername.response.status, 409);

    const duplicateEmail = await rawApiRequest("/users", {
        method: "POST",
        body: {
            username: `${TEST_PREFIX}-duplicate-email`,
            email: existing.email
        }
    });

    assert.equal(duplicateEmail.response.status, 409);
});

test("Regression test - Duplicate category names return HTTP 409", async () => {
    const { categories } = await getResources();

    assert.ok(categories.length > 0, "At least one category is required");

    const duplicate = await rawApiRequest("/categories", {
        method: "POST",
        body: { name: categories[0].name }
    });

    assert.equal(duplicate.response.status, 409);
});

test("Regression test - API supports create, read, update, and delete", async () => {
    const { author, category } = await ensureTestAuthorAndCategory();

    const authorId = resourceId(author);
    const categoryId = resourceId(category);

    assert.ok(authorId, "Author response should include an ID");

    let recipeId;

    try {
        const body = {
            title: `${TEST_PREFIX}-api-crud`,
            ingredients: ["1 cup flour"],
            instructions: "Mix the flour.",
            cookingTime: 10,
            author: authorId,
            ...(categoryId ? { category: categoryId } : {})
        };

        const created = await rawApiRequest("/recipes", {
            method: "POST",
            body
        });

        assert.equal(created.response.status, 201, JSON.stringify(created.data));

        recipeId = resourceId(created.data);

        assert.ok(recipeId, "Created recipe response should include an ID");

        const read = await rawApiRequest(
            `/recipes/${encodeURIComponent(recipeId)}`
        );

        assert.equal(read.response.status, 200);
        assert.equal(read.data.title, body.title);

        const updatedBody = {
            ...body,
            title: `${TEST_PREFIX}-api-crud-updated`,
            ingredients: ["2 cups flour", "1 cup water"],
            instructions: "Mix the flour and water.",
            cookingTime: 12
        };

        const updated = await rawApiRequest(
            `/recipes/${encodeURIComponent(recipeId)}`,
            {
                method: "PUT",
                body: updatedBody
            }
        );

        assert.equal(
            updated.response.status,
            200,
            JSON.stringify(updated.data)
        );

        const reread = await rawApiRequest(
            `/recipes/${encodeURIComponent(recipeId)}`
        );

        assert.equal(reread.response.status, 200);
        assert.equal(reread.data.title, updatedBody.title);
        assert.equal(reread.data.cookingTime, updatedBody.cookingTime);

        const deleted = await rawApiRequest(
            `/recipes/${encodeURIComponent(recipeId)}`,
            { method: "DELETE" }
        );

        assert.equal(deleted.response.status, 200);

        const deletedId = recipeId;
        recipeId = null;

        const afterDelete = await rawApiRequest(
            `/recipes/${encodeURIComponent(deletedId)}`
        );

        assert.equal(afterDelete.response.status, 404);
    } finally {
        await deleteRecipeIfPresent(recipeId);
    }
});

test("Regression test - Health endpoint responds successfully", async () => {
    const { response, data } = await rawApiRequest("/health");

    assert.equal(response.status, 200);

    assert.ok(
        data !== null && typeof data === "object",
        "Health endpoint should return JSON"
    );
});

test("Regression test - Author filter includes recipes by the selected author", async () => {
    const driver = await createDriver();
    let recipeId;

    try {
        const { author, category } = await ensureTestAuthorAndCategory();

        const recipe = {
            title: `${TEST_PREFIX}-author-filter`,
            ingredients: ["1 banana"],
            instructions: ["Peel the banana."],
            cookingTime: 2,
            authorName: author.username,
            categoryName: category?.name
        };

        recipeId = await createRecipeThroughUI(driver, recipe);

        await driver.get(`${BASE_URL}/#recipes`);

        const authorSelect = await waitForVisible(
            driver,
            By.id("author")
        );

        await authorSelect.sendKeys(author.username);

        await driver.wait(async () => {
            const cards = await driver.findElements(By.css("#cards .card"));
            const texts = await Promise.all(cards.map(card => card.getText()));

            return texts.some(text => text.includes(recipe.title));
        }, 15000, "Author filter did not include the recipe belonging to the selected author");

        assert.ok(
            (await driver.findElements(By.css("#cards .card"))).length > 0
        );
    } finally {
        await driver.quit();
        await deleteRecipeIfPresent(recipeId);
    }
});

test("Regression test - Unknown API routes return a JSON 404 error", async () => {
    const { response, data } = await rawApiRequest(
        "/route-that-does-not-exist"
    );

    assert.equal(response.status, 404);

    assert.equal(
        typeof data?.error,
        "string",
        "Unknown routes should return a JSON error message"
    );
});