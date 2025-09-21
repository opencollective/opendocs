import { authorize, watchDriveChanges } from "./lib/googleapi.ts";

const main = async () => {
  const auth = await authorize();

  await watchDriveChanges(auth);
};

main();
