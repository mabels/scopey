import { scopey } from "@adviser/scopey";

(async () => {
  const rsc = await scopey(async (scope) => {
    const test = await scope
      .eval(async () => {
        return "Works";
      })
      .do();
    return test;
  });
  console.log(rsc.Ok());
})();
