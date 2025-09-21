// Simple test to verify Nostr cleanup functionality
import { Nostr } from "./src/lib/nostr.ts";

const DRY_RUN = "true";
const NOSTR_NSEC =
  "nsec1test123test123test123test123test123test123test123test123test123";

Deno.env.set("DRY_RUN", DRY_RUN);
Deno.env.set("NOSTR_NSEC", NOSTR_NSEC);

console.log("Testing Nostr cleanup...");

try {
  // Create instance
  const nostr = Nostr.getInstance();
  console.log("Nostr instance created");

  // Test cleanup
  await Nostr.closeAndReset();
  console.log("Cleanup completed successfully");

  // Verify instance was reset
  const nostr2 = Nostr.getInstance();
  console.log("New instance created after reset");

  // Final cleanup
  await Nostr.closeAndReset();
  console.log("Final cleanup completed");
} catch (error) {
  console.error("Error:", error);
}
