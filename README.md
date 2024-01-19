# scopey
JS/TS Implementation for better try/catch/finally handling

Full example in: https://github.com/mabels/scopey/blob/main/ts/smoke/smoke.ts

```typescript
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
```