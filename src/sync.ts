import { syncAllSharedFolders } from "./lib/sync.ts";

const DATA_DIR = Deno.env.get("DATA_DIR") || "./dist";

// Main function to execute the logic
const main = async () => {
  await syncAllSharedFolders(DATA_DIR);
};

main();
