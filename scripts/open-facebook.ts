import { chromium, type BrowserContext, type Page } from "playwright";
import path from "node:path";

const accountId = process.argv[2];

if (!accountId) {
  console.error(
    "Thiếu accountId.\n" +
      "Cách chạy:\n" +
      "npm run fb:login -- <facebook_account_id>",
  );
  process.exit(1);
}

const profilePath = path.resolve(
  process.cwd(),
  "facebook-profiles",
  accountId,
);

let context: BrowserContext | null = null;
let facebookPage: Page | null = null;
let closing = false;
let cleanupTimer: NodeJS.Timeout | null = null;

function isBlankUrl(url: string): boolean {
  return (
    url === "about:blank" ||
    url === "chrome://newtab/" ||
    url === "chrome://new-tab-page/" ||
    url.startsWith("chrome-search://")
  );
}

async function removeBlankTabs(): Promise<void> {
  if (!context || !facebookPage) return;

  for (const page of context.pages()) {
    if (page === facebookPage) continue;

    if (isBlankUrl(page.url())) {
      await page.close().catch(() => undefined);
    }
  }

  await facebookPage.bringToFront().catch(() => undefined);
}

async function shutdown(): Promise<void> {
  if (closing) return;
  closing = true;

  console.log("\nĐang đóng Chromium sạch...");

  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }

  await context?.close().catch(() => undefined);
}

async function main(): Promise<void> {
  console.log(`[ACCOUNT] ${accountId}`);
  console.log(`[PROFILE] ${profilePath}`);

  context = await chromium.launchPersistentContext(profilePath, {
    headless: false,
    viewport: {
      width: 1440,
      height: 1000,
    },
    locale: "vi-VN",
    args: [
      "--disable-notifications",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-session-crashed-bubble",
    ],
  });

  process.once("SIGINT", () => {
    void shutdown();
  });

  process.once("SIGTERM", () => {
    void shutdown();
  });

  const existingPages = context.pages();

  facebookPage =
    existingPages.find((page) =>
      page.url().includes("facebook.com"),
    ) ??
    existingPages[0] ??
    (await context.newPage());

  await facebookPage.goto("https://www.facebook.com/", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });

  await facebookPage.bringToFront();

  context.on("page", (newPage) => {
    void (async () => {
      await newPage.waitForTimeout(500).catch(() => undefined);

      if (
        facebookPage &&
        newPage !== facebookPage &&
        isBlankUrl(newPage.url())
      ) {
        await newPage.close().catch(() => undefined);
        await facebookPage.bringToFront().catch(() => undefined);
      }
    })();
  });

  // Dọn tab trắng liên tục vì Chromium có thể khôi phục tab trễ.
  cleanupTimer = setInterval(() => {
    void removeBlankTabs();
  }, 1_000);

  await removeBlankTabs();

  console.log("Facebook đã mở.");
  console.log("Session đăng nhập đang được giữ.");
  console.log("Nhấn Ctrl+C để đóng sạch.");

  await new Promise<void>((resolve) => {
  context?.once("close", () => resolve());
});
}

main().catch(async (error: unknown) => {
  const message =
    error instanceof Error ? error.message : String(error);

  console.error("[LỖI]", message);
  await shutdown();
  process.exitCode = 1;
});