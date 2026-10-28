const { spawnSync } = require("node:child_process");
const { copyFileSync, mkdirSync } = require("node:fs");
const { join } = require("node:path");

const projectRoot = join(__dirname, "..");

// GitHub Pages serves the existing guest demo without a backend.
const result = spawnSync(process.execPath, [require.resolve("react-scripts/bin/react-scripts.js"), "build"], {
  stdio: "inherit",
  cwd: projectRoot,
  env: { ...process.env, REACT_APP_GUEST_DEMO: "true" },
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

// GitHub Pages serves files directly, so each BrowserRouter page needs an HTML entry.
const buildDirectory = join(projectRoot, "build");
for (const route of ["history", "settings"]) {
  const routeDirectory = join(buildDirectory, route);
  mkdirSync(routeDirectory, { recursive: true });
  copyFileSync(join(buildDirectory, "index.html"), join(routeDirectory, "index.html"));
}

console.log("Created GitHub Pages entry files for /history/ and /settings/.");
