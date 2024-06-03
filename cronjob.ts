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
