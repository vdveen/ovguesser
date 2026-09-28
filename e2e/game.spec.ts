import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";

type Station = { code: string; name: string; lat: number; lng: number };
const stations: Station[] = JSON.parse(readFileSync(new URL("../src/data/stations.json", import.meta.url), "utf8"));
const byName = new Map(stations.map((s) => [s.name, s]));

async function open(page: Page, errors: string[]) {
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("tiles.openfreemap.org")) errors.push(`console: ${m.text()}`);
  });
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Vrij spelen|Free play/ })).toBeVisible();
  await page.waitForFunction(() =>
    (document.querySelector(".map") as unknown as { __map?: { loaded(): boolean } })?.__map?.loaded(),
  );
}

async function currentStation(page: Page): Promise<Station> {
  const name = (await page.getByTestId("station-name").textContent())?.trim() ?? "";
  const s = byName.get(name);
  if (!s) throw new Error(`unknown station ${name}`);
  return s;
}

/** Drops a pin at the given coordinates by centring the map there and clicking the centre. */
async function pinAt(page: Page, lat: number, lng: number) {
  const point = await page.evaluate(
    ([lat, lng]) => {
      const el = document.querySelector(".map") as HTMLElement & { __map: any };
      el.__map.jumpTo({ center: [lng, lat], zoom: 11 });
      const p = el.__map.project([lng, lat]);
      const r = el.getBoundingClientRect();
      return { x: r.left + p.x, y: r.top + p.y };
    },
    [lat, lng],
  );
  await page.mouse.click(point.x, point.y);
}

async function guess(page: Page, lat: number, lng: number, how: "button" | "enter" = "button") {
  await pinAt(page, lat, lng);
  if (how === "enter") await page.keyboard.press("Enter");
  else await page.getByRole("button", { name: /Gok hier|Guess here/ }).click();
}

test("plays a full free run, saves it locally and on the server", async ({ page, request }) => {
  const errors: string[] = [];
  await open(page, errors);
  const before = await (await request.get("/api/stats/overview")).json();
  await page.getByRole("button", { name: "Vrij spelen" }).click();
  for (let i = 0; i < 5; i++) {
    const st = await currentStation(page);
    await guess(page, st.lat + 0.3, st.lng);
    await expect(page.getByTestId("round-score")).not.toHaveText("5.000");
    await expect(page.locator(".hint")).toContainText("ernaast");
    if (i === 2) {
      await page.getByRole("button", { name: "Opgeven" }).click();
      await expect(page.locator(".round-card")).toContainText("Helaas, 0 punten");
    } else {
      await guess(page, st.lat + 0.001, st.lng, "enter");
      await expect(page.locator(".round-card")).toContainText("Gevonden!");
    }
    await page.locator(".round-card button").click();
  }
  const end = page.getByTestId("end-score");
  await expect(end).toBeVisible();
  const total = Number((await end.textContent())?.replace(/\./g, ""));
  expect(total).toBeGreaterThan(10_000);
  expect(total).toBeLessThan(20_000);

  // Stored on the server (anonymous, verified).
  await expect.poll(async () => (await (await request.get("/api/stats/overview")).json()).runs).toBe(before.runs + 1);

  // Listed in the local history.
  await page.getByRole("dialog").getByRole("button", { name: "Mijn ritten" }).click();
  await expect(page.locator(".drawer .run")).toHaveCount(1);
  await expect(page.locator(".drawer .tile").first()).toContainText("1");
  expect(errors).toEqual([]);
});

test("resumes a run after a reload", async ({ page }) => {
  const errors: string[] = [];
  await open(page, errors);
  await page.getByRole("button", { name: "Vrij spelen" }).click();
  const st = await currentStation(page);
  await guess(page, st.lat + 0.5, st.lng);
  const score = await page.getByTestId("round-score").textContent();
  await page.reload();
  await expect(page.getByRole("button", { name: "Hervat" })).toBeVisible();
  await page.waitForFunction(() =>
    (document.querySelector(".map") as unknown as { __map?: { loaded(): boolean } })?.__map?.loaded(),
  );
  await page.getByRole("button", { name: "Hervat" }).click();
  await expect(page.getByTestId("station-name")).toHaveText(st.name);
  await expect(page.getByTestId("round-score")).toHaveText(score ?? "");
  await expect(page.locator(".pin.guess")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("daily ride: ranked against other players, and only once a day", async ({ page }) => {
  const errors: string[] = [];
  await open(page, errors);
  await page.getByRole("button", { name: /Dagelijkse rit/ }).click();
  for (let i = 0; i < 5; i++) {
    const st = await currentStation(page);
    await guess(page, st.lat + 0.002, st.lng);
    await page.locator(".round-card button").click();
  }
  await expect(page.getByTestId("end-score")).toHaveText("25.000");
  await expect(page.getByTestId("daily-rank")).toBeVisible();
  await page.getByRole("button", { name: "Sluiten" }).click();
  await expect(page.getByRole("button", { name: /Dagelijkse rit/ })).toContainText("gespeeld");
  await page.getByRole("button", { name: /Dagelijkse rit/ }).click();
  await expect(page.locator(".toast")).toContainText("al gespeeld");
  await expect(page.getByTestId("end-score")).toHaveText("25.000");
  expect(errors).toEqual([]);
});

test("switches to English and remembers it", async ({ page }) => {
  const errors: string[] = [];
  await open(page, errors);
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.getByRole("button", { name: "Free play" })).toBeVisible();
  await expect(page.locator(".credit")).toHaveText("Made by Anne v/d Veen with Replit and Opus 5.5");
  await page.reload();
  await expect(page.getByRole("button", { name: "Free play" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.lang)).toBe("en");
  await page.getByRole("button", { name: "NL", exact: true }).click();
  await expect(page.locator(".credit")).toHaveText("Gemaakt door Anne v/d Veen met Replit en Opus 5.5");
  expect(errors).toEqual([]);
});

test("exports and imports runs", async ({ page }) => {
  const errors: string[] = [];
  await open(page, errors);
  await page.getByRole("button", { name: "Vrij spelen" }).click();
  for (let i = 0; i < 5; i++) {
    await page.getByRole("button", { name: "Opgeven" }).click();
    await page.locator(".round-card button").click();
  }
  await expect(page.getByTestId("end-score")).toHaveText("0");
  await page.getByRole("dialog").getByRole("button", { name: "Mijn ritten" }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Exporteer" }).click(),
  ]);
  const file = await download.path();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Wis alles" }).click();
  await expect(page.locator(".drawer .run")).toHaveCount(0);
  await page.locator('.drawer input[type="file"]').setInputFiles(file);
  await expect(page.locator(".toast")).toContainText("1 rit geïmporteerd");
  await expect(page.locator(".drawer .run")).toHaveCount(1);
  expect(errors).toEqual([]);
});
