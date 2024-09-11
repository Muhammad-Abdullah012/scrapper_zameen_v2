import { CronJob } from "cron";
import { spawn } from "child_process";
import { pool } from "./config";

const job = new CronJob(
  "0 0 * * *",
  function () {
    const task1 = spawn("pnpm", ["run", "start"], {
      stdio: "inherit",
    });
    task1.on("close", (code) => {
      pool.query("REFRESH MATERIALIZED VIEW rankedpropertiesforsale;");
      pool.query("REFRESH MATERIALIZED VIEW rankedpropertiesforrent;");
      pool.query("REFRESH MATERIALIZED VIEW countpropertiesview;");
      // const task2 = spawn("pnpm", ["run", "start-check-availibility"], {
      //   stdio: "inherit",
      // });
    });
  }, // onTick
  null, // onComplete
  true // start
);
