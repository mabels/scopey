import exp from "constants";
import { scopey } from "./scopey";

function throwsError() {
  throw new Error("my error");
}

it("a scopey is a exception in catch and finally", async () => {
  const global = {
    catch: jest.fn(),
    finally: jest.fn(),
  };
  const first = {
    eval: jest.fn(),
    close: jest.fn(),
    update: jest.fn(),
    cleanup: jest.fn(),
    catch: jest.fn(),
    finally: jest.fn(),
  };
  const second = {
    eval: jest.fn(),
    cleanup: jest.fn(),
    catch: jest.fn(),
    finally: jest.fn(),
  };
  const third = {
    eval: jest.fn(),
    update: jest.fn(),
    cleanup: jest.fn(),
    catch: jest.fn(),
    finally: jest.fn(),
  };
  let cleanupOrder = 0;
  let catchOrder = 0;
  let finallyOrder = 0;
  let evalOrder = 0;

  const log = jest.fn();
  const rsc = await scopey(
    async (scope) => {
      const test = await scope
        .eval(async () => {
          first.eval(evalOrder++);
          return {
            db: {
              close: first.close,
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              update: first.update,
            },
          };
        })
        .cleanup(async (ctx) => {
          first.cleanup(cleanupOrder++);
          ctx.db.close("close");
          throwsError();
        })
        .catch(async (err) => {
          first.catch(catchOrder++, err);
          throwsError();
        })
        .finally(async () => {
          first.finally(finallyOrder++);
          throwsError();
        })
        .do(); // as unknown as { db: { close: () => void; update: (o: string) => void } };
      expect(test.db.close).toEqual(first.close);
      await scope
        .eval(async () => {
          second.eval(evalOrder++);
          return "From scope 2";
        })
        .cleanup(async (a) => {
          second.cleanup(cleanupOrder++);
          test.db.update(a);
          throwsError();
        })
        .catch(async () => {
          second.catch(catchOrder++);
        })
        .finally(async () => {
          second.finally(finallyOrder++);
          throwsError();
        })
        .do();

      await scope
        .eval(async () => {
          third.eval();
          return "From scope 3";
        })
        .cleanup(async (a) => {
          third.cleanup(cleanupOrder++);
          test.db.update(a);
          throwsError();
        })
        .catch(async () => {
          third.catch(catchOrder++);
          throwsError();
        })
        .finally(async () => {
          third.finally(finallyOrder++);
          throwsError();
        })
        .do();
      return { wurst: 4 };
    },
    {
      log,
      catch: async (err) => {
        global.catch(catchOrder++, err);
      },
      finally: async () => {
        global.finally(finallyOrder++);
      },
    },
  );

  expect(log.mock.calls).toEqual([
    ["Scope error in cleanup: Error: my error"],
    ["Scope error in finally: Error: my error"],
    ["Scope error in cleanup: Error: my error"],
    ["Scope error in finally: Error: my error"],
    ["Scope error in cleanup: Error: my error"],
    ["Scope error in finally: Error: my error"],
  ]);
  expect(rsc.isOk()).toBeTruthy();
  const sc = rsc.unwrap();
  expect(sc).not.toBeInstanceOf(Error);
  expect(sc).toEqual({ wurst: 4 });

  expect(first.eval).toHaveBeenCalled();
  expect(first.eval.mock.calls[0][0]).toEqual(0);
  expect(second.eval).toHaveBeenCalled();
  expect(second.eval.mock.calls[0][0]).toEqual(1);
  expect(third.eval).toHaveBeenCalledTimes(1);

  expect(first.cleanup).toHaveBeenCalledTimes(1);
  expect(first.cleanup.mock.calls[0][0]).toEqual(2);
  expect(second.cleanup).toHaveBeenCalledTimes(1);
  expect(second.cleanup.mock.calls[0][0]).toEqual(1);
  expect(third.cleanup).toHaveBeenCalledTimes(1);
  expect(third.cleanup.mock.calls[0][0]).toEqual(0);

  expect(first.close).toHaveBeenCalledTimes(1);
  expect(first.close.mock.calls).toEqual([["close"]]);
  expect(first.update.mock.calls).toEqual([["From scope 3"], ["From scope 2"]]);

  expect(global.catch).toHaveBeenCalledTimes(0);
  expect(first.catch).toHaveBeenCalledTimes(0);
  expect(second.catch).toHaveBeenCalledTimes(0);
  expect(third.catch).toHaveBeenCalledTimes(0);

  expect(first.finally).toHaveBeenCalledTimes(1);
  expect(first.finally.mock.calls).toEqual([[2]]);
  expect(second.finally).toHaveBeenCalledTimes(1);
  expect(second.finally.mock.calls).toEqual([[1]]);
  expect(third.finally).toHaveBeenCalledTimes(1);
  expect(third.finally.mock.calls).toEqual([[0]]);
});

it("a scopey with throw in second eval throws in catch", async () => {
  const global = {
    catch: jest.fn(),
    finally: jest.fn(),
  };
  const first = {
    eval: jest.fn(),
    close: jest.fn(),
    cleanup: jest.fn(),
    catch: jest.fn(),
    finally: jest.fn(),
  };
  const second = {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    eval: jest.fn((nr: number) => throwsError()),
    update: jest.fn(),
    cleanup: jest.fn(),
    catch: jest.fn(),
    finally: jest.fn(),
  };
  const third = {
    eval: jest.fn(() => throwsError()),
    close: jest.fn(),
    cleanup: jest.fn(),
    catch: jest.fn(),
    finally: jest.fn(),
  };
  let cleanupOrder = 0;
  let catchOrder = 0;
  let finallyOrder = 0;
  let evalOrder = 0;
  const log = jest.fn();
  const rsc = await scopey(
    async (scope) => {
      const test = await scope
        .eval(async () => {
          throw Error("my error");
          return {
            db: {
              close: first.close,
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              update: (s: string) => { },
            },
          };
        })
        .cleanup(async (ctx) => {
          ctx.db.close("close");
          first.cleanup(cleanupOrder++);
          throwsError();
        })
        .catch(async () => {
          first.catch(catchOrder++);
          throwsError();
        })
        .finally(async () => {
          first.finally(finallyOrder++);
          throwsError();
        })
        .do(); // as unknown as { db: { close: () => void; update: (o: string) => void } };
      expect(test.db.close).toEqual(first.close);
      await scope
        .eval(async () => {
          second.eval(evalOrder++);
          return;
        })
        .cleanup(async () => {
          second.cleanup(cleanupOrder++);
          test.db.update(`update error table set error = 'error'`);
          throwsError();
        })
        .catch(async (err) => {
          second.catch(catchOrder++, (err as Error).message);
          throwsError();
        })
        .finally(async () => {
          second.finally(finallyOrder++);
          throwsError();
        })
        .do();

      await scope
        .eval(async () => {
          third.eval();
          return {
            db: {
              close: third.close,
            },
          };
        })
        .cleanup(third.cleanup)
        .catch(third.catch)
        .finally(third.finally)
        .do();
      return { wurst: 4 };
    },
    {
      log,
      catch: async (err) => {
        global.catch(catchOrder++, (err as Error).message);
      },
      finally: async () => {
        global.finally(finallyOrder++);
      },
    },
  );
  expect(log.mock.calls).toEqual([
    ["Scope error in catch: Error: my error"],
    ["Scope error in finally: Error: my error"],
    ["Scope error in cleanup: Error: my error"],
    ["Scope error in finally: Error: my error"],
  ]);
  expect(rsc.isErr()).toBeTruthy();
  const sc = rsc.unwrap_err();
  expect(sc).toBeInstanceOf(Error);

  expect(first.eval).toHaveBeenCalled();
  expect(first.eval.mock.calls).toEqual([[0]]);
  expect(second.eval).toHaveBeenCalled();
  expect(second.eval.mock.calls).toEqual([[1]]);
  expect(third.eval).toHaveBeenCalledTimes(0);

  expect(first.close).toHaveBeenCalledTimes(1);
  expect(first.close.mock.calls).toEqual([["close"]]);
  expect(second.update).toHaveBeenCalledTimes(0);
  expect(third.close).toHaveBeenCalledTimes(0);

  expect(first.cleanup).toHaveBeenCalledTimes(1);
  expect(first.cleanup.mock.calls).toEqual([[0]]);
  expect(second.cleanup).toHaveBeenCalledTimes(0);
  expect(second.cleanup.mock.calls).toEqual([]);
  expect(third.cleanup).toHaveBeenCalledTimes(0);

  expect(global.catch).toHaveBeenCalledTimes(1);
  expect(global.catch.mock.calls).toEqual([[1, "my error"]]);
  expect(first.catch).toHaveBeenCalledTimes(0);
  expect(first.catch.mock.calls).toEqual([]);
  expect(second.catch).toHaveBeenCalledTimes(1);
  expect(second.catch.mock.calls).toEqual([[0, "my error"]]);
  expect(third.catch).toHaveBeenCalledTimes(0);

  expect(global.finally).toHaveBeenCalledTimes(1);
  expect(global.finally.mock.calls).toEqual([[2]]);
  expect(first.finally).toHaveBeenCalledTimes(1);
  expect(first.finally.mock.calls[0][0]).toEqual(1);
  expect(second.finally).toHaveBeenCalledTimes(1);
  expect(second.finally.mock.calls[0][0]).toEqual(0);
  expect(third.finally).toHaveBeenCalledTimes(0);
});

it("a scopey with throw in second eval", async () => {
  const global = {
    catch: jest.fn(),
    finally: jest.fn(),
  };
  const first = {
    eval: jest.fn(),
    close: jest.fn(),
    cleanup: jest.fn(),
    catch: jest.fn(),
    finally: jest.fn(),
  };
  const second = {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    eval: jest.fn((nr: number) => throwsError()),
    update: jest.fn(),
    cleanup: jest.fn(),
    catch: jest.fn(),
    finally: jest.fn(),
  };
  const third = {
    eval: jest.fn(() => throwsError()),
    close: jest.fn(),
    cleanup: jest.fn(),
    catch: jest.fn(),
    finally: jest.fn(),
  };
  let cleanupOrder = 0;
  let catchOrder = 0;
  let finallyOrder = 0;
  let evalOrder = 0;
  const rsc = await scopey(
    async (scope) => {
      const test = await scope
        .eval(async () => {
          first.eval(evalOrder++);
          return {
            db: {
              close: first.close,
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              update: (s: string) => { },
            },
          };
        })
        .cleanup(async (ctx) => {
          ctx.db.close("close");
          first.cleanup(cleanupOrder++);
        })
        .catch(() => first.catch(catchOrder++))
        .finally(() => first.finally(finallyOrder++))
        .do(); // as unknown as { db: { close: () => void; update: (o: string) => void } };
      expect(test.db.close).toEqual(first.close);
      await scope
        .eval(async () => {
          second.eval(evalOrder++);
          return;
        })
        .cleanup(async () => {
          second.cleanup(cleanupOrder++);
          test.db.update(`update error table set error = 'error'`);
        })
        .catch(async (err) => {
          second.catch(catchOrder++, (err as Error).message);
        })
        .finally(() => second.finally(finallyOrder++))
        .do();

      await scope
        .eval(async () => {
          third.eval();
          return {
            db: {
              close: third.close,
            },
          };
        })
        .cleanup(third.cleanup)
        .catch(third.catch)
        .finally(third.finally)
        .do();
      return { wurst: 4 };
    },
    {
      catch: async (err) => {
        global.catch(catchOrder++, (err as Error).message);
      },
      finally: async () => {
        global.finally(finallyOrder++);
      },
    },
  );
  expect(rsc.isErr()).toBeTruthy();
  const sc = rsc.unwrap_err();
  expect(sc).toBeInstanceOf(Error);

  expect(first.eval).toHaveBeenCalled();
  expect(first.eval.mock.calls).toEqual([[0]]);
  expect(second.eval).toHaveBeenCalled();
  expect(second.eval.mock.calls).toEqual([[1]]);
  expect(third.eval).toHaveBeenCalledTimes(0);

  expect(first.close).toHaveBeenCalledTimes(1);
  expect(first.close.mock.calls).toEqual([["close"]]);
  expect(second.update).toHaveBeenCalledTimes(0);
  expect(third.close).toHaveBeenCalledTimes(0);

  expect(first.cleanup).toHaveBeenCalledTimes(1);
  expect(first.cleanup.mock.calls).toEqual([[0]]);
  expect(second.cleanup).toHaveBeenCalledTimes(0);
  expect(second.cleanup.mock.calls).toEqual([]);
  expect(third.cleanup).toHaveBeenCalledTimes(0);

  expect(global.catch).toHaveBeenCalledTimes(1);
  expect(global.catch.mock.calls).toEqual([[1, "my error"]]);
  expect(first.catch).toHaveBeenCalledTimes(0);
  expect(first.catch.mock.calls).toEqual([]);
  expect(second.catch).toHaveBeenCalledTimes(1);
  expect(second.catch.mock.calls).toEqual([[0, "my error"]]);
  expect(third.catch).toHaveBeenCalledTimes(0);

  expect(global.finally).toHaveBeenCalledTimes(1);
  expect(global.finally.mock.calls).toEqual([[2]]);

  expect(first.finally).toHaveBeenCalledTimes(1);
  expect(first.finally.mock.calls[0][0]).toEqual(1);
  expect(second.finally).toHaveBeenCalledTimes(1);
  expect(second.finally.mock.calls[0][0]).toEqual(0);
  expect(third.finally).toHaveBeenCalledTimes(0);
});

it("a scopey happy path", async () => {
  const global = {
    catch: jest.fn(),
    finally: jest.fn(),
  };
  const first = {
    eval: jest.fn(),
    close: jest.fn(),
    update: jest.fn(),
    cleanup: jest.fn(),
    catch: jest.fn(),
    finally: jest.fn(),
  };
  const second = {
    eval: jest.fn(),
    cleanup: jest.fn(),
    catch: jest.fn(),
    finally: jest.fn(),
  };
  const third = {
    eval: jest.fn(),
    update: jest.fn(),
    cleanup: jest.fn(),
    catch: jest.fn(),
    finally: jest.fn(),
  };
  let cleanupOrder = 0;
  let catchOrder = 0;
  let finallyOrder = 0;
  let evalOrder = 0;
  const rsc = await scopey(
    async (scope) => {
      const test = await scope
        .eval(async () => {
          first.eval(evalOrder++);
          return {
            db: {
              close: first.close,
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              update: first.update,
            },
          };
        })
        .cleanup(async (ctx) => {
          first.cleanup(cleanupOrder++);
          ctx.db.close("close");
        })
        .catch(async (err) => {
          first.catch(catchOrder++, err);
        })
        .finally(async () => {
          first.finally(finallyOrder++);
        })
        .do(); // as unknown as { db: { close: () => void; update: (o: string) => void } };
      expect(test.db.close).toEqual(first.close);
      await scope
        .eval(async () => {
          second.eval(evalOrder++);
          return "From scope 2";
        })
        .cleanup(async (a) => {
          second.cleanup(cleanupOrder++);
          test.db.update(a);
        })
        .catch(async () => {
          second.catch(catchOrder++);
        })
        .finally(() => second.finally(finallyOrder++))
        .do();

      await scope
        .eval(async () => {
          third.eval();
          return "From scope 3";
        })
        .cleanup(async (a) => {
          third.cleanup(cleanupOrder++);
          test.db.update(a);
        })
        .catch(async () => third.catch(catchOrder++))
        .finally(async () => third.finally(finallyOrder++))
        .do();
      return { wurst: 4 };
    },
    {
      catch: async (err) => {
        global.catch(catchOrder++, err);
      },
      finally: async () => {
        global.finally(finallyOrder++);
      },
    },
  );

  expect(rsc.isOk()).toBeTruthy();
  const sc = rsc.unwrap();
  expect(sc).not.toBeInstanceOf(Error);
  expect(sc).toEqual({ wurst: 4 });

  expect(first.eval).toHaveBeenCalled();
  expect(first.eval.mock.calls[0][0]).toEqual(0);
  expect(second.eval).toHaveBeenCalled();
  expect(second.eval.mock.calls[0][0]).toEqual(1);
  expect(third.eval).toHaveBeenCalledTimes(1);

  expect(first.cleanup).toHaveBeenCalledTimes(1);
  expect(first.cleanup.mock.calls[0][0]).toEqual(2);
  expect(second.cleanup).toHaveBeenCalledTimes(1);
  expect(second.cleanup.mock.calls[0][0]).toEqual(1);
  expect(third.cleanup).toHaveBeenCalledTimes(1);
  expect(third.cleanup.mock.calls[0][0]).toEqual(0);

  expect(first.close).toHaveBeenCalledTimes(1);
  expect(first.close.mock.calls).toEqual([["close"]]);
  expect(first.update.mock.calls).toEqual([["From scope 3"], ["From scope 2"]]);

  expect(global.catch).toHaveBeenCalledTimes(0);
  expect(first.catch).toHaveBeenCalledTimes(0);
  expect(second.catch).toHaveBeenCalledTimes(0);
  expect(third.catch).toHaveBeenCalledTimes(0);

  expect(global.finally).toHaveBeenCalledTimes(1);
  expect(global.finally.mock.calls).toEqual([[3]]);
  expect(first.finally).toHaveBeenCalledTimes(1);
  expect(first.finally.mock.calls).toEqual([[2]]);
  expect(second.finally).toHaveBeenCalledTimes(1);
  expect(second.finally.mock.calls).toEqual([[1]]);
  expect(third.finally).toHaveBeenCalledTimes(1);
  expect(third.finally.mock.calls).toEqual([[0]]);
});

it("a scopey happy path with global throw", async () => {
  const global = {
    catch: jest.fn(),
    finally: jest.fn(),
  };
  const first = {
    eval: jest.fn(),
    close: jest.fn(),
    update: jest.fn(),
    cleanup: jest.fn(),
    catch: jest.fn(),
    finally: jest.fn(),
  };
  const second = {
    eval: jest.fn(),
    cleanup: jest.fn(),
    catch: jest.fn(),
    finally: jest.fn(),
  };
  const third = {
    eval: jest.fn(),
    update: jest.fn(),
    cleanup: jest.fn(),
    catch: jest.fn(),
    finally: jest.fn(),
  };
  let cleanupOrder = 0;
  let catchOrder = 0;
  let finallyOrder = 0;
  let evalOrder = 0;
  const rsc = await scopey(
    async (scope) => {
      const test = await scope
        .eval(async () => {
          first.eval(evalOrder++);
          return {
            db: {
              close: first.close,
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              update: first.update,
            },
          };
        })
        .cleanup(async (ctx) => {
          first.cleanup(cleanupOrder++);
          ctx.db.close("close");
        })
        .catch(async (err) => {
          first.catch(catchOrder++, err);
        })
        .finally(async () => {
          first.finally(finallyOrder++);
        })
        .do(); // as unknown as { db: { close: () => void; update: (o: string) => void } };
      expect(test.db.close).toEqual(first.close);
      await scope
        .eval(async () => {
          second.eval(evalOrder++);
          return "From scope 2";
        })
        .cleanup(async (a) => {
          second.cleanup(cleanupOrder++);
          test.db.update(a);
        })
        .catch(async () => {
          second.catch(catchOrder++);
        })
        .finally(() => second.finally(finallyOrder++))
        .do();

      await scope
        .eval(async () => {
          third.eval();
          return "From scope 3";
        })
        .cleanup(async (a) => {
          third.cleanup(cleanupOrder++);
          test.db.update(a);
        })
        .catch(async () => third.catch(catchOrder++))
        .finally(async () => third.finally(finallyOrder++))
        .do();

      throwsError();
      return { wurst: 4 };
    },
    {
      catch: async (err) => {
        global.catch(catchOrder++, (err as Error).message);
      },
      finally: async () => {
        global.finally(finallyOrder++);
      },
    },
  );

  expect(rsc.isErr()).toBeTruthy();
  const sc = rsc.unwrap_err();
  expect(sc).toBeInstanceOf(Error);

  expect(first.eval).toHaveBeenCalled();
  expect(first.eval.mock.calls[0][0]).toEqual(0);
  expect(second.eval).toHaveBeenCalled();
  expect(second.eval.mock.calls[0][0]).toEqual(1);
  expect(third.eval).toHaveBeenCalledTimes(1);

  expect(first.cleanup).toHaveBeenCalledTimes(1);
  expect(first.cleanup.mock.calls[0][0]).toEqual(2);
  expect(second.cleanup).toHaveBeenCalledTimes(1);
  expect(second.cleanup.mock.calls[0][0]).toEqual(1);
  expect(third.cleanup).toHaveBeenCalledTimes(1);
  expect(third.cleanup.mock.calls[0][0]).toEqual(0);

  expect(first.close).toHaveBeenCalledTimes(1);
  expect(first.close.mock.calls).toEqual([["close"]]);
  expect(first.update.mock.calls).toEqual([["From scope 3"], ["From scope 2"]]);

  expect(global.catch).toHaveBeenCalledTimes(1);
  expect(global.catch.mock.calls).toEqual([[0, "my error"]]);
  expect(first.catch).toHaveBeenCalledTimes(0);
  expect(second.catch).toHaveBeenCalledTimes(0);
  expect(third.catch).toHaveBeenCalledTimes(0);

  expect(global.finally).toHaveBeenCalledTimes(1);
  expect(global.finally.mock.calls).toEqual([[3]]);
  expect(first.finally).toHaveBeenCalledTimes(1);
  expect(first.finally.mock.calls).toEqual([[2]]);
  expect(second.finally).toHaveBeenCalledTimes(1);
  expect(second.finally.mock.calls).toEqual([[1]]);
  expect(third.finally).toHaveBeenCalledTimes(1);
  expect(third.finally.mock.calls).toEqual([[0]]);
});

it("scopy with doResult error", async () => {
  const ret = await scopey(async (scope) => {
    const errors: Error[] = [];
    for (let i = 0; i < 10; i++) {
      const rtest = await scope
        .eval(async () => {
          throwsError();
        })
        .doResult();
      expect(rtest.isErr()).toBeTruthy();
      expect(rtest.unwrap_err()).toEqual(new Error("my error"));
      errors.push(rtest.unwrap_err());
    }
    return {
      oks: [],
      errors: errors,
    };
  });
  expect(ret.Ok().errors.length).toEqual(10);
  expect(ret.Ok().oks.length).toEqual(0);
});

it("scopy with doResult ok", async () => {
  const ret = await scopey(async (scope) => {
    const oks: { wurst: number }[] = [];
    for (let i = 0; i < 10; i++) {
      const rtest = await scope
        .eval(async () => {
          return { wurst: 4 };
        })
        .doResult();
      expect(rtest.isErr()).toBeFalsy();
      expect(rtest.unwrap()).toEqual({ wurst: 4 });
      oks.push(rtest.unwrap());
    }
    return {
      oks,
      errors: [],
    };
  });
  expect(ret.Ok().oks.length).toEqual(10);
  expect(ret.Ok().errors.length).toEqual(0);
});

it("scopy rollback loop", async () => {
  const top = jest.fn();
  const topCleanup = jest.fn();
  let count = 0
  const loop = jest.fn();
  const loopCatch = jest.fn();
  const loopCleanup = jest.fn();

  const ret = await scopey(async (scope) => {
    await scope.eval(async () => {
      top(count);
      return { wurst: count++ };
    }).cleanup(async (ctx) => {
      topCleanup(count++, ctx);
    }).do();
    for (let i = 0; i < 10; i++) {
      const rtest = await scope
        .eval(async () => {
          if (i === 5) {
            throwsError();
          }
          return { wurst: count++ };
        }).catch(async () => {
          loopCatch(count++);
        })
        .cleanup(async (ctx) => {
          loopCleanup(count++, ctx)
        })
        .do()
      loop(count++, rtest)
    }
    return {
      oks: [],
      errors: [],
    };
  });

  expect(ret.isErr()).toBeTruthy();
  expect(ret.unwrap_err()).toEqual(new Error("my error"));
  expect(loop.mock.calls).toEqual([
    [
      2,
      {
        "wurst": 1,
      },
    ],
    [
      4,
      {
        "wurst": 3,
      },
    ],
    [
      6,
      {
        "wurst": 5,
      },
    ],
    [
      8,
      {
        "wurst": 7,
      },
    ],
    [
      10,
      {
        "wurst": 9,
      },
    ],
  ]

  );
  expect(loopCleanup.mock.calls).toEqual([
    [
      12,
      {
        "wurst": 9,
      },
    ],
    [
      13,
      {
        "wurst": 7,
      },
    ],
    [
      14,
      {
        "wurst": 5,
      },
    ],
    [
      15,
      {
        "wurst": 3,
      },
    ],
    [
      16,
      {
        "wurst": 1,
      },
    ],

  ]);
  expect(loopCatch.mock.calls).toEqual([[11]]);
  expect(top.mock.calls).toEqual([[0]]);
  expect(topCleanup.mock.calls).toEqual([[17, { wurst: 0 }]]);
})


it("scopy rollback loop with drop", async () => {
  const top = jest.fn();
  const topCleanup = jest.fn();
  let count = 0
  const loop = jest.fn();
  const loopCatch = jest.fn();
  const loopCleanup = jest.fn();

  const ret = await scopey(async (scope) => {
    await scope.eval(async () => {
      top(count);
      return { wurst: count++ };
    }).cleanup(async (ctx) => {
      topCleanup(count++, ctx);
    }).do();
    for (let i = 0; i < 10; i++) {
      const rtest = await scope
        .eval(async () => {
          if (i === 5) {
            throwsError();
          }
          return { wurst: count++ };
        }).catch(async () => {
          loopCatch(count++);
        })
        .cleanup(async (ctx) => {
          loopCleanup(count++, ctx)
        })
        .withDropOnSuccess()
        .do()
      loop(count++, rtest)
    }
    return {
      oks: [],
      errors: [],
    };
  });

  expect(ret.isErr()).toBeTruthy();
  expect(ret.unwrap_err()).toEqual(new Error("my error"));
  expect(loop.mock.calls).toEqual([
    [
      2,
      {
        "wurst": 1,
      },
    ],
    [
      4,
      {
        "wurst": 3,
      },
    ],
    [
      6,
      {
        "wurst": 5,
      },
    ],
    [
      8,
      {
        "wurst": 7,
      },
    ],
    [
      10,
      {
        "wurst": 9,
      },
    ],
  ]

  );
  expect(loopCleanup.mock.calls).toEqual([
    [
      12,
      {
        "wurst": 9,
      },
    ],
    [
      13,
      {
        "wurst": 7,
      },
    ],
    [
      14,
      {
        "wurst": 5,
      },
    ],
    [
      15,
      {
        "wurst": 3,
      },
    ],
    [
      16,
      {
        "wurst": 1,
      },
    ],

  ]);
  expect(loopCatch.mock.calls).toEqual([[11]]);
  expect(top.mock.calls).toEqual([[0]]);
  expect(topCleanup.mock.calls).toEqual([[17, { wurst: 0 }]]);
})