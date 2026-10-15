// Build stage browser tests. Locally and in CI they run against _site/ (what
// ships), served by Python's static server. Set BASE_URL to test a deployed
// site instead (Deploy/Operate stages); then no local server is started.
import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const BASE_URL = process.env.BASE_URL || `http://127.0.0.1:${PORT}/`;

export default defineConfig({
  testDir: "./e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: BASE_URL, trace: "retain-on-failure" },
  projects: [
    // Most visitors are on phones; 375×812 is a small modern phone.
    { name: "mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: process.env.BASE_URL ? undefined : {
    command: `node ../../scripts/stage-site.mjs && python3 -m http.server ${PORT} --bind 127.0.0.1 --directory ../../_site`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    stderr: "ignore", // python logs every request to stderr
  },
});
