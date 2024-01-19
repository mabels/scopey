# scopey
JS/TS Implementation for better try/catch/finally handling

```typescript
(async () => {
  const rsc = await scopey(async (scope) => {
    const fileHdl = await scope.eval(async () => {
      return await open("temp-smoke.txt", "w");
    }).cleanup(async (hdl) => {
      await hdl.write("EOF\n")
      await hdl.close();
    }).do();
    for (let i = 0; i < 100; i++) {
      await scope.eval(async () => {
        return await fileHdl.write(`Hello, World! ${i}\n`);
      }).do();
    }
    return "OK";
  });
  const f = await readFile("temp-smoke.txt", { encoding: "utf-8" });
  if (!f.endsWith("EOF\n")) {
    console.log("EOF not found", f);
    process.exit(1);
  }
  await rm("temp-smoke.txt")
  console.log(rsc.Ok());
})();
```