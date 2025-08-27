import { google } from "googleapis";

// Define proper types instead of any

export type GoogleAuthObject = InstanceType<typeof google.auth.JWT>;

type GoogleDocContent = {
  title: string;
  body: {
    content: Array<{
      paragraph?: {
        elements: Array<{
          inlineObjectElement?: {
            inlineObjectId: string;
          };
        }>;
      };
    }>;
  };
  inlineObjects: Record<
    string,
    {
      inlineObjectProperties: {
        embeddedObject: {
          imageProperties: {
            contentUri: string;
          };
        };
      };
    }
  >;
};

type GoogleCredentials = {
  web: {
    client_id: string;
    project_id: string;
    auth_uri: string;
    token_uri: string;
    auth_provider_x509_cert_url: string;
    client_secret: string;
    redirect_uris: string[];
    javascript_origins: string[];
  };
};

type GoogleServiceAccountKey = {
  client_email: string;
  private_key: string;
  project_id: string;
};

const GOOGLE_SERVICE_ACCOUNT_KEY = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
const GOOGLE_SERVICE_ACCOUNT_KEY_PATH = Deno.env.get(
  "GOOGLE_SERVICE_ACCOUNT_KEY_PATH",
);
// Service Account only flow: we expect service-account-key.json to exist.

const serviceAccountKeyString = GOOGLE_SERVICE_ACCOUNT_KEY ||
  Deno.readTextFileSync(GOOGLE_SERVICE_ACCOUNT_KEY_PATH!);

if (!serviceAccountKeyString) {
  throw new Error(
    "Service account key not set. Please set the GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_SERVICE_ACCOUNT_KEY_PATH environment variable.",
  );
}

const serviceAccountKey = JSON.parse(
  serviceAccountKeyString,
) as GoogleServiceAccountKey;

export const loadCredentials = (): GoogleCredentials => {
  // Minimal stub to satisfy existing call sites; we always use service account
  const json: GoogleCredentials = {
    web: {
      client_id: "",
      project_id: serviceAccountKey.project_id || "",
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_secret: "",
      redirect_uris: [],
      javascript_origins: [],
    },
  };
  return json;
};

// Create an OAuth2 client with the given credentials
export const authorize = async (): Promise<GoogleAuthObject> => {
  const scopes = [
    "https://www.googleapis.com/auth/drive.metadata.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/documents.readonly",
    "https://www.googleapis.com/auth/drive.appdata",
  ];
  const jwtClient = new google.auth.JWT(
    serviceAccountKey.client_email || "",
    undefined,
    serviceAccountKey.private_key || "",
    scopes,
  );
  await jwtClient.authorize();
  return jwtClient;
};

// Function to get metadata of a specific file
export const getFileMetadata = async (
  auth: GoogleAuthObject,
  fileId: string,
) => {
  const drive = google.drive({ version: "v3", auth });

  try {
    const res = await drive.files.get({
      fileId: fileId,
      fields: "id, name, mimeType, size, modifiedTime", // Specify the metadata fields you want
    });

    console.log("File Metadata:");
    console.log(res.data);
  } catch (error) {
    console.error("Error fetching file metadata:", error);
  }
};

// List files in a specific Google Drive folder
export const listFiles = async (auth: GoogleAuthObject, folderId: string) => {
  const drive = google.drive({ version: "v3", auth });

  try {
    const res = await drive.files.list({
      q: `'${folderId}' in parents`,
      pageSize: 10,
      fields: "nextPageToken, files(id, name, mimeType, modifiedTime)",
    });
    const files = res.data.files;
    if (files?.length) {
      console.log("Files:");
      await Promise.all(
        files.map(async (file) => {
          if (file.mimeType === "application/vnd.google-apps.document") {
            await getGoogleDocContent(auth, file.id as string);
            await getGoogleDocContributors(auth, file.id as string);
          } else {
            console.log(
              `${file.name} (${file.id}, ${file.mimeType}, ${file.modifiedTime})`,
            );
          }
        }),
      );
    } else {
      console.log("No files found.");
    }
  } catch (error) {
    console.error("The API returned an error:", error);
  }
};

export type Folder = {
  id: string;
  name: string;
  mtime: Date;
};

export async function listSharedFolders(
  auth: GoogleAuthObject,
): Promise<Folder[]> {
  const driveService = google.drive({ version: "v3", auth });
  const output: Folder[] = [];
  try {
    const response = await driveService.files.list({
      q: "mimeType='application/vnd.google-apps.folder' and sharedWithMe",
      fields: "nextPageToken, files(id, name, modifiedTime)",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const folders = response.data.files;

    if (folders && folders.length) {
      folders.forEach((folder) => {
        output.push({
          id: folder.id as string,
          name: folder.name as string,
          mtime: new Date(folder.modifiedTime as string),
        });
      });
    }
  } catch (error) {
    console.error("Error fetching shared folders: ", error);
  }
  return output;
}
export async function listFolders(
  auth: GoogleAuthObject,
  folderId: string,
): Promise<Folder[]> {
  const driveService = google.drive({ version: "v3", auth });
  const output: Folder[] = [];
  try {
    const response = await driveService.files.list({
      q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder'`,
      fields: "nextPageToken, files(id, name, modifiedTime)",
    });

    const folders = response.data.files;

    if (folders && folders.length) {
      folders.forEach((folder) => {
        output.push({
          id: folder.id as string,
          name: folder.name as string,
          mtime: new Date(folder.modifiedTime as string),
        });
      });
    }
  } catch (error) {
    console.error("Error fetching shared folders: ", error);
  }
  return output;
}

export type GoogleDocMetadata = {
  id: string;
  src: string; // source url
  name: string;
  ctime: Date; // created time
  mtime: Date; // modified time
  ptime?: Date; // published time (if published)
  author: {
    name: string;
    avatar: string;
  };
};

export async function listGoogleDocs(
  auth: GoogleAuthObject,
  folderId: string,
): Promise<GoogleDocMetadata[]> {
  const driveService = google.drive({ version: "v3", auth });
  const output: GoogleDocMetadata[] = [];
  try {
    const response = await driveService.files.list({
      q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.document'`,
      fields:
        "nextPageToken, files(id, webViewLink, name, createdTime, modifiedTime, permissions, owners)",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const files = response.data.files;

    if (files && files.length) {
      await Promise.all(
        files.map(async (file) => {
          const publishedTime = await getGoogleDocPublishedTime(
            auth,
            file.id as string,
          );
          output.push({
            id: file.id as string,
            src: file.webViewLink as string,
            name: file.name as string,
            ctime: new Date(file.createdTime as string),
            mtime: new Date(file.modifiedTime as string),
            ptime: publishedTime,
            author: {
              name: file.owners?.[0]?.displayName as string,
              avatar: file.owners?.[0]?.photoLink as string,
            },
          });
        }),
      );
    } else {
      console.log("No files found.");
    }
  } catch (error) {
    console.error("Error fetching files: ", error);
  }
  return output;
}

export const getGoogleDocContent = async (
  auth: GoogleAuthObject,
  documentId: string,
): Promise<GoogleDocContent | null> => {
  const docs = google.docs({ version: "v1", auth });

  try {
    const res = await docs.documents.get({
      documentId: documentId,
      fields: "",
    });

    // console.log("Document:", res.data);
    // Deno.writeTextFile(`${documentId}.json`, JSON.stringify(res.data, null, 2));
    return res.data as GoogleDocContent;
    // Deno.writeTextFile(`${documentId}.html`, html);
  } catch (error) {
    console.error("Error fetching Google Doc content:", error);
  }
  return null;
};

export async function getGoogleDocContributors(
  auth: GoogleAuthObject,
  googleDocId: string,
) {
  const driveService = google.drive({ version: "v3", auth });

  try {
    const response = await driveService.revisions.list({
      fileId: googleDocId,
      fields:
        "revisions(id, modifiedTime, publishedLink, lastModifyingUser(displayName, photoLink, emailAddress))",
    });

    const revisions = response.data.revisions;

    if (revisions && revisions.length) {
      const contributionMap = new Map<string, number>();

      console.log(">>> revisions", revisions);
      revisions.forEach((revision) => {
        const user = revision.lastModifyingUser;
        if (user) {
          const key = `${user.displayName} (${user.emailAddress})`;
          // Increment the count for this contributor
          contributionMap.set(key, (contributionMap.get(key) || 0) + 1);
        }
      });

      // contributionMap.forEach((data, contributor) => {
      //   console.log(`${contributor}: ${data.count} revisions`);
      //   console.log(`Avatar: ${data.avatar || "No avatar available"}`);
      // });
    } else {
      console.log("No revisions found for the document.");
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("403")) {
      console.log(
        `>>> 403 error, insufficient permissions to get revisions for ${googleDocId}`,
      );
    } else {
      console.error("Error fetching revisions: ", error);
    }
  }
}
export async function getGoogleDocPublishedTime(
  auth: GoogleAuthObject,
  googleDocId: string,
): Promise<Date | undefined> {
  const driveService = google.drive({ version: "v3", auth });

  try {
    const response = await driveService.revisions.list({
      fileId: googleDocId,
      fields: "revisions(id, modifiedTime, publishedLink)",
    });

    const revisions = response.data.revisions;
    // Note: revisions are ordered by date ASC
    if (revisions && revisions.length) {
      let publishedTime: Date | undefined;
      revisions.forEach((revision) => {
        if (!publishedTime && revision.publishedLink) {
          publishedTime = new Date(revision.modifiedTime as string);
        }
      });
      return publishedTime;
    } else {
      console.log("No revisions found for the document.");
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("403")) {
      console.log(
        `>>> 403 error, insufficient permissions to get revisions for ${googleDocId}`,
      );
    } else {
      console.error("Error fetching revisions: ", error);
    }
  }
  return undefined;
}
