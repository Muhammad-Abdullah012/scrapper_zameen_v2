import { CronJob } from "cron";
import { spawn } from "child_process";

const job = new CronJob(
  "0 4 * * *",
  function () {
    spawn("pnpm", ["run", "start"], {
      stdio: "inherit",
    });
  }, // onTick
  null, // onComplete
  true // start
);

const job2 = new CronJob(
  "0 20 * * *",
  function () {
    spawn("pnpm", ["run", "start-check-availibility"], {
      stdio: "inherit",
    });
  }, // onTick
  null, // onComplete
  true // start
);
