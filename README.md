# Overview

This project uses Cheerio and Axios to scrape data from zameen.com website. It is built using TypeScript and utilizes PNPM as the package manager.

## Cronjob

The project includes a Cronjob that runs daily at 4:00 AM (UTC) using the following schedule: `0 4 * * *`. To start the Cronjob, run the following command:

```bash
pnpm start-cronjob
```

## Running the Scraper Directly

To run the scraper directly without the Cronjob, use the following command:

```bash
pnpm start
```

## Setup

1. Clone the repository and navigate to the project directory
2. Run pnpm install to install dependencies
3. Run pnpm start-cronjob to start the Cronjob or pnpm start to run the scraper directly
