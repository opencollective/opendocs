import { authorize, listSharedFolders } from "./lib/googleapi.ts";
import { publishDocsInFolder, SitemapEntry } from "./lib/publishing.ts";
import { updateSitemapForHost } from "./lib/utils.ts";

// Main function to execute the logic
const main = async () => {
  try {
    const auth = await authorize();

    const folders = await listSharedFolders(auth);
    await folders.forEach(async (folder) => {
      console.log(
        "Publishing",
        folder.name,
        `(https://drive.google.com/drive/u/0/folders/${folder.id})`
      );
      let existingSitemap: Record<string, SitemapEntry> = {};
      try {
        const sitemapText = await Deno.readTextFile(
          `./dist/${folder.name}/sitemap.json`
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
        "./dist",
        existingSitemap
      );
      updateSitemapForHost(folder.name, sitemap);
    });
  } catch (error) {
    console.error(error);
  }
};

main();
