import { join } from "jsr:@std/path";
import { Folder, listGoogleDocs, listFolders } from "./googleapi.ts";
import { downloadGoogleDoc } from "./googledoc.ts";
import { listFiles, getSitemapEntryByGoogleDocId } from "./utils.ts";

export type SitemapEntry = {
  googleDocId: string;
  slug: string;
  src: string;
  ctime: Date;
  mtime: Date;
  ptime?: Date;
  customDate?: Date;
  title: string;
  files: string[];
};

type urlpath = `/${string}`;

export const publishDocsInFolder = async (
  auth: any,
  folder: Folder,
  basePath: string = "./dist",
  sitemap: Record<urlpath, SitemapEntry> = {}
) => {
  const folderPath = join(basePath, folder.name.replace(/\//g, "-"));
  console.log(">>> publishDocsInFolder", folderPath);
  Deno.mkdirSync(folderPath, { recursive: true });
  const docsMetadata = await listGoogleDocs(auth, folder.id);
  await Promise.all(
    docsMetadata.map(async (docMetadata) => {
      const sitemapEntry = getSitemapEntryByGoogleDocId(
        sitemap,
        docMetadata.id
      );

      if (
        new Date((sitemapEntry && sitemapEntry.mtime) ?? 0) >= docMetadata.mtime
      ) {
        console.log(`Skipping ${docMetadata.name} because it is up to date`);
        return;
      }
      const res = await downloadGoogleDoc(auth, docMetadata, folderPath);
      console.log(res);
      if (res && res.slug) {
        sitemap[`/${folderPath}/${res.slug}` as urlpath] = {
          googleDocId: docMetadata.id,
          slug: res.slug,
          src: docMetadata.src,
          ctime: docMetadata.ctime,
          mtime: docMetadata.mtime,
          ptime: docMetadata.ptime,
          customDate: res.date ?? undefined,
          title: res.title,
          files: res.files,
        };
      }
    })
  );
  const subFolders = await listFolders(auth, folder.id);
  await Promise.all(
    subFolders.map(async (subFolder) => {
      await publishDocsInFolder(auth, subFolder, folderPath, sitemap);
    })
  );
  return sitemap;
};
