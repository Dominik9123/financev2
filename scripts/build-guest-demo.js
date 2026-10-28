const { spawnSync } = require("node:child_process");

// GitHub Pages serves the existing guest demo without a backend.
const result = spawnSync(process.execPath, [require.resolve("react-scripts/bin/react-scripts.js"), "build"], {
  stdio: "inherit",
  env: { ...process.env, REACT_APP_GUEST_DEMO: "true" },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
