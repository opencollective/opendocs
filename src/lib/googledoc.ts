import { join } from "jsr:@std/path";
import { getGoogleDocContent, GoogleAuthObject } from "./googleapi.ts";
import { extractImagesFromMarkdown } from "./markdown.ts";
import { writeFileWithMetadata } from "./utils.ts";
import slugify from "npm:slugify";

// Define a proper type for auth instead of any
type Auth = {
  credentials: {
    access_token: string;
  };
};

type Element = {
  inlineObjectElement: { inlineObjectId: string };
};

export type GoogleDocMetadata = {
  id: string;
  name: string;
  src: string;
  ctime: Date;
  mtime: Date;
  ptime?: Date;
};

export type DownloadedGoogleDoc = {
  googleDocId: string;
  title: string;
  slug: string;
  date: Date | null;
  files: string[];
};

export async function downloadGoogleDoc(
  auth: GoogleAuthObject,
  doc: GoogleDocMetadata,
  downloadPath: string
): Promise<DownloadedGoogleDoc | undefined> {
  const googleDocId = doc.id;
  if (!doc.ptime) {
    console.log(`Skipping ${googleDocId} because it is not published`);
    return;
  }

  console.log(
    ">>> processing",
    `https://docs.google.com/document/d/${googleDocId}/edit`
  );
  console.log("downloadGoogleDoc to", downloadPath);
  try {
    Deno.mkdirSync(downloadPath, { recursive: true });
  } catch (_e) {
    // Directory might already exist, which is fine
  }

  const data = await getGoogleDocContent(auth, googleDocId);
  const name = data?.title || googleDocId;
  const downloadedFiles: string[] = [];
  const inlineObjectElements: string[] = [];
  data?.body.content.forEach((block) => {
    if (!block.paragraph?.elements?.length) {
      return;
    }
    block.paragraph.elements.forEach((element) => {
      if (element.inlineObjectElement) {
        inlineObjectElements.push(element.inlineObjectElement.inlineObjectId);
      }
    });
  });

  const images = new Map<string, string>();
  for (let i = 0; i < inlineObjectElements.length; i++) {
    const inlineObjectId = inlineObjectElements[i];
    images.set(
      `image${i + 1}`,
      data?.inlineObjects[inlineObjectId]?.inlineObjectProperties.embeddedObject
        ?.imageProperties.contentUri || ""
    );
  }

  const slug = slugify.default(name.replaceAll("/", "-"), {
    lower: true,
    remove: /[*+~.()'"!:@]/g,
  });
  const markdownFile = await downloadFormat(
    auth,
    googleDocId,
    join(downloadPath, slug + ".md"),
    "markdown"
  );
  downloadedFiles.push(markdownFile);
  const res = await extractImagesFromMarkdown(markdownFile, slug, images);
  downloadedFiles.push(...res.images);
  const pdfFile = await downloadFormat(
    auth,
    googleDocId,
    join(downloadPath, slug + ".pdf"),
    "pdf"
  );
  downloadedFiles.push(pdfFile);
  const downloadedGoogleDoc = {
    googleDocId,
    title: name,
    date: res.date,
    slug,
    files: downloadedFiles,
  };
  return downloadedGoogleDoc;
}

export async function downloadFormat(
  auth: GoogleAuthObject,
  googleDocId: string,
  filepath: string,
  format: string
): Promise<string> {
  const exportUrl = `https://docs.google.com/feeds/download/documents/export/Export?id=${googleDocId}&exportFormat=${format}`;
  console.log(`Downloading ${exportUrl}`);

  const response = await fetch(exportUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${auth.credentials.access_token}`, // Include access token
    },
  });

  try {
    if (format === "markdown") {
      const markdown = await response.text();
      writeFileWithMetadata(filepath, markdown, {
        url: `https://docs.google.com/document/d/${googleDocId}/edit`,
      });
    }
    if (format === "pdf") {
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      writeFileWithMetadata(filepath, uint8Array, {
        url: `https://docs.google.com/document/d/${googleDocId}/edit`,
      });
    }
    console.log(`Downloaded ${filepath}`);
    return filepath;
  } finally {
    // Ensure the response body is properly closed
    if (!response.bodyUsed) {
      await response.body?.cancel();
    }
  }
}

export function getGoogleDocId(url: string) {
  const match = url.match(
    /https:\/\/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/
  );
  return match ? match[1] : null;
}
