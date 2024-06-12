import { CronJob } from "cron";
import { spawn } from "child_process";

const job = new CronJob(
  "0 4 * * *",
  function () {
    const task1 = spawn("pnpm", ["run", "start"], {
      stdio: "inherit",
    });
    task1.on("close", (code) => {
      const task2 = spawn("pnpm", ["run", "start-check-availibility"], {
        stdio: "inherit",
      });
    });
  }, // onTick
  null, // onComplete
  true // start
);
