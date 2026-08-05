import {
  chromium,
  type BrowserContext,
  type Page,
} from "playwright";

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

type FacebookGroup = {
  id: string;
  url: string;
  name: string;
  district: string | null;
};

type Listing = {
  id: string;
  title: string | null;
  district?: string | null;
  address?: string | null;
  images?: string[];
};

type SocialJob = {
  id: string;
  listing_id: string;
  facebook_group_id: string;
  facebook_account_id: string;
  content: string;
  content_version: number;
  scheduled_at: string | null;
  attempt_count: number;
  facebook_groups: FacebookGroup;
  listing: Listing;
  images?: string[];
};

type NextJobResponse = {
  job: SocialJob | null;
};

const accountId = process.argv[2];

if (!accountId) {
  console.error(
    [
      "Thiếu facebook_account_id.",
      "",
      "Cách chạy:",
      "npm run fb:worker -- <facebook_account_id>",
      "",
      "Ví dụ:",
      "npm run fb:worker -- 13a8816f-6f98-4c75-ae37-1a8516d70fdd",
    ].join("\n"),
  );

  process.exit(1);
}

const APP_BASE_URL =
  process.env.FACEBOOK_WORKER_API_URL?.trim() ||
  "http://localhost:3000";

const profilePath = path.resolve(
  process.cwd(),
  "facebook-profiles",
  accountId,
);

const POLL_INTERVAL_MS = 30_000;
const MAX_IMAGES = 10;

// Hiện tại chỉ kiểm tra, chưa đăng thật.
const DRY_RUN = true;

let context: BrowserContext | null = null;
let activePage: Page | null = null;
let stopping = false;
let processingJob = false;

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : String(error);
}

function isBlankUrl(url: string): boolean {
  return (
    url === "about:blank" ||
    url === "chrome://newtab/" ||
    url === "chrome://new-tab-page/" ||
    url.startsWith("chrome-search://")
  );
}

async function closeExtraPages(
  keepPage: Page,
): Promise<void> {
  if (!context) return;

  for (const page of context.pages()) {
    if (page === keepPage) continue;

    await page
      .close()
      .catch(() => undefined);
  }

  await keepPage
    .bringToFront()
    .catch(() => undefined);
}

async function shutdown(): Promise<void> {
  if (stopping) return;

  stopping = true;

  console.log(
    "\n[WORKER] Đang đóng Chromium sạch...",
  );

  while (processingJob) {
    console.log(
      "[WORKER] Đang chờ job hiện tại xử lý xong...",
    );

    await sleep(500);
  }

  await context
    ?.close()
    .catch(() => undefined);
}

async function requestJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, init);
  const text = await response.text();

  let data: unknown = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}: ${
        typeof data === "string"
          ? data
          : JSON.stringify(data)
      }`,
    );
  }

  return data as T;
}

async function getNextJob(): Promise<SocialJob | null> {
  const url = new URL(
    `${APP_BASE_URL}/api/social/next-job`,
  );

  url.searchParams.set(
    "accountId",
    accountId,
  );

  const result =
    await requestJson<NextJobResponse>(
      url.toString(),
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      },
    );

  return result.job ?? null;
}

async function releaseJob(
  jobId: string,
): Promise<void> {
  const result = await requestJson<unknown>(
    `${APP_BASE_URL}/api/social/release-job`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        jobId,
        note:
          "DRY RUN hoàn tất: đã kiểm tra đúng group, nội dung và ảnh; chưa đăng bài.",
      }),
    },
  );

  console.log(
    `[JOB] Đã trả job ${jobId} về hàng đợi.`,
  );

  console.log(
    "[JOB] Kết quả release:",
    result,
  );
}

async function downloadImages(
  urls: string[],
  directory: string,
): Promise<string[]> {
  const localFiles: string[] = [];

  for (
    let index = 0;
    index < urls.length;
    index += 1
  ) {
    const imageUrl = urls[index];

    console.log(
      `[ẢNH] Đang tải ${index + 1}/${urls.length}`,
    );

    const response = await fetch(imageUrl);

    if (!response.ok) {
      throw new Error(
        `Không tải được ảnh ${index + 1}: HTTP ${response.status}`,
      );
    }

    const contentType =
      response.headers.get("content-type") ?? "";

    let extension = ".jpg";

    if (contentType.includes("image/png")) {
      extension = ".png";
    } else if (
      contentType.includes("image/webp")
    ) {
      extension = ".webp";
    } else if (
      contentType.includes("image/jpeg")
    ) {
      extension = ".jpg";
    }

    const filename = `${String(
      index + 1,
    ).padStart(2, "0")}${extension}`;

    const filePath = path.join(
      directory,
      filename,
    );

    const arrayBuffer =
      await response.arrayBuffer();

    await fs.writeFile(
      filePath,
      Buffer.from(arrayBuffer),
    );

    localFiles.push(filePath);
  }

  return localFiles;
}

async function ensureLoggedIn(
  page: Page,
): Promise<void> {
  await page.goto(
    "https://www.facebook.com/",
    {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    },
  );

  const loginInput = page.locator(
    'input[name="email"]',
  );

  const loginButton = page.locator(
    'button[name="login"]',
  );

  const loggedOut =
    (await loginInput.count()) > 0 ||
    (await loginButton.count()) > 0;

  if (loggedOut) {
    throw new Error(
      [
        "Facebook chưa đăng nhập.",
        "Hãy dừng worker và chạy:",
        `npm run fb:login -- ${accountId}`,
      ].join("\n"),
    );
  }

  console.log(
    "[FACEBOOK] Session đăng nhập còn hoạt động.",
  );
}

async function detectFacebookBlock(
  page: Page,
): Promise<void> {
  const bodyText = (
    await page
      .locator("body")
      .innerText()
      .catch(() => "")
  ).toLowerCase();

  const blockedKeywords = [
    "checkpoint",
    "security check",
    "kiểm tra bảo mật",
    "xác nhận danh tính",
    "captcha",
    "your account has been locked",
    "tài khoản của bạn đã bị khóa",
  ];

  const matchedKeyword =
    blockedKeywords.find((keyword) =>
      bodyText.includes(keyword),
    );

  if (matchedKeyword) {
    throw new Error(
      `Facebook đang yêu cầu kiểm tra: ${matchedKeyword}`,
    );
  }
}

async function processDryRunJob(
  job: SocialJob,
): Promise<void> {
  if (!context || !activePage) {
    throw new Error(
      "Browser context chưa được khởi tạo.",
    );
  }

  processingJob = true;

  const tempDirectory = await fs.mkdtemp(
    path.join(
      os.tmpdir(),
      `facebook-job-${job.id}-`,
    ),
  );

  try {
    console.log("");
    console.log(
      "========================================",
    );

    console.log(`[JOB] ${job.id}`);

    console.log(
      `[LISTING] ${
        job.listing.title ??
        job.listing.id
      }`,
    );

    console.log(
      `[GROUP] ${job.facebook_groups.name}`,
    );

    console.log(
      `[GROUP URL] ${job.facebook_groups.url}`,
    );

    console.log(
      `[ATTEMPT] ${job.attempt_count}`,
    );

    console.log(
      "========================================",
    );

    const imageUrls = (
      job.images ??
      job.listing.images ??
      []
    ).slice(0, MAX_IMAGES);

    const downloadedImages =
      await downloadImages(
        imageUrls,
        tempDirectory,
      );

    console.log(
      `[ẢNH] Đã tải ${downloadedImages.length} ảnh.`,
    );

    await activePage.goto(
      job.facebook_groups.url,
      {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      },
    );

    await detectFacebookBlock(
      activePage,
    );

    await closeExtraPages(
      activePage,
    );

    console.log("");
    console.log(
      "========== NỘI DUNG SẼ ĐĂNG ==========",
    );

    console.log(job.content);

    console.log(
      "======================================",
    );

    console.log("");

    console.log(
      `[DRY RUN] Đã mở đúng group: ${job.facebook_groups.name}`,
    );

    console.log(
      `[DRY RUN] Đã chuẩn bị ${downloadedImages.length} ảnh.`,
    );

    console.log(
      "[DRY RUN] Chưa nhập nội dung và chưa bấm Đăng.",
    );

    await activePage
      .bringToFront()
      .catch(() => undefined);

    await releaseJob(job.id);

    console.log(
      `[DRY RUN HOÀN TẤT] Job ${job.id}`,
    );
  } finally {
    processingJob = false;

    await fs
      .rm(tempDirectory, {
        recursive: true,
        force: true,
      })
      .catch(() => undefined);
  }
}

async function main(): Promise<void> {
  console.log(
    "========================================",
  );

  console.log(
    "FACEBOOK SOCIAL WORKER",
  );

  console.log(
    `[ACCOUNT] ${accountId}`,
  );

  console.log(
    `[API] ${APP_BASE_URL}`,
  );

  console.log(
    `[PROFILE] ${profilePath}`,
  );

  console.log(
    `[DRY RUN] ${DRY_RUN}`,
  );

  console.log(
    "========================================",
  );

  context =
    await chromium.launchPersistentContext(
      profilePath,
      {
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
      },
    );

  process.once("SIGINT", () => {
    void shutdown();
  });

  process.once("SIGTERM", () => {
    void shutdown();
  });

  const pages = context.pages();

  activePage =
    pages.find(
      (page) =>
        !isBlankUrl(page.url()),
    ) ??
    pages[0] ??
    (await context.newPage());

  await closeExtraPages(
    activePage,
  );

  await ensureLoggedIn(
    activePage,
  );

  console.log(
    "[WORKER] Bắt đầu chờ job...",
  );

  while (!stopping) {
    try {
      const job =
        await getNextJob();

      if (!job) {
        console.log(
          `[WORKER] Không có job. Kiểm tra lại sau ${
            POLL_INTERVAL_MS / 1000
          } giây.`,
        );

        await sleep(
          POLL_INTERVAL_MS,
        );

        continue;
      }

      await processDryRunJob(
        job,
      );

      console.log(
        "[WORKER] DRY RUN đã xong một job. Worker sẽ dừng.",
      );

      await shutdown();
      break;
    } catch (error) {
      console.error(
        "[WORKER ERROR]",
        errorMessage(error),
      );

      if (!stopping) {
        console.log(
          `[WORKER] Thử lại sau ${
            POLL_INTERVAL_MS / 1000
          } giây.`,
        );

        await sleep(
          POLL_INTERVAL_MS,
        );
      }
    }
  }

  await new Promise<void>(
    (resolve) => {
      if (!context) {
        resolve();
        return;
      }

      if (
        context.pages().length === 0
      ) {
        resolve();
        return;
      }

      context.once(
        "close",
        () => resolve(),
      );
    },
  );
}

main().catch(
  async (error: unknown) => {
    console.error(
      "[WORKER DỪNG DO LỖI]",
      errorMessage(error),
    );

    await context
      ?.close()
      .catch(() => undefined);

    process.exitCode = 1;
  },
);