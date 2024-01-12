import { scopey } from "./scopey";

function throwsError() {
  throw new Error("my error");
}

it("a scopey is a exception in catch and finally", async () => {
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
  const rsc = await scopey(async (scope) => {
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
  }, log);

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
  const rsc = await scopey(async (scope) => {
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
        second.catch(catchOrder++, err.message);
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
  }, log);
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

  expect(first.catch).toHaveBeenCalledTimes(0);
  expect(first.catch.mock.calls).toEqual([]);
  expect(second.catch).toHaveBeenCalledTimes(1);
  expect(second.catch.mock.calls).toEqual([[0, "my error"]]);
  expect(third.catch).toHaveBeenCalledTimes(0);

  expect(first.finally).toHaveBeenCalledTimes(1);
  expect(first.finally.mock.calls[0][0]).toEqual(1);
  expect(second.finally).toHaveBeenCalledTimes(1);
  expect(second.finally.mock.calls[0][0]).toEqual(0);
  expect(third.finally).toHaveBeenCalledTimes(0);
});

it("a scopey with throw in second eval", async () => {
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
  const rsc = await scopey(async (scope) => {
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
        second.catch(catchOrder++, err.message);
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
  });
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

  expect(first.catch).toHaveBeenCalledTimes(0);
  expect(first.catch.mock.calls).toEqual([]);
  expect(second.catch).toHaveBeenCalledTimes(1);
  expect(second.catch.mock.calls).toEqual([[0, "my error"]]);
  expect(third.catch).toHaveBeenCalledTimes(0);

  expect(first.finally).toHaveBeenCalledTimes(1);
  expect(first.finally.mock.calls[0][0]).toEqual(1);
  expect(second.finally).toHaveBeenCalledTimes(1);
  expect(second.finally.mock.calls[0][0]).toEqual(0);
  expect(third.finally).toHaveBeenCalledTimes(0);
});

it("a scopey happy path", async () => {
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
  const rsc = await scopey(async (scope) => {
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
  });

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
