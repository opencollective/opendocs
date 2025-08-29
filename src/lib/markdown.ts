// import { Buffer } from "node:buffer";
import { dirname, join, relative } from "jsr:@std/path";
import * as chrono from "npm:chrono-node";
import { SitemapEntry } from "./publishing.ts";
import { getGoogleDocId } from "./googledoc.ts";
import { youtube } from "../embeds/youtube.ts";

const DATA_DIR = Deno.env.get("DATA_DIR") || "./dist";

// Function to extract base64 images from markdown and save them as separate files
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64); // Decodes Base64 to a binary string
  const len = binaryString.length;
  const bytes = new Uint8Array(len);

  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i); // Convert to byte array
  }
  return bytes;
}

/**
 * Extract date from first few lines of markdown
 * @param text - markdown text
 * Supported formats:
 * - 2025-08-18
 * - January 30, 2025
 * - 18 Aug 2025
 * @returns Date object or null
 */
export function extractDateText(markdown: string) {
  const text = markdown.split("\n").slice(0, 5).join("\n");
  const results = chrono.strict.parse(text);
  const full = results.find(
    (r) =>
      r.start?.isCertain("day") &&
      r.start?.isCertain("month") &&
      r.start?.isCertain("year"),
  );
  return full ? full.date() : null;
}

export async function extractImagesFromMarkdown(
  markdownFile: string,
  prefix: string,
  images: Map<string, string>,
) {
  console.log(`Extracting images from ${markdownFile}`);
  const markdownContent = await Deno.readTextFile(markdownFile);

  // Extract date from first few lines
  const date = extractDateText(markdownContent);

  //  [image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAloAAAFRCAYAAACsdAO0AACAAElEQVR4XmzcBXgV1/rw7dNzTilWnACBCDHiQtzd3d3d3QghCcHiJISQBEhwdylWSg1qVKlAC3XqUFooUOz3PXtz3r9875vrWtfsPXtm9sia9dzPmrXzj039q9g62M6OoS52jvSxa9M6Xjl9jNfPnmR1+0pGBteydnUXh/fv4aWTx9k1soG+lkZWVhbRXlFAX105/YsqWF1XRk9tKV3yvm1RNWtWtdLfsYr2ZS1kpyTi4WCDrbEBOrNmoD1hHGbTJmM/dzre+ur4GWhKUSPUSp/
  const imageRegex =
    /\[([^\]]+)\]: ?<data:image\/(png|gif|jpg);base64,([^>]+)>/gm;
  let match;
  let updatedMarkdown = markdownContent;
  const outputPath = join(dirname(markdownFile), "images");
  // Ensure output directory exists
  try {
    await Deno.mkdir(outputPath);
  } catch (_e) {
    // Directory might already exist, which is fine
  }

  const imagePaths = [];
  while ((match = imageRegex.exec(markdownContent)) !== null) {
    const altText = match[1]; // Alt text for the image
    const imageType = match[2]; // Image type (png, jpeg, etc.)
    const base64Data = match[3]; // Base64-encoded image data

    // Create image file name and path
    const imageName = `${prefix}_${altText || "image"}.${imageType}`;
    const imagePath = join(outputPath, imageName);

    // Decode the base64 image data
    try {
      let imageBuffer;
      if (images.get(altText)) {
        const response = await fetch(images.get(altText) as string);
        try {
          const imageData = await response.arrayBuffer();
          // Convert to Uint8Array instead of Node.js Buffer
          imageBuffer = new Uint8Array(imageData);
        } finally {
          // Ensure response is properly closed
          if (!response.bodyUsed) {
            await response.body?.cancel();
          }
        }
      } else {
        // Use Deno's built-in base64 decoding instead of Node.js Buffer
        // Node.js: imageBuffer = Buffer.from(base64Data, "base64");
        imageBuffer = base64ToUint8Array(base64Data);
      }

      await Deno.writeFile(imagePath, imageBuffer);
      console.log(`Image saved as ${imagePath}`);
      imagePaths.push(imagePath);
      // Update the markdown content to point to the saved image
      const relativeImagePath = `./${
        relative(
          dirname(markdownFile),
          imagePath,
        )
      }`;
      updatedMarkdown = updatedMarkdown
        .replace(match[0], "")
        .replace(`![][${altText}]`, `![${altText}](${relativeImagePath})`);
      // Save the updated markdown file
    } catch (e) {
      console.error("Error decoding base64 data", e);
    }
  }
  await Deno.writeTextFile(markdownFile, updatedMarkdown);
  console.log(`Updated markdown saved as ${markdownFile}`);

  return {
    markdown: updatedMarkdown,
    images: imagePaths,
    date,
  };
}

type PathInfo = {
  path: string;
  title: string;
  href: string;
  googleDocId?: string;
  redirect?: string;
  hidden: boolean;
};

/**
 * Extract sitemap from footer of markdown
 * @param markdown - markdown text in the format
 * /path, title, url
 * /path, [title](url)
 * /path, url (for redirects)
 * @returns sitemap
 */

export type FooterItem = {
  title: string;
  href: string;
  path: string;
  hidden: boolean;
  redirect?: string;
  src?: string;
};

export function extractFooterSitemap(
  markdown: string,
): Record<string, FooterItem> {
  const sitemap: Record<string, FooterItem> = {};

  const lines = markdown.split("\n");
  for (let line of lines) {
    const FooterItem: FooterItem = {
      path: "",
      title: "",
      href: "",
      redirect: undefined,
      hidden: false,
    };
    line = line.trim();
    if (line.match(/^\(.*\)$/)) {
      line = line.substring(1, line.length - 1);
      FooterItem.hidden = true;
    } else {
      if (line.substring(0, 1) != "/") {
        continue;
      }
    }

    const parts = line.split(",").map((s) => s.trim());

    if (parts && parts.length === 1) continue;

    FooterItem.path = parts[0].toLowerCase();

    if (parts.length === 2) {
      FooterItem.href = parts[1];
    }

    if (parts.length === 3) {
      FooterItem.title = parts[1];
      FooterItem.href = parts[2];
    }

    const matches = FooterItem.href.match(/^\[(.*)\]\((.*)\)$/);
    if (matches) {
      FooterItem.title = FooterItem.title || matches[1];
      FooterItem.href = matches[2];
    }
    const googleDocId = getGoogleDocId(FooterItem.href);
    if (googleDocId) {
      FooterItem.src = `https://docs.google.com/document/d/${googleDocId}/edit`;
    } else {
      if (
        FooterItem.href.match(/^https?:\/\//) ||
        FooterItem.href.match(/^mailto:/)
      ) {
        FooterItem.redirect = FooterItem.href;
      }
    }
    sitemap[FooterItem.path] = FooterItem;
  }
  return sitemap;
}

export async function processMarkdown(
  markdown: string,
  {
    host,
    path,
    sitemap,
  }: { host: string; path: string; sitemap?: Record<string, SitemapEntry> },
): Promise<{
  markdown: string;
  pageInfo: SitemapEntry;
  sitemap: Record<string, SitemapEntry>;
  footerItems: Record<string, FooterItem>;
}> {
  const _sitemap = sitemap ||
    (JSON.parse(
      await Deno.readTextFile(join(DATA_DIR, host, "sitemap.json")),
    ) as Record<string, SitemapEntry>);
  const sitemapEntryByGoogleDocId: Record<string, SitemapEntry> = {};
  Object.keys(_sitemap).forEach((key) => {
    sitemapEntryByGoogleDocId[_sitemap[key].googleDocId] = _sitemap[key];
    sitemapEntryByGoogleDocId[_sitemap[key].googleDocId].path = key;
  });

  const pageInfo = _sitemap[path];

  // Replace all occurences of [.*](https://docs.google.com/document/d/1nB_HlbaST2TBYyinxZLKcz0dwjGLi0uKkeKhLxeEpw8/edit?tab=t.0#heading=h.d0xroirb1ubp) with [.*](slug) if googleDocId is part of the sitemap
  let newMarkdown = markdown.replace(
    /\[(.*)\]\((https:\/\/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)\/edit\?[^\)]+)\)/g,
    (match, anchor, _, googleDocId) => {
      if (googleDocId) {
        const sitemapEntry = sitemapEntryByGoogleDocId[googleDocId];
        if (sitemapEntry) {
          return `[${anchor}](${sitemapEntry.path})`;
        } else {
          console.log(">>> no sitemapEntry for", googleDocId, match);
        }
      }
      return match;
    },
  );
  let footerSitemap: Record<string, PathInfo> = {};

  newMarkdown = newMarkdown // Youtube embeds
    .replace(
      /\[https?:\/\/(www\.)?(youtu.be\/|youtube.com\/(embed\/|watch\?v=))([\\a-z0-9_-]{11,12})[^\]]*\]\(https?:\/\/(www\.)?(youtu.be\/|youtube.com\/(embed\/|watch\?v=))([a-z0-9_-]{11})[^\)]*\)/gi,
      (_match, _p1, _p2, _p3, p4, _p5, _p6) =>
        `\n\n${youtube(p4.replace(/\\/g, "")).replace(/\s\s+/g, " ")}\n`,
    );

  // Extract footer from markdown
  if (newMarkdown.match(/^\-\-\-$/gm)) {
    const parts = newMarkdown.split(/^\-\-\-$/gm);
    if (parts.length > 1) {
      newMarkdown = parts.slice(0, -1).join("\n---\n");
      const footer = parts[parts.length - 1];
      footerSitemap = extractFooterSitemap(footer);
    }
  }

  return {
    markdown: newMarkdown,
    pageInfo,
    sitemap: _sitemap,
    footerItems: footerSitemap,
  };
}
