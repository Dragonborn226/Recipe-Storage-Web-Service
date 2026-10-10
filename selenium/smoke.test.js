import test from "node:test";
import assert from "node:assert/strict";
import { Builder, By, until } from "selenium-webdriver";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

async function createDriver() {
    return await new Builder().forBrowser("firefox").build();
}

test("Smoke test - Recipe notebook loads", async () => {
    const driver = await createDriver();
    try {
        await driver.get(BASE_URL);
        assert.equal(await driver.getTitle(), "Pantry / The recipe notebook");

        const brand = await driver.findElement(By.css(".brand"));
        assert.ok(await brand.isDisplayed(), "PANTRY brand should be visible");

        await driver.wait(
            until.elementLocated(By.css("#app h1")),
            10000,
            "Main page heading should render"
        );
        assert.equal(
            await driver.findElement(By.css("#app h1")).getText(),
            "The recipe collection."
        );
    } finally {
        await driver.quit();
    }
});

test("Smoke test - Recipe collection renders without a server error", async () => {
    const driver = await createDriver();
    try {
        await driver.get(`${BASE_URL}/#recipes`);
        await driver.wait(until.elementLocated(By.css("#app h1")), 10000);

        const heading = await driver.findElement(By.css("#app h1"));
        assert.equal(await heading.getText(), "The recipe collection.");

        const addRecipe = await driver.findElement(
            By.css('a[href="#new"]')
        );
        assert.ok(await addRecipe.isDisplayed(), "Add recipe link should be visible");

        const error = await driver.findElements(By.css("#app .error"));
        assert.equal(error.length, 0, "Collection should not display an error");
    } finally {
        await driver.quit();
    }
});

test("Smoke test - Add recipe form opens", async () => {
    const driver = await createDriver();
    try {
        await driver.get(`${BASE_URL}/#new`);
        await driver.wait(until.elementLocated(By.id("recipe-form")), 10000);

        assert.equal(
            await driver.findElement(By.css("#app h1")).getText(),
            "A new recipe."
        );

        for (const field of ["title", "ingredients", "instructions", "cookingTime", "author"]) {
            const element = await driver.findElement(
                By.css(`#recipe-form [name="${field}"]`)
            );
            assert.ok(await element.isDisplayed(), `${field} field should be visible`);
        }
    } finally {
        await driver.quit();
    }
});

test("Smoke test - Authors and categories page opens", async () => {
    const driver = await createDriver();
    try {
        await driver.get(`${BASE_URL}/#manage`);
        await driver.wait(until.elementLocated(By.css("#app h1")), 10000);

        assert.equal(
            await driver.findElement(By.css("#app h1")).getText(),
            "Authors & categories."
        );
        assert.ok(
            (await driver.findElements(By.css("#app form[data-type='users']"))).length === 1,
            "Add-author form should be present"
        );
        assert.ok(
            (await driver.findElements(By.css("#app form[data-type='categories']"))).length === 1,
            "Add-category form should be present"
        );
    } finally {
        await driver.quit();
    }
});

test("Smoke test - Recipe search filters visible cards", async () => {
    const driver = await createDriver();
    try {
        await driver.get(`${BASE_URL}/#recipes`);
        await driver.wait(until.elementLocated(By.id("search")), 10000);

        const search = await driver.findElement(By.id("search"));
        await search.sendKeys("zz-no-matching-recipe-987");
        await driver.wait(
            until.elementLocated(By.css("#cards .empty")),
            5000
        );

        assert.ok(
            (await driver.findElement(By.css("#cards .empty h2")).getText())
                .includes("Nothing on this page yet"),
            "Search with no matches should show the empty-search state"
        );
    } finally {
        await driver.quit();
    }
});