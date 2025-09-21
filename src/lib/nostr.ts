import {
  EventTemplate,
  finalizeEvent,
  getPublicKey,
  nip19,
  SimplePool,
} from "nostr-tools";

const DRY_RUN = Deno.env.get("DRY_RUN") === "true";

type HexString<Length extends number> = `0x${string}` & { length: Length };
export type Address = HexString<42>;

type BitcoinAddress =
  | `1${string}` // Legacy addresses
  | `3${string}` // P2SH addresses
  | `bc1${string}`; // Native SegWit addresses

export type TxHash = HexString<66>;
export type TxId = HexString<64>;
export type ChainId = number;
export type Blockchain = "ethereum" | "bitcoin";
export type AddressType = "address" | "tx";
export type URI =
  | `ethereum:${ChainId}:address:${Address}`
  | `ethereum:${ChainId}:tx:${TxHash}`
  | `bitcoin:address:${BitcoinAddress}`
  | `bitcoin:tx:${TxId}`;

const getKindFromURI = (uri: URI): string => {
  const type = uri.match(/:tx:/) ? "tx" : "address";
  const blockchain = uri.startsWith("bitcoin") ? "bitcoin" : "ethereum";
  return `${blockchain}:${type}`;
};

// Extract hashtags from a text string
// 1. #[kind:value with spaces] format
// 2. #simpletag
// 3. #key:attr format without spaces
export function extractHashtags(text: string): {
  tags: string[][];
  cleanDescription: string;
} {
  const hashtagRegex = /#(?:\[(\w+:[^\]]+)\]|(\w+:(?:[^\s#]+)?|\w+))/g;
  const matches = text.match(hashtagRegex) || [];

  // Remove hashtags from the description
  const cleanDescription = text
    .replace(hashtagRegex, "")
    .replace(/\s+/g, " ")
    .trim();

  const tags = matches.map((tag) => {
    // If the tag starts with #[, we need to extract the content within brackets
    if (tag.startsWith("#[")) {
      const content = tag.slice(2, -1); // Remove #[ and ]
      return [
        content.substring(0, content.indexOf(":")),
        content.substring(content.indexOf(":") + 1),
      ];
    }
    // Handle regular tags
    if (tag.includes(":")) {
      return [
        tag.substring(1, tag.indexOf(":")),
        tag.substring(tag.indexOf(":") + 1),
      ];
    }
    return ["t", tag.substring(1)];
  });

  return { tags, cleanDescription };
}
export class Nostr {
  private static instance: Nostr | null = null;
  private pool: SimplePool;
  private connectionPromises: Promise<void>[] = [];

  private constructor(
    private readonly nsec?: string,
    readonly relays?: string[],
  ) {
    this.nsec = nsec || Deno.env.get("NOSTR_NSEC");
    this.relays = relays || [
      "wss://nostr-pub.wellorder.net",
      "wss://relay.nostr.band",
      "wss://relay.damus.io",
    ];
    this.pool = new SimplePool();

    this.connectionPromises = this.relays.map(async (url) => {
      try {
        await this.pool.ensureRelay(url, {
          // Add WebSocket options
          connectionTimeout: 3000, // 3 seconds timeout
        });
        console.log(`>>> NostrProvider connected to ${url}`);
      } catch (err) {
        console.warn(`Failed to connect to ${url}:`, err);
        // Continue with other relays even if one fails
      }
    });
  }

  async connect() {
    console.log(">>> NostrProvider connecting to relays", this.relays);
    await Promise.all(this.connectionPromises);
  }

  static getInstance(nsec?: string, relays?: string[]): Nostr | undefined {
    if (!nsec && !Deno.env.get("NOSTR_NSEC")) {
      return;
    }
    if (!Nostr.instance) {
      Nostr.instance = new Nostr(nsec, relays);
      Nostr.instance.connect();
    }
    return Nostr.instance;
  }

  getPublicKey() {
    if (!this.nsec) {
      throw new Error("Nostr: No nsec provided");
    }
    const { data: secretKey } = nip19.decode(this.nsec);
    const pubkey = getPublicKey(secretKey as Uint8Array);
    return pubkey;
  }

  getNpub() {
    return nip19.npubEncode(this.getPublicKey());
  }

  async publishMetadata(
    uri: URI,
    { content, tags }: { content: string; tags: string[][] },
  ) {
    if (tags.length === 0) {
      const { tags: tagsFromContent, cleanDescription } = extractHashtags(
        content,
      );
      content = cleanDescription;
      tags = tagsFromContent;
    }
    const event: EventTemplate = {
      kind: 1111,
      created_at: Math.floor(Date.now() / 1000),
      content,
      tags: [["i", uri.toLowerCase()], ["k", getKindFromURI(uri)], ...tags],
    };
    try {
      await this.publish(event);
    } catch (error) {
      console.error("Failed to publish metadata", error, "event:", event);
    }
  }

  // upload file to blossom storage
  async uploadFile(filepath: string): Promise<string | null> {
    if (!this.nsec || this.nsec.length !== 63) {
      throw new Error("Nostr uploadFile: No nsec provided for authentication");
    }
    try {
      // Read the file
      const fileData = await Deno.readFile(filepath);

      console.log(">>> Uploading file", filepath, "length:", fileData.length);

      // Calculate SHA-256 hash
      const hashBuffer = await crypto.subtle.digest("SHA-256", fileData);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const fileHash = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      // Get file info
      const filename = filepath.split("/").pop() || "unknown";
      const mimeType = this.getMimeType(filepath);

      // Create Nostr authentication event
      const authEvent: EventTemplate = {
        kind: 24242,
        created_at: Math.floor(Date.now() / 1000),
        content: filepath,
        tags: [
          ["t", "upload"], // HTTP method
          ["x", fileHash], // SHA-256 of the file
        ],
      };

      if (!this.nsec) {
        throw new Error("Nostr: No nsec provided for authentication");
      }

      // Sign the auth event
      const { data: secretKey } = nip19.decode(this.nsec);
      const signedAuthEvent = finalizeEvent(authEvent, secretKey as Uint8Array);

      // Encode the auth event for the Authorization header
      const authEventJson = JSON.stringify(signedAuthEvent);
      const authEventEncoded = btoa(authEventJson);

      // Upload to Primal blossom server
      const response = await fetch("https://blossom.primal.net/upload", {
        method: "PUT",
        headers: {
          Authorization: `Nostr ${authEventEncoded}`,
          "X-SHA-256": fileHash,
          "Content-Type": mimeType,
          "X-Filename": filename,
        },
        body: fileData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Upload failed: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }

      const result = await response.json();
      console.log(`>>> File uploaded successfully: ${result.url || result.id}`);

      return result.url || result.id || null;
    } catch (error) {
      console.error("Failed to upload file to Primal blossom:", error);
      return null;
    }
  }

  // Helper method to determine MIME type based on file extension
  private getMimeType(filepath: string): string {
    const ext = filepath.split(".").pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
      pdf: "application/pdf",
      txt: "text/plain",
      md: "text/markdown",
      html: "text/html",
      css: "text/css",
      js: "application/javascript",
      json: "application/json",
      mp4: "video/mp4",
      mp3: "audio/mpeg",
      wav: "audio/wav",
      zip: "application/zip",
    };

    return mimeTypes[ext || ""] || "application/octet-stream";
  }

  async publishMarkdown(
    slug: string,
    {
      title,
      content,
      published_at,
      tags,
    }: { title: string; content: string; published_at: Date; tags: string[][] },
  ) {
    if (tags.length === 0) {
      const { tags: tagsFromContent } = extractHashtags(content);
      tags = tagsFromContent;
    }
    const now = Math.floor(Date.now() / 1000);
    const event: EventTemplate = {
      kind: 30023,
      created_at: now,
      content,
      tags: [
        ["published_at", `${(published_at || new Date()).getTime() / 1000}`],
        ["d", slug],
        ["title", title],
        ...tags,
      ],
    };
    try {
      return await this.publish(event);
    } catch (error) {
      console.error("Failed to publish markdown", error, "event:", event);
    }
  }

  async publish(event: EventTemplate) {
    if (!this.nsec) {
      throw new Error("Nostr: No nsec provided");
    }

    // if env is test, just log the event
    if (DRY_RUN) {
      console.log(">>> DRY RUN: Nostr publish:", event);
      return;
    }

    const { data: secretKey } = nip19.decode(this.nsec);
    const signedEvent = finalizeEvent(event, secretKey as Uint8Array);
    // console.log(">>> NostrProvider publishing event", signedEvent);
    await Promise.any(this.pool.publish(this.relays!, signedEvent));
    return signedEvent;
  }

  async close() {
    // Wait for all connection promises to resolve before closing
    await Promise.allSettled(this.connectionPromises);
    if (this.pool) {
      await this.pool.close(this.relays!);
    }
    await new Promise((resolve) => setTimeout(resolve, 200)); // hack to wait for the connections to be closed
  }

  /**
   * Static method to close and reset the singleton instance
   * This ensures all WebSocket connections and timers are properly cleaned up
   */
  static async closeAndReset() {
    if (Nostr.instance) {
      await Nostr.instance.close();
      Nostr.instance = null;
    }
  }
}
