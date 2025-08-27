import { dirname, join } from "jsr:@std/path";
import { getGoogleDocId } from "./googledoc.ts";
import { SitemapEntry } from "./publishing.ts";

const attributes: Record<string, string> = {};

if (Deno.build.os === "darwin") {
  attributes.comment = "com.apple.metadata:kMDItemComment";
  attributes.url = "com.apple.metadata:kMDItemWhereFroms";
} else {
  attributes.comment = "user.comment";
  attributes.url = "user.url";
}

const DATA_DIR = Deno.env.get("DATA_DIR") || "./dist";

export function setExtendedAttribute(
  filepath: string,
  key: string,
  value: string,
): void {
  try {
    let command: Deno.Command;

    if (Deno.build.os === "darwin") {
      // macOS: use xattr
      command = new Deno.Command("xattr", {
        args: ["-w", key, value, filepath],
      });
    } else {
      // Linux: use setfattr
      command = new Deno.Command("setfattr", {
        args: ["-n", key, "-v", value, filepath],
      });
    }

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
  key: string,
): string | null {
  let command: Deno.Command;

  if (Deno.build.os === "darwin") {
    // macOS: use xattr
    command = new Deno.Command("xattr", {
      args: ["-p", key, filepath],
      stdout: "piped",
      stderr: "piped",
    });
  } else {
    // Linux: use getfattr
    command = new Deno.Command("getfattr", {
      args: ["-n", key, filepath],
      stdout: "piped",
      stderr: "piped",
    });
  }

  const { success, stdout } = command.outputSync();
  if (!success) {
    return null;
  }
  return new TextDecoder().decode(stdout);
}

export function writeFileWithMetadata(
  filepath: string,
  content: string | Uint8Array<ArrayBuffer>,
  metadata?: { url?: string; comment?: string },
) {
  Deno.mkdirSync(dirname(filepath), { recursive: true });

  if (typeof content === "string") {
    Deno.writeTextFile(filepath, content);
  } else {
    Deno.writeFile(filepath, content);
  }
  if (metadata?.comment) {
    setExtendedAttribute(filepath, attributes.comment, metadata.comment);
  }
  if (metadata?.url) {
    setExtendedAttribute(filepath, attributes.url, metadata.url);
  }
}

export async function listFiles(filepath: string) {
  const files = [];
  for await (const entry of Deno.readDir(filepath)) {
    if (entry.isFile) {
      const fullPath = join(filepath, entry.name);
      const stat = Deno.statSync(fullPath);
      const mtime = stat.mtime;
      const url = getExtendedAttribute(fullPath, attributes.url);
      const googleDocId = url ? getGoogleDocId(url) : null;
      files.push({ name: entry.name, mtime, url, googleDocId });
    }
  }
  return files;
}

export function getSitemapEntryByGoogleDocId(
  sitemap: Record<string, SitemapEntry>,
  googleDocId: string,
) {
  return Object.values(sitemap).find(
    (entry) => entry.googleDocId === googleDocId,
  );
}

export function updateSitemapForHost(
  host: string,
  sitemap: Record<string, SitemapEntry>,
) {
  const sitemapPath = join(DATA_DIR, host, "sitemap.json");

  // Remove the host from the sitemap keys
  Object.keys(sitemap).forEach((key) => {
    const indexOf = key.indexOf(`/${host}/`);
    sitemap[key.substring(indexOf + host.length + 1)] = sitemap[key];
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
