import { downloadGoogleDoc } from "../src/lib/googledoc.ts";
import {
  authorize,
  listGoogleDocs,
  listSharedFolders,
} from "../src/lib/googleapi.ts";
import { expect } from "jsr:@std/expect/expect";
const publishedGoogleDocId = "1EYqqbQVkkPRjiDccN59LeXDH9LhksiUe3vNX8C-Y2DI";
const testDriveFolder = "10aieWT-xqTe2GEJb3Tg2Z0ebkQBVZ8v-";

Deno.test("get shared folders", async () => {
  const auth = await authorize();
  const folders = await listSharedFolders(auth);
  expect(folders.length).toBeGreaterThan(0);
  const folder = folders.find(
    (folder) => folder.name === "test.blog.opencollective.xyz"
  );
  expect(folder).toBeDefined();
});

// Deno.test("list documents in drive folder", async () => {
//   const auth = await authorize();

//   const docs = await listGoogleDocs(auth, testDriveFolder);
//   console.log(docs);
//   expect(docs.length).toBe(3);
//   const unpublishedDoc = docs.find((doc) => doc.id === unpublishedGoogleDocId);
//   const publishedDoc = docs.find((doc) => doc.id === publishedGoogleDocId);
//   const index = docs.find((doc) => doc.name === "index");
//   expect(unpublishedDoc).toBeDefined();
//   expect(unpublishedDoc?.ptime).toBeUndefined();
//   expect(publishedDoc).toBeDefined();
//   expect(publishedDoc?.ptime).toBeDefined();
//   expect(index).toBeDefined();
//   expect(index?.ptime).toBeDefined();
// });

// Deno.test("download document", async () => {
//   const auth = await authorize();
//   const data = await downloadFormat(
//     auth,
//     publishedGoogleDocId,
//     "./tests/output/published.md",
//     "markdown"
//   );
//   console.log(data);
// });

Deno.test("download", async () => {
  const auth = await authorize();
  const docs = await listGoogleDocs(auth, testDriveFolder);
  const doc = docs.find((doc) => doc.id === publishedGoogleDocId);
  expect(doc).toBeDefined();
  const res = await downloadGoogleDoc(auth, doc!, "./tests/output");
  console.log(res);
  expect(res?.date).toBeDefined();
  expect(res?.date?.toISOString()).toBe("2017-01-30T11:00:00.000Z");
  expect(res?.files.length).toBe(3);
  expect(res?.title).toBe("From Firms to Collectives");
  expect(res?.slug).toBe("from-firms-to-collectives");
});

Deno.test("download index", async () => {
  const auth = await authorize();
  const docs = await listGoogleDocs(auth, testDriveFolder);
  const doc = docs.find((doc) => doc.name === "index");
  expect(doc).toBeDefined();
  const res = await downloadGoogleDoc(auth, doc!, "./tests/output");
  console.log(res);
  expect(res?.date).toBeNull();
  expect(res?.files.length).toBe(2);
  expect(res?.title).toBe("index");
  expect(res?.slug).toBe("index");
});
