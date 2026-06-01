import { startServer } from "./src/app.mjs";

startServer().catch((err) => {
  console.error(err);
  process.exit(1);
});
