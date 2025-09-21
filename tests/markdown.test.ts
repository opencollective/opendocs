import { expect } from "jsr:@std/expect/expect";
import {
  extractDateText,
  extractDescription,
  extractImagesFromMarkdown,
  extractTags,
  extractTitle,
  processMarkdown,
} from "../src/lib/markdown.ts";
import { SitemapEntry } from "../src/lib/publishing.ts";
import { youtube } from "../src/embeds/youtube.ts";

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
//   console.log(">>> res.title", res.title);
//   console.log(">>> res.date", res.date);
//   console.log(">>> res.description", res.description);
//   const stats2 = await Deno.stat("./tests/output/published.md");
//   const updatedMarkdownFileSize = stats2.size;

//   expect(res.title).toBe("From Firms to Collectives");
//   expect(res.description).toBe(
//     "Moving beyond the old model of private firms to create economic value together."
//   );

//   console.log(">>> originalMarkdownFileSize", originalMarkdownFileSize);
//   console.log(">>> updatedMarkdownFileSize", updatedMarkdownFileSize);
//   expect(originalMarkdownFileSize).toBeGreaterThan(updatedMarkdownFileSize);
//   expect(res.date).toBeDefined();
//   expect(res.date?.toISOString()).toBe("2017-01-30T12:00:00.000Z");
// });

// Deno.test("Process markdown", async () => {
//   const markdown = await Deno.readTextFile("./tests/fixtures/index.md");
//   const {
//     markdown: newMarkdown,
//     pageInfo,
//     footerItems,
//   } = await processMarkdown(markdown, {
//     host: "xavierdamman.com",
//     path: "/index",
//     sitemap: JSON.parse(
//       await Deno.readTextFile(`./tests/fixtures/sitemap.json`)
//     ) as Record<string, SitemapEntry>,
//   });
//   expect(footerItems["/socials/twitter"]).toBeDefined();
//   expect(footerItems["/socials/twitter"].title).toBe("Twitter");
//   expect(footerItems["/socials/twitter"].href).toBe("https://x.com/xdamman");
//   expect(footerItems["/twitter"].redirect).toBe("https://x.com/xdamman");
//   expect(footerItems["/twitter"].hidden).toBeTruthy();
//   expect(footerItems["/blog/2017/from-firms-to-collectives"]).toBeDefined();
//   expect(footerItems["/blog/2017/from-firms-to-collectives"].title).toBe(
//     "From Firms to Collectives"
//   );
//   expect(footerItems["/blog/2017/from-firms-to-collectives"].href).toBe(
//     "/blog/2017/from-firms-to-collectives"
//   );
//   expect(
//     footerItems["/blog/2017/from-firms-to-collectives"].redirect
//   ).toBeUndefined();
//   expect(
//     footerItems["/blog/2017/from-firms-to-collectives"].hidden
//   ).toBeTruthy();

//   expect(footerItems["/projects/citizengarden"].hidden).toBeFalsy();
//   expect(footerItems["/projects/citizengarden"].redirect).toBe(
//     "https://citizenspring.earth/citizengarden"
//   );
//   expect(footerItems["/about"].hidden).toBeFalsy();
//   expect(footerItems["/about"].redirect).toBeUndefined();
//   expect(footerItems["/about"].href).toBe("/about");

//   expect(newMarkdown).toBeDefined();
//   expect(pageInfo).toBeDefined();
//   expect(footerItems).toBeDefined();
// });

// Deno.test("Process markdown - published", async () => {
//   const markdown = await Deno.readTextFile("./tests/fixtures/embeds.md");
//   const { markdown: newMarkdown } = await processMarkdown(markdown, {
//     host: "xavierdamman.com",
//     path: "/index",
//     sitemap: JSON.parse(
//       await Deno.readTextFile(`./tests/fixtures/sitemap.json`)
//     ) as Record<string, SitemapEntry>,
//   });

//   expect(newMarkdown).toContain(youtube("UxLgJeUQS74").replace(/\s\s+/g, " "));
//   expect(newMarkdown).toContain(youtube("HihvuESciME").replace(/\s\s+/g, " "));
//   expect(newMarkdown).toContain(youtube("Puro_L7O4eY").replace(/\s\s+/g, " "));
// });

// Deno.test("Extract date from markdown", () => {
//   const markdown = `# Hello world
//   This document was published on 2025-01-30`;
//   const date = extractDateText(markdown);
//   expect(date).toBeDefined();
//   expect(date?.toISOString()).toBe("2025-01-30T12:00:00.000Z");
// });

// Deno.test("Extract first date from markdown", () => {
//   const markdown = `# Hello world
//   This document was published on April 30 2024 and not on March 1 2021`;
//   const date = extractDateText(markdown);
//   expect(date).toBeDefined();
//   expect(date?.toISOString()).toBe("2024-04-30T12:00:00.000Z");
// });

// Deno.test("Extract date from markdown", () => {
//   const markdown = `# Update Spring 2025

// Dear investors,
// `;
//   const date = extractDateText(markdown);
//   expect(date).toBeNull();
// });

// Deno.test("Extract date from markdown", () => {
//   const markdown = `# Starting your own local currency, lessons from the Eusko

// Ever since [the movie Demain](https://en.wikipedia.org/wiki/Tomorrow_\(2015_film\)) (“Tomorrow”) came out in 2015, we’ve seen an explosion of local currencies in Europe. They enable citizens to support their local economy. When using a local currency, you create a natural barrier that incentivizes people to consume locally. If I give you a euro, you can go
// `;
//   const date = extractDateText(markdown);
//   expect(date).toBeNull();
// });
// Deno.test("Extract date from markdown", () => {
//   const markdown = `# On why a single currency destroys local communities

// During our Solarpunk Roadtrip across Europe, we stopped by Panicale, a beautiful small medieval town in the heart of Umbria, Perugia, Italy.
// ![image1](./images/on-why-a-single-currency-destroys-local-communities_image1.png)
// The town has about 5,600 inhabitants, but only about 600 live in the old town (intra muros). As we were walking down the streets (you can pretty much go through all of them in an hour), we stumbled upon a celebration happening in the local church. You could feel the strong community feel of the town. A third of the village must have been there. It was beautiful to see.
// `;
//   const date = extractDateText(markdown);
//   expect(date).toBeNull();
// });

// Deno.test("Extract description from markdown", () => {
//   const markdown = `# Xavier Damman

// Citizen, dad, entrepreneur, commoner, regen ([twitter](https://twitter.com/xdamman), [linkedin](https://linkedin.com/in/xavierdamman), [nostr](https://damus.io/npub1xsp9fcq340dzaqjctjl7unu3k0c82jdxc350uqym70k8vedzuvdst562dr)).

// ## Videos

// Presentations, interviews, … `;
//   const title = extractTitle(markdown);
//   const description = extractDescription(markdown);

//   expect(title).toBe("Xavier Damman");
//   expect(description).toBe(
//     "Citizen, dad, entrepreneur, commoner, regen ([twitter], [linkedin], [nostr])."
//   );
// });

Deno.test("Extract tags from markdown", () => {
  const markdown = `# Xavier Damman

Citizen, dad, entrepreneur, commoner, regen ([twitter](https://twitter.com/xdamman), [linkedin](https://linkedin.com/in/xavierdamman), [nostr](https://damus.io/npub1xsp9fcq340dzaqjctjl7unu3k0c82jdxc350uqym70k8vedzuvdst562dr)).

## Videos

#interview #videos #year:2025 #type:video #[project:Commons Hub Brussels] 

 [please reach out](https://opencollective.com/#signup). We will go out of our way to
 help you collect the funds to sustain your collective. [This is why we do what we do](https://openco
llective.com/faq#wdydwyd). We can do great things together, and we will.
`;

  const tags = extractTags(markdown);

  // Should only extract the 5 actual hashtags, not the ones in markdown links
  expect(tags.length).toBe(5);
  expect(tags[0]).toEqual(["t", "interview"]);
  expect(tags[1]).toEqual(["t", "videos"]);
  expect(tags[2]).toEqual(["year", "2025"]);
  expect(tags[3]).toEqual(["type", "video"]);
  expect(tags[4]).toEqual(["project", "Commons Hub Brussels"]);
  expect(tags.length).toBe(5);
});

Deno.test("Extract tags from markdown - exclude hashtags in links", () => {
  const markdown = `# Test Document

Here are some real hashtags: #test #category:blog #year:2024

But these hashtags should be ignored because they are in links:
- [Google Doc link](https://docs.google.com/document/d/123#heading=h.abc123)
- [Open Collective signup](https://opencollective.com/#signup)
- [FAQ section](https://example.com/faq#wdydwyd)
- [Another link with anchor](https://example.com/page#section1)

And this standalone hashtag should be captured: #standalone
`;

  const tags = extractTags(markdown);

  // Should only extract: test, category:blog, year:2024, standalone
  expect(tags.length).toBe(4);
  expect(tags[0]).toEqual(["t", "test"]);
  expect(tags[1]).toEqual(["category", "blog"]);
  expect(tags[2]).toEqual(["year", "2024"]);
  expect(tags[3]).toEqual(["t", "standalone"]);
});
