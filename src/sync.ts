import {
  authorize,
  getLatestActivities,
  listSharedFolders,
} from "./lib/googleapi.ts";
import { join } from "jsr:@std/path";
import { publishDocsInFolder, SitemapEntry } from "./lib/publishing.ts";
import { updateSitemapForHost } from "./lib/utils.ts";

const DATA_DIR = Deno.env.get("DATA_DIR") || "./dist";

// Main function to execute the logic
const main = async () => {
  const startTime = performance.now();
  let lastProcessedFolders: { [key: string]: string } = {};
  try {
    const text = await Deno.readTextFile(
      join(DATA_DIR, "processedFolders.json"),
    );
    lastProcessedFolders = JSON.parse(text) as {
      [key: string]: string;
    };
  } catch {
    lastProcessedFolders = {};
  }

  try {
    const auth = await authorize();
    const folders = await listSharedFolders(auth);

    await Promise.all(
      folders.map(async (folder) => {
        console.log(
          "Publishing",
          folder.name,
          `(https://drive.google.com/drive/u/0/folders/${folder.id})`,
        );
        const lastActivities = await getLatestActivities(auth, folder.id, 1);
        if (
          lastProcessedFolders[folder.id] === lastActivities?.[0]?.timestamp
        ) {
          console.log(
            ">>> Skipping",
            folder.name,
            `(https://drive.google.com/drive/u/0/folders/${folder.id})`,
          );
          return;
        }
        let existingSitemap: Record<string, SitemapEntry> = {};
        try {
          const sitemapText = await Deno.readTextFile(
            join(DATA_DIR, folder.name, "sitemap.json"),
          );
          existingSitemap = JSON.parse(sitemapText) as Record<
            string,
            SitemapEntry
          >;
        } catch {
          existingSitemap = {};
        }
        const sitemap = await publishDocsInFolder(
          auth,
          folder,
          DATA_DIR,
          existingSitemap,
        );
        updateSitemapForHost(folder.name, sitemap);
        lastProcessedFolders[folder.id] = lastActivities?.[0]?.timestamp ??
          new Date().toISOString();
      }),
    );
    console.log(">>> processedFolders", lastProcessedFolders);
    await Deno.writeTextFile(
      join(DATA_DIR, "processedFolders.json"),
      JSON.stringify(lastProcessedFolders, null, 2),
    );
  } catch (error) {
    console.error(error);
  } finally {
    const endTime = performance.now();
    const elapsedSeconds = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`\nScript completed in ${elapsedSeconds} seconds`);
  }
};

main();
