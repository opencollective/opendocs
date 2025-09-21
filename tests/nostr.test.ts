import { join } from "@std/path/join";
import { processReferencedImages } from "../src/lib/markdown.ts";
import { Nostr } from "../src/lib/nostr.ts";
import { expect } from "@std/expect/expect";

const nsec = Deno.env.get("NOSTR_NSEC");
if (!nsec) {
  throw new Error("NOSTR_NSEC is not set");
}

// Deno.test("uploadFile", async () => {
//   const file = await nostr.uploadFile(
//     "./tests/fixtures/images/story-with-an-image_image1.png"
//   );
//   expect(file).toBeDefined();
//   expect(file).toBe(
//     "https://blossom.primal.net/2687ea0ca66577385ff020a93512b97b692a916b77442e03f032269320a82c6d.png"
//   );
//   console.log(file);
// });

Deno.test("publishMarkdown", async () => {
  try {
    const nostr = Nostr.getInstance(nsec);
    const markdown = await Deno.readTextFile(
      "./tests/fixtures/story-with-an-image.md",
    );
    const newMarkdown = await processReferencedImages(
      markdown,
      (imagePath) =>
        nostr?.uploadFile(join("./tests/fixtures", imagePath)) ||
        Promise.resolve(null),
    );
    const res = await nostr?.publishMarkdown("story-with-an-image", {
      title: "Story with an image",
      content: newMarkdown,
      published_at: new Date(),
      tags: [],
    });
    expect(res).toBeDefined();
  } finally {
    // Clean up WebSocket connections and timers to prevent leaks
    await Nostr.closeAndReset();
    console.log(">>> NostrProvider closed and reset, really?");
  }
});
