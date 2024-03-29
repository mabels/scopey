import { Scope, ScopeIdFn, scopey } from "./scopey";

function throwsError(id?: string) {
  throw new Error(`my error${id ? " " + id : ""}`);
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
    ["Scope error in cleanup(0:6): Error: my error"],
    ["Scope error in finally(0:6): Error: my error"],
    ["Scope error in cleanup(0:4): Error: my error"],
    ["Scope error in finally(0:4): Error: my error"],
    ["Scope error in cleanup(0:2): Error: my error"],
    ["Scope error in finally(0:2): Error: my error"],
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
          first.eval(evalOrder++);
          return {
            db: {
              close: first.close,
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              update: (s: string) => {},
            },
          };
        })
        .cleanup(async (ctx) => {
          ctx.db.close("close");
          first.cleanup(cleanupOrder++);
          throwsError("cleanup-1");
        })
        .catch(async () => {
          first.catch(catchOrder++);
          throwsError("catch-1");
        })
        .finally(async () => {
          first.finally(finallyOrder++);
          throwsError("finally-1");
        })
        .do(); // as unknown as { db: { close: () => void; update: (o: string) => void } };
      expect(test.db.close).toEqual(first.close);
      await scope
        .eval(async () => {
          second.eval(evalOrder++);
          throwsError("eval-2");
          return;
        })
        .cleanup(async () => {
          second.cleanup(cleanupOrder++);
          test.db.update(`update error table set error = 'error'`);
          throwsError("cleanup-2");
        })
        .catch(async (err) => {
          second.catch(catchOrder++, (err as Error).message);
          throwsError("catch-2");
        })
        .finally(async () => {
          second.finally(finallyOrder++);
          throwsError("finally-2");
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
      id: 0,
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
    ["Scope error in catch(0:4): Error: my error catch-2"],
    ["Scope error in finally(0:4): Error: my error finally-2"],
    ["Scope error in cleanup(0:2): Error: my error cleanup-1"],
    ["Scope error in finally(0:2): Error: my error finally-1"],
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
              update: (s: string) => {},
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
  let count = 0;
  const loop = jest.fn();
  const loopCatch = jest.fn();
  const loopCleanup = jest.fn();

  const ret = await scopey(async (scope) => {
    await scope
      .eval(async () => {
        top(count);
        return { wurst: count++ };
      })
      .cleanup(async (ctx) => {
        topCleanup(count++, ctx);
      })
      .do();
    for (let i = 0; i < 10; i++) {
      const rtest = await scope
        .eval(async () => {
          if (i === 5) {
            throwsError();
          }
          return { wurst: count++ };
        })
        .catch(async () => {
          loopCatch(count++);
        })
        .cleanup(async (ctx) => {
          loopCleanup(count++, ctx);
        })
        .do();
      loop(count++, rtest);
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
        wurst: 1,
      },
    ],
    [
      4,
      {
        wurst: 3,
      },
    ],
    [
      6,
      {
        wurst: 5,
      },
    ],
    [
      8,
      {
        wurst: 7,
      },
    ],
    [
      10,
      {
        wurst: 9,
      },
    ],
  ]);
  expect(loopCleanup.mock.calls).toEqual([
    [
      12,
      {
        wurst: 9,
      },
    ],
    [
      13,
      {
        wurst: 7,
      },
    ],
    [
      14,
      {
        wurst: 5,
      },
    ],
    [
      15,
      {
        wurst: 3,
      },
    ],
    [
      16,
      {
        wurst: 1,
      },
    ],
  ]);
  expect(loopCatch.mock.calls).toEqual([[11]]);
  expect(top.mock.calls).toEqual([[0]]);
  expect(topCleanup.mock.calls).toEqual([[17, { wurst: 0 }]]);
});

it("scopy rollback loop with drop", async () => {
  const top = jest.fn();
  const topCleanup = jest.fn();
  let count = 0;
  const loop = jest.fn();
  const loopCatch = jest.fn();
  const loopCleanup = jest.fn();
  let gscope: Scope | undefined = undefined;

  const ret = await scopey(async (scope) => {
    gscope = scope;
    await scope
      .eval(async () => {
        top(count);
        return { wurst: count++ };
      })
      .cleanup(async (ctx) => {
        topCleanup(count++, ctx);
      })
      .do();
    for (let i = 0; i < 10; i++) {
      const rtest = await scope
        .eval(async () => {
          if (i === 5) {
            throwsError();
          }
          return { wurst: count++ };
        })
        .catch(async () => {
          loopCatch(count++);
        })
        .cleanup(async (ctx) => {
          loopCleanup(count++, ctx);
        })
        .withDropOnSuccess()
        .do();
      loop(count++, rtest);
    }
    return {
      oks: [],
      errors: [],
    };
  });

  expect(gscope!.cleanups.length).toEqual(0);
  expect(gscope!.finallys.length).toEqual(2);
  expect(gscope!.catchFns.length).toEqual(1);

  expect(ret.isErr()).toBeTruthy();
  expect(ret.unwrap_err()).toEqual(new Error("my error"));
  expect(loop.mock.calls).toEqual([
    [
      3,
      {
        wurst: 1,
      },
    ],
    [
      6,
      {
        wurst: 4,
      },
    ],
    [
      9,
      {
        wurst: 7,
      },
    ],
    [
      12,
      {
        wurst: 10,
      },
    ],
    [
      15,
      {
        wurst: 13,
      },
    ],
  ]);
  expect(loopCleanup.mock.calls).toEqual([
    [
      2,
      {
        wurst: 1,
      },
    ],
    [
      5,
      {
        wurst: 4,
      },
    ],
    [
      8,
      {
        wurst: 7,
      },
    ],
    [
      11,
      {
        wurst: 10,
      },
    ],
    [
      14,
      {
        wurst: 13,
      },
    ],
  ]);

  expect(loopCatch.mock.calls).toEqual([[16]]);
  expect(top.mock.calls).toEqual([[0]]);
  expect(topCleanup.mock.calls).toEqual([[17, { wurst: 0 }]]);
});

it("Test UnRegisterFn", () => {
  const scope = new Scope({ id: 0, log: console.log });
  expect(scope.cleanups).toEqual([]);
  expect(scope.catchFns).toEqual([]);
  expect(scope.finallys).toEqual([]);

  scope.onCleanup(async () => {}, 99);
  scope.onCatch(async () => {}, 99);
  scope.onFinally(async () => {}, 99);

  expect(scope.cleanups.map((f: ScopeIdFn) => f._fnId)).toEqual([0]);
  expect(scope.catchFns.map((f: ScopeIdFn) => f._fnId)).toEqual([1]);
  expect(scope.finallys.map((f: ScopeIdFn) => f._fnId)).toEqual([2]);

  const uclean = scope.onCleanup(async () => {}, 99);
  const ucatch = scope.onCatch(async () => {}, 99);
  const ufinally = scope.onFinally(async () => {}, 99);

  scope.onCleanup(async () => {}, 99);
  scope.onCatch(async () => {}, 99);
  scope.onFinally(async () => {}, 99);

  expect(scope.cleanups.map((f: ScopeIdFn) => f._fnId)).toEqual([0, 3, 6]);
  expect(scope.catchFns.map((f: ScopeIdFn) => f._fnId)).toEqual([1, 4, 7]);
  expect(scope.finallys.map((f: ScopeIdFn) => f._fnId)).toEqual([2, 5, 8]);

  uclean();
  ucatch();
  ufinally();

  expect(scope.cleanups.map((f: ScopeIdFn) => f._fnId)).toEqual([0, 6]);
  expect(scope.catchFns.map((f: ScopeIdFn) => f._fnId)).toEqual([1, 7]);
  expect(scope.finallys.map((f: ScopeIdFn) => f._fnId)).toEqual([2, 8]);
});
