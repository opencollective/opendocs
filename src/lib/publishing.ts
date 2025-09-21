import { join } from "@std/path";
import {
  Folder,
  GoogleAuthObject,
  listFolders,
  listGoogleDocs,
} from "./googleapi.ts";
import { downloadGoogleDoc } from "./googledoc.ts";
import { getSitemapEntryByGoogleDocId } from "./utils.ts";
const DATA_DIR = Deno.env.get("DATA_DIR") || "./dist";
import { Nostr } from "./nostr.ts";

const nostr = Nostr.getInstance();
export type SitemapEntry = {
  googleDocId: string;
  path: string;
  src: string;
  ctime: Date;
  mtime: Date;
  ptime?: Date;
  thumbnail: string;
  customDate?: Date;
  title: string;
  description: string;
  tags: string[][];
  files: string[];
  images: string[];
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
): Promise<Record<urlpath, SitemapEntry>> => {
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
      if (res && res.slug) {
        const path = `/${folderPath}/${res.slug}` as urlpath;
        try {
          await nostr?.publishMarkdown(path, {
            title: res.title,
            content: res.markdown,
            published_at: res.date || docMetadata.ptime || new Date(),
            tags: res.tags,
          });
        } catch (error) {
          console.error(
            "Failed to publish markdown to Nostr",
            error,
            "path:",
            path,
          );
        }
        sitemap[path] = {
          googleDocId: docMetadata.id,
          path,
          src: docMetadata.src,
          ctime: docMetadata.ctime,
          mtime: docMetadata.mtime,
          ptime: docMetadata.ptime,
          thumbnail: docMetadata.thumbnail,
          customDate: res.date ?? undefined,
          title: res.title,
          description: res.description,
          tags: res.tags,
          files: res.files,
          images: res.images,
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
