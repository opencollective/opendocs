import { expect } from "jsr:@std/expect/expect";
import { processMarkdown } from "../src/lib/markdown.ts";
import { SitemapEntry } from "../src/lib/publishing.ts";

// Deno.test("Extract images from markdown", async () => {
//   Deno.copyFileSync(
//     "./tests/fixtures/published.md",
//     "./tests/output/published.md"
//   );
//   const stats = await Deno.stat("./tests/output/published.md");
//   const originalMarkdownFileSize = stats.size;
//   const images = new Map<string, string>();
//   images.set(
//     "image1",
//     "https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png"
//   );
//   const res = await extractImagesFromMarkdown(
//     "./tests/output/published.md",
//     "published",
//     images
//   );
//   // expect(res.images.length).toBe(1);
//   // expect(res.images[0]).toBe("./tests/output/images/published_image1.png");

//   const stats2 = await Deno.stat("./tests/output/published.md");
//   const updatedMarkdownFileSize = stats2.size;

//   console.log(">>> originalMarkdownFileSize", originalMarkdownFileSize);
//   console.log(">>> updatedMarkdownFileSize", updatedMarkdownFileSize);
//   expect(originalMarkdownFileSize).toBeGreaterThan(updatedMarkdownFileSize);
//   console.log({ date: res.date, markdown: res.markdown.length, images });
//   expect(res.date).toBeDefined();
//   expect(res.date?.toISOString()).toBe("2017-01-30T11:00:00.000Z");
// });

Deno.test("Process markdown", async () => {
  const markdown = await Deno.readTextFile("./tests/fixtures/index.md");
  const {
    markdown: newMarkdown,
    pageInfo,
    footerSitemap,
  } = await processMarkdown(markdown, {
    host: "xavierdamman.com",
    slug: "index",
    sitemap: JSON.parse(
      await Deno.readTextFile(`./tests/fixtures/sitemap.json`),
    ) as Record<string, SitemapEntry>,
  });
  expect(footerSitemap["/socials/twitter"]).toBeDefined();
  expect(footerSitemap["/socials/twitter"].title).toBe("Twitter");
  expect(footerSitemap["/socials/twitter"].href).toBe("https://x.com/xdamman");
  expect(footerSitemap["/twitter"].redirect).toBe("https://x.com/xdamman");
  expect(footerSitemap["/twitter"].hidden).toBeTruthy();
  expect(footerSitemap["/blog/2017/from-firms-to-collectives"]).toBeDefined();
  expect(footerSitemap["/blog/2017/from-firms-to-collectives"].title).toBe(
    "From Firms to Collectives",
  );
  expect(footerSitemap["/blog/2017/from-firms-to-collectives"].href).toBe(
    "/blog/2017/from-firms-to-collectives",
  );
  expect(
    footerSitemap["/blog/2017/from-firms-to-collectives"].redirect,
  ).toBeUndefined();
  expect(
    footerSitemap["/blog/2017/from-firms-to-collectives"].hidden,
  ).toBeTruthy();

  expect(footerSitemap["/projects/citizengarden"].hidden).toBeFalsy();
  expect(footerSitemap["/projects/citizengarden"].redirect).toBe(
    "https://citizenspring.earth/citizengarden",
  );
  expect(footerSitemap["/about"].hidden).toBeFalsy();
  expect(footerSitemap["/about"].redirect).toBeUndefined();
  expect(footerSitemap["/about"].href).toBe("/about");

  expect(newMarkdown).toBeDefined();
  expect(pageInfo).toBeDefined();
  expect(footerSitemap).toBeDefined();
});
