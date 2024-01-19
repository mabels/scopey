import { scopey } from "@adviser/scopey";

import { open, rm, readFile } from "node:fs/promises";

(async () => {
  const rsc = await scopey(async (scope) => {
    const fileHdl = await scope
      .eval(async () => {
        return await open("temp-smoke.txt", "w");
      })
      .cleanup(async (hdl) => {
        await hdl.write("EOF");
        await hdl.close();
      })
      .do();
    for (let i = 0; i < 100; i++) {
      await scope
        .eval(async () => {
          return await fileHdl.write(`Hello, World! ${i}\n`);
        })
        .finally(async () => {
          await fileHdl.write(`Final, World! ${i}\n`);
        })
        .do();
    }
    return "OK";
  });
  const f = (await readFile("temp-smoke.txt", { encoding: "utf-8" })).split("\n");
  if (f.length != 201) {
    console.log("Wrong number of lines", f.length);
    process.exit(1);
  }
  if (f[200] != "EOF") {
    console.log("EOF not found", f);
    process.exit(1);
  }

  if (f[100] != "Final, World! 99") {
    console.log("Final not found 99", f);
    process.exit(1);
  }

  if (f[199] != "Final, World! 0") {
    console.log("Final not found 0", f);
    process.exit(1);
  }

  if (f[99] != "Hello, World! 99") {
    console.log("Hello not found 99 ", f);
    process.exit(1);
  }
  if (f[0] != "Hello, World! 0") {
    console.log("Hello not found 0", f);
    process.exit(1);
  }
  await rm("temp-smoke.txt");
  console.log(rsc.Ok());
})();
