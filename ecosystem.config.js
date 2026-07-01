// PM2 process file: `pm2 start ecosystem.config.js`
// Runs the dashboard (Next.js) and the price-monitoring worker side by side.
module.exports = {
  apps: [
    {
      name: "flight-searcher-web",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      env: { NODE_ENV: "production" },
      max_restarts: 10,
    },
    {
      name: "flight-searcher-worker",
      script: "node_modules/tsx/dist/cli.mjs",
      args: "src/worker/index.ts",
      env: { NODE_ENV: "production" },
      // Back off if the worker crash-loops (e.g. bad credentials)
      exp_backoff_restart_delay: 5000,
    },
  ],
};
