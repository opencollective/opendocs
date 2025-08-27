import { join } from "jsr:@std/path";
import { getGoogleDocId } from "./googledoc.ts";
import { SitemapEntry } from "./publishing.ts";

export function setExtendedAttribute(
  filepath: string,
  key: string,
  value: string
): void {
  try {
    // Use xattr command on macOS/Linux
    const command = new Deno.Command("xattr", {
      args: ["-w", key, value, filepath],
    });

    const { code, stderr } = command.outputSync();
    if (code !== 0) {
      const error = new TextDecoder().decode(stderr);
      throw new Error(`Failed to set xattr: ${error}`);
    }
  } catch (error) {
    console.warn(`Could not set extended attribute ${key}:`, error);

    throw error;
  }
}

export function getExtendedAttribute(
  filepath: string,
  key: string
): string | null {
  const command = new Deno.Command("xattr", {
    args: ["-p", key, filepath],
    stdout: "piped",
    stderr: "piped",
  });
  const { success, stdout } = command.outputSync();
  if (!success) {
    return null;
  }
  return new TextDecoder().decode(stdout);
}

export function writeFileWithMetadata(
  filepath: string,
  content: string | Uint8Array<ArrayBuffer>,
  metadata?: { url?: string; comment?: string }
) {
  if (typeof content === "string") {
    Deno.writeTextFile(filepath, content);
  } else {
    Deno.writeFile(filepath, content);
  }
  if (metadata?.comment) {
    setExtendedAttribute(
      filepath,
      "com.apple.metadata:kMDItemComment",
      metadata.comment
    );
  }
  if (metadata?.url) {
    setExtendedAttribute(
      filepath,
      "com.apple.metadata:kMDItemWhereFroms",
      metadata.url
    );
  }
}

export async function listFiles(filepath: string) {
  const files = [];
  for await (const entry of Deno.readDir(filepath)) {
    if (entry.isFile) {
      const fullPath = join(filepath, entry.name);
      const stat = Deno.statSync(fullPath);
      const mtime = stat.mtime;
      const url = getExtendedAttribute(
        fullPath,
        "com.apple.metadata:kMDItemWhereFroms"
      );
      const googleDocId = url ? getGoogleDocId(url) : null;
      files.push({ name: entry.name, mtime, url, googleDocId });
    }
  }
  return files;
}

export function getSitemapEntryByGoogleDocId(
  sitemap: Record<string, SitemapEntry>,
  googleDocId: string
) {
  return Object.values(sitemap).find(
    (entry) => entry.googleDocId === googleDocId
  );
}

export function updateSitemapForHost(
  host: string,
  sitemap: Record<string, SitemapEntry>
) {
  const sitemapPath = `./dist/${host}/sitemap.json`;

  // Remove the host from the sitemap keys
  Object.keys(sitemap).forEach((key) => {
    sitemap[key.replace(`/dist/${host}`, "")] = sitemap[key];
    delete sitemap[key];
  });

  // Merge the existing sitemap with the new sitemap (if any)
  try {
    const existingSitemap = JSON.parse(Deno.readTextFileSync(sitemapPath));
    Object.keys(existingSitemap).forEach((key) => {
      if (!sitemap[key]) {
        sitemap[key] = existingSitemap[key];
      }
    });
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      console.log(">>> sitemap not found, creating new one");
    } else {
      console.error(">>> error updating sitemap", error);
    }
  }

  try {
    // Write the sitemap to the file
    Deno.writeTextFileSync(sitemapPath, JSON.stringify(sitemap, null, 2));
  } catch (error) {
    console.error(">>> error writing sitemap", error);
  }
}
