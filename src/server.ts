import { CSS, render } from "@deno/gfm";
import { SitemapEntry } from "./lib/publishing.ts";
import { join } from "jsr:@std/path";
import { processMarkdown } from "./lib/markdown.ts";

// Load environment variables
const DEFAULT_HOST = Deno.env.get("DEFAULT_HOST") || "localhost";
const DATA_DIR = Deno.env.get("DATA_DIR") || "./dist";
console.log(">>> DEFAULT_HOST", DEFAULT_HOST);
interface RequestContext {
  host: string;
  slug: string;
  filepath: string;
}

function parseRequest(url: URL): RequestContext {
  const host = url.hostname === "localhost" ? DEFAULT_HOST : url.hostname;
  const pathname = url.pathname;

  // Extract slug from pathname, default to "index"
  let slug = pathname.slice(1) || "index";

  // Remove trailing slash
  if (slug.endsWith("/")) {
    slug = slug.slice(0, -1);
  }

  // If slug is empty, use "index"
  if (!slug) {
    slug = "index";
  }

  let filepath = join(DATA_DIR, host, slug);
  // If there is no extension, default to .md
  if (!slug.match(/\.[^.]+$/)) {
    filepath += ".md";
  }

  console.log(
    ">>> parseRequest filepath",
    filepath,
    "host",
    host,
    "slug",
    slug,
  );
  return { host, slug, filepath };
}

function createErrorPage(title: string, message: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            line-height: 1.6; 
            max-width: 800px; 
            margin: 0 auto; 
            padding: 2rem; 
            background: #f8f9fa;
        }
        .error-container {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
        }
        .error-code {
            font-size: 4rem;
            font-weight: bold;
            color: #dc3545;
            margin: 0;
        }
        .error-title {
            font-size: 1.5rem;
            color: #343a40;
            margin: 1rem 0;
        }
        .error-message {
            color: #6c757d;
            margin-bottom: 2rem;
        }
        .back-link {
            color: #007bff;
            text-decoration: none;
        }
        .back-link:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="error-container">
        <h1 class="error-code">404</h1>
        <h2 class="error-title">${title}</h2>
        <p class="error-message">${message}</p>
        <a href="/" class="back-link">← Go back home</a>
    </div>
</body>
</html>`;
}

// Check presence of service account key at startup
const SERVICE_ACCOUNT_KEY_PATH =
  Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY_PATH") || "service-account-key.json";
const HAS_SERVICE_ACCOUNT_KEY = await Deno.stat(SERVICE_ACCOUNT_KEY_PATH)
  .then(() => true)
  .catch(() => false);

function createMissingServiceAccountPage(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Service Account Key Required</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8f9fa; padding: 2rem; margin: 0; }
    .container { background: #fff; max-width: 720px; margin: 0 auto; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,.1); }
    h1 { color: #343a40; margin-bottom: .5rem; }
    p { color: #6c757d; line-height: 1.6; }
    ol { color: #6c757d; }
    code { background: #f1f3f5; padding: .15rem .35rem; border-radius: 4px; }
  </style>
  </head>
  <body>
    <div class="container">
      <h1>service-account-key.json is missing</h1>
      <p>This server uses a Google Cloud service account for authentication. Place your JSON key file at <code>${SERVICE_ACCOUNT_KEY_PATH}</code>.</p>
      <p>To create and download the key:</p>
      <ol>
        <li>Open Google Cloud Console → IAM & Admin → Service Accounts.</li>
        <li>Create or select a service account. Grant it access to the Drive/Docs you need.</li>
        <li>Go to Keys → Add key → Create new key → JSON, then download.</li>
        <li>Save the file as <code>${SERVICE_ACCOUNT_KEY_PATH}</code> in this project root.</li>
      </ol>
    </div>
  </body>
</html>`;
}

// Remove OAuth flow in favor of service account only

type SitemapRecord = Record<
  string,
  { title?: string; href?: string; redirect?: string; hidden?: boolean }
>;

function generateFooterFromSitemap(sitemap: SitemapRecord): string {
  if (!sitemap || Object.keys(sitemap).length === 0) {
    return "";
  }

  // Organize pages by sections
  const sections: Record<string, Array<{ title: string; href: string }>> = {
    Home: [],
  };

  for (const path in sitemap) {
    const page = sitemap[path];
    if (page.hidden) continue;

    const pathParts = path.split("/").filter(Boolean);

    if (pathParts.length === 0) continue;

    if (pathParts.length === 1) {
      // Root level pages go to Home section
      if (pathParts[0] !== "index") {
        const href = page.redirect || page.href || `/${pathParts[0]}`;
        sections["Home"].push({
          title: page.title || pathParts[0],
          href: href,
        });
      }
    } else {
      // Pages with subfolders
      const sectionName = pathParts[0].replace(/[_\-]/g, " ");
      if (!sections[sectionName]) {
        sections[sectionName] = [];
      }

      const href = page.redirect || page.href || path;
      sections[sectionName].push({
        title: page.title || pathParts[pathParts.length - 1],
        href: href,
      });
    }
  }

  // Filter out empty sections
  const nonEmptySections = Object.entries(sections).filter(
    ([_, pages]) => pages.length > 0,
  );

  if (nonEmptySections.length === 0) {
    return "";
  }

  // Generate footer HTML
  let footerHtml = `
    <footer class="footer bg-gray-900 dark:bg-black text-gray-300 dark:text-gray-400 mt-12 py-12 px-6 md:px-12 lg:px-24 w-full">
      <div class="container max-w-[1200px] mx-auto">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">`;

  for (const [sectionName, pages] of nonEmptySections) {
    footerHtml += `
          <div class="footer-section">
            <h2 class="text-lg font-semibold text-white dark:text-gray-100 mb-4 capitalize">${sectionName}</h2>
            <ul class="space-y-2">
              ${
      pages
        .map(
          (page) => `
                <li>
                  <a class="text-sm text-gray-300 dark:text-gray-400 hover:text-white dark:hover:text-gray-100 transition-colors duration-200" href="${page.href}">${page.title}</a>
                </li>
              `,
        )
        .join("")
    }
            </ul>
          </div>`;
  }

  footerHtml += `
        </div>
      </div>
    </footer>`;

  return footerHtml;
}

async function serveMarkdown(
  markdownText: string,
  host: string,
  slug: string,
): Promise<Response> {
  try {
    const { markdown, pageInfo, footerSitemap } = await processMarkdown(
      markdownText,
      {
        host,
        slug,
      },
    );

    // Convert markdown to HTML using the markdown library
    const body = render(markdown);

    // Generate footer from sitemap
    const footer = generateFooterFromSitemap(footerSitemap);

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${pageInfo.title}</title>
    <link rel="alternate" type="application/rss+xml" title="RSS Feed" href="/feed.xml" />
    <link rel="stylesheet" href="/output.css" />
    <style>
    ${CSS}
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            line-height: 1.6; 
        }
        
        .markdown-body {
            padding: 2rem; 
        }
    </style>
</head>
<body>
<div
  data-color-mode="auto"
  data-light-theme="light"
  data-dark-theme="dark"
  class="markdown-body"
>

        ${body}
    </div>
    ${footer}
</body>
</html>`;

    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return new Response("Page not found", { status: 404 });
    }
    console.error(error);
    return new Response("Internal server error", { status: 500 });
  }
}

async function generateRSSFeed(host: string): Promise<Response> {
  try {
    const sitemap = JSON.parse(
      await Deno.readTextFile(join(DATA_DIR, host, "sitemap.json")),
    );

    // Convert sitemap to array and sort by customDate orptime (newest first)
    const entries = Object.entries(sitemap)
      .map(([path, entry]) => ({
        slug: path.startsWith("/") ? path.slice(1) : path,
        ...(entry as SitemapEntry),
      }))
      .filter((entry) => entry.customDate || entry.ptime) // Only include entries with ptime
      .sort((a, b) => {
        const dateA = a.customDate ?? a.ptime;
        const dateB = b.customDate ?? b.ptime;
        if (!dateA || !dateB) return 0;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });

    // Process entries to include full content
    const processedEntries = await Promise.all(
      entries.map(async (entry) => {
        try {
          // Read the markdown file for this entry
          const markdownPath = join(DATA_DIR, host, entry.slug, ".md");
          console.log(">>> markdownPath", markdownPath);
          const markdown = await Deno.readTextFile(markdownPath);

          // Convert markdown to HTML for the description
          const htmlContent = render(markdown, {
            baseUrl: `https://${host}`,
          });

          // Clean up HTML for RSS (remove script tags, etc.)
          const cleanHtml = htmlContent
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
            .trim();

          return {
            ...entry,
            fullContent: cleanHtml,
            title: entry.title || entry.slug,
          };
        } catch (error) {
          console.warn(`Could not read content for ${entry.slug}:`, error);
          return {
            ...entry,
            fullContent: entry.description || "",
            title: entry.title || entry.slug,
          };
        }
      }),
    );

    const rssContent = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${host}</title>
    <link>https://${host}</link>
    <description>RSS feed for ${host}</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="https://${host}/feed.xml" rel="self" type="application/rss+xml"/>
    ${
      processedEntries
        .map(
          (entry) => `
    <item>
      <title>${entry.title}</title>
      <link>https://${host}/${entry.slug}</link>
      <guid>https://${host}/${entry.slug}</guid>
      <pubDate>${
            new Date(
              entry.customDate ?? entry.ptime,
            ).toUTCString()
          }</pubDate>
      <description><![CDATA[${entry.fullContent}]]></description>
      <content:encoded><![CDATA[${entry.fullContent}]]></content:encoded>
    </item>`,
        )
        .join("")
    }
  </channel>
</rss>`;

    return new Response(rssContent, {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error("Error generating RSS feed:", error);
    return new Response("Error generating RSS feed", { status: 500 });
  }
}

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // If missing service account key, display helpful error for all routes except favicon
  if (!HAS_SERVICE_ACCOUNT_KEY && url.pathname !== "/favicon.ico") {
    const html = createMissingServiceAccountPage();
    return new Response(html, {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // Handle favicon and other common requests
  if (url.pathname === "/favicon.ico") {
    return new Response(null, { status: 204 });
  }

  // Handle RSS feed requests
  if (url.pathname === "/feed.xml") {
    const host = url.hostname === "localhost" ? DEFAULT_HOST : url.hostname;
    return await generateRSSFeed(host);
  }

  // Handle CSS requests
  if (url.pathname === "/output.css") {
    try {
      const cssContent = await Deno.readTextFile(join(DATA_DIR, "output.css"));
      return new Response(cssContent, {
        headers: {
          "Content-Type": "text/css; charset=utf-8",
          "Cache-Control": "public, max-age=3600", // Cache for 1 hour
        },
      });
    } catch (_error) {
      // If CSS file doesn't exist, return empty CSS
      return new Response("", {
        headers: { "Content-Type": "text/css; charset=utf-8" },
      });
    }
  }

  const { host, slug, filepath } = parseRequest(url);

  // Check for static files in DATA_DIR directory first
  const staticFilePath = filepath;
  try {
    const staticFileStat = await Deno.stat(staticFilePath);
    if (staticFileStat.isFile) {
      // Serve static file
      const fileContent = await Deno.readFile(staticFilePath);
      const contentType = getContentType(staticFilePath);
      if (contentType === "text/markdown") {
        // convert fileContent to string
        const fileTextContent = new TextDecoder().decode(fileContent);
        return await serveMarkdown(fileTextContent, host, slug);
      }
      return new Response(fileContent, {
        headers: { "Content-Type": contentType },
      });
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      try {
        await Deno.stat(join(DATA_DIR, host));
        // Host exists but file doesn't - show file not found error
        const errorHtml = createErrorPage(
          "Page Not Found",
          `The page "${slug}" was not found on ${host}.`,
        );
        return new Response(errorHtml, {
          status: 404,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      } catch {
        // Host directory doesn't exist - show host not found error
        const errorHtml = createErrorPage(
          "Host Not Found",
          `The host "${host}" was not found. Please check the URL or contact the administrator.`,
        );
        return new Response(errorHtml, {
          status: 404,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }
    }
    return new Response("Internal server error", { status: 500 });
  }

  // Fallback 404 if nothing matched above
  const errorHtml = createErrorPage(
    "Not Found",
    `The requested resource at "${url.pathname}" was not found.`,
  );
  return new Response(errorHtml, {
    status: 404,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

// Add this helper function to determine content type
function getContentType(filepath: string): string {
  const ext = filepath.split(".").pop()?.toLowerCase();
  const contentTypes: Record<string, string> = {
    html: "text/html; charset=utf-8",
    css: "text/css",
    js: "application/javascript",
    json: "application/json",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    ico: "image/x-icon",
    pdf: "application/pdf",
    txt: "text/plain",
    md: "text/markdown",
  };

  return contentTypes[ext || ""] || "application/octet-stream";
}

const port = parseInt(Deno.env.get("PORT") || "8000");
console.log(`Server running on port ${port}`);
console.log(`Default host: ${DEFAULT_HOST}`);

Deno.serve({ port }, handler);
