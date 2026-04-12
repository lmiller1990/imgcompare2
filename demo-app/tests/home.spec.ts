import { test, expect } from "@playwright/test";

test("has content", async ({ page }) => {
  await page.goto("/");

  await page.screenshot({ path: "homepage.png" });

  await expect(page.getByText("Hello world")).toBeVisible();
});
