import { join } from "jsr:@std/path";
import {
  Folder,
  GoogleAuthObject,
  listFolders,
  listGoogleDocs,
} from "./googleapi.ts";
import { downloadGoogleDoc } from "./googledoc.ts";
import { getSitemapEntryByGoogleDocId } from "./utils.ts";
const DATA_DIR = Deno.env.get("DATA_DIR") || "./dist";

export type SitemapEntry = {
  googleDocId: string;
  path: string;
  src: string;
  ctime: Date;
  mtime: Date;
  ptime?: Date;
  customDate?: Date;
  title: string;
  files: string[];
};

type urlpath = `/${string}`;

// Define a proper type for auth instead of any
type Auth = {
  credentials: {
    access_token: string;
  };
};

export const publishDocsInFolder = async (
  auth: GoogleAuthObject,
  folder: Folder,
  basePath: string = DATA_DIR,
  sitemap: Record<urlpath, SitemapEntry> = {},
) => {
  const folderPath = join(basePath, folder.name.replace(/\//g, "-"));
  console.log(">>> publishDocsInFolder", folderPath);
  Deno.mkdirSync(folderPath, { recursive: true });
  const docsMetadata = await listGoogleDocs(auth, folder.id);
  await Promise.all(
    docsMetadata.map(async (docMetadata) => {
      const sitemapEntry = getSitemapEntryByGoogleDocId(
        sitemap,
        docMetadata.id,
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
        const path = `/${folderPath}/${res.slug}` as urlpath;
        sitemap[path] = {
          googleDocId: docMetadata.id,
          path,
          src: docMetadata.src,
          ctime: docMetadata.ctime,
          mtime: docMetadata.mtime,
          ptime: docMetadata.ptime,
          customDate: res.date ?? undefined,
          title: res.title,
          files: res.files,
        };
      }
    }),
  );
  const subFolders = await listFolders(auth, folder.id);
  await Promise.all(
    subFolders.map(async (subFolder) => {
      await publishDocsInFolder(auth, subFolder, folderPath, sitemap);
    }),
  );
  return sitemap;
};
