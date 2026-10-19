import { expect, test } from "@playwright/test";

test("navigation compacte sur mobile", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile uniquement");
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Navigation mobile" });
  await expect(nav).toBeVisible();
  await nav.getByRole("button", { name: "Plus" }).click();
  await page.getByRole("navigation", { name: "Menu complet" }).getByRole("link", { name: "Équipe IA" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Votre équipe marketing");
});
