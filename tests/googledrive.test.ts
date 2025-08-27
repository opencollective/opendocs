import { expect } from "jsr:@std/expect/expect";
import { getLatestActivities } from "../src/lib/googleapi.ts";
import { authorize } from "../src/lib/googleapi.ts";

Deno.test("getLatestActivities - success case", async () => {
  const auth = await authorize();
  const result = await getLatestActivities(
    auth,
    "10aieWT-xqTe2GEJb3Tg2Z0ebkQBVZ8v-",
    2,
  );
  expect(result).toBeDefined();
  expect(result!.length).toBeGreaterThan(1);
});
