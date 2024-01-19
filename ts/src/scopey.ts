import { Result } from "@adviser/result";

export interface ScopeyParams {
  readonly log: (msgs: unknown[]) => void;
  readonly catch: (err: unknown) => Promise<void>;
  readonly finally: () => Promise<void>;
}

export async function scopey<T>(fn: (scope: Scope) => Promise<T>, params: Partial<ScopeyParams> = {}): Promise<Result<T>> {
  const scope = new Scope(params.log || console.error);
  scope.onCatch(async (err) => {
    if (params.catch) {
      params.catch(err);
    }
  });
  scope.onFinally(async () => {
    if (params.finally) {
      params.finally();
    }
  });
  try {
    return Promise.resolve(Result.Ok(await fn(scope)));
  } catch (err) {
    return await scope.handleCatch<T>(err);
  } finally {
    await scope.handleFinally();
  }
}

export type WithoutPromise<T> = T extends Promise<infer U> ? U : T;

let evaId = 0;
export class EvalBuilder<T> {
  readonly scope: Scope;
  readonly evalFn: () => Promise<T>;
  cleanupFn: (t: WithoutPromise<T>) => Promise<void> = async () => {};
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  catchFn = async (err: Error): Promise<void> => {};
  finallyFn: () => Promise<void> = async () => {};
  readonly id = evaId++;
  #withDropOnSuccess = false;

  constructor(scope: Scope, fn: () => Promise<T>) {
    this.evalFn = fn;
    this.scope = scope;
  }

  withDropOnSuccess(): this {
    this.#withDropOnSuccess = true;
    return this;
  }

  cleanup(fn: (t: WithoutPromise<T>) => Promise<void>): this {
    this.cleanupFn = fn;
    return this;
  }
  catch(fn: (err: unknown) => Promise<void>): this {
    this.catchFn = fn;
    return this;
  }
  finally(fn: () => Promise<void>): this {
    this.finallyFn = fn;
    return this;
  }
  async do(): Promise<T> {
    let ctx: T | undefined;
    try {
      ctx = await this.evalFn();
      return ctx;
    } catch (err) {
      if (!this.#withDropOnSuccess) {
        this.scope.onCatch(async () => {
          return this.catchFn(err as Error);
        });
      } else {
        this.catchFn(err as Error);
      }
      throw err;
    } finally {
      const fn = async () => {
        if (ctx) {
          try {
            await this.cleanupFn(ctx as WithoutPromise<T>);
          } catch (err) {
            this.scope.log(`Scope error in cleanup: ${err}`);
          }
        }
        await this.finallyFn();
        return;
      };
      if (this.#withDropOnSuccess) {
        fn();
      } else {
        this.scope.onFinally(fn);
      }
    }
  }

  async doResult(): Promise<Result<T>> {
    try {
      return Result.Ok(await this.do());
    } catch (err) {
      return Result.Err(err as Error);
    }
  }
}

type VoidPromiseFn<T> = ((v?: T) => Promise<void>) & ScopeIdFn;
type UnregisterFn = () => void;

export interface ScopeIdFn {
  _scopeId?: number;
}

export class Scope {
  scopeId = 0;
  constructor(public readonly log = console.error) {}
  // readonly builders: EvalBuilder<unknown>[] = [];
  eval<T>(fn: () => Promise<T>): EvalBuilder<T> {
    const bld = new EvalBuilder<T>(this, fn);
    // this.builders.push(bld as EvalBuilder<unknown>);
    return bld;
  }

  _registerWithUnregister<T>(fn: VoidPromiseFn<T>, arr: Array<VoidPromiseFn<never>>): UnregisterFn {
    arr.push(fn);
    const scopeyFn = fn;
    scopeyFn._scopeId = this.scopeId++;
    return () => {
      const idx = (arr as unknown as (typeof scopeyFn)[]).findIndex((fn) => fn._scopeId === scopeyFn._scopeId);
      if (idx >= 0) {
        arr.splice(idx, 1);
      }
    };
  }

  readonly cleanups: Array<VoidPromiseFn<never>> = [];
  onCleanup<T>(fn: VoidPromiseFn<T>): UnregisterFn {
    return this._registerWithUnregister(fn, this.cleanups);
  }

  readonly catchFns: Array<VoidPromiseFn<unknown | Error>> = [];
  onCatch(fn: VoidPromiseFn<unknown | Error>): UnregisterFn {
    return this._registerWithUnregister(fn, this.catchFns);
  }

  readonly finallys: Array<VoidPromiseFn<never>> = [];
  onFinally(fn: VoidPromiseFn<void>): UnregisterFn {
    return this._registerWithUnregister(fn, this.finallys);
  }

  async handleFinally(): Promise<void> {
    for (const fn of this.finallys.reverse()) {
      try {
        await fn();
      } catch (err) {
        this.log(`Scope error in finally: ${err}`);
      }
    }
  }

  async handleCatch<T = unknown>(err: unknown): Promise<Result<T>> {
    for (const fn of this.catchFns.reverse()) {
      try {
        await fn(err);
      } catch (err) {
        this.log(`Scope error in catch: ${err}`);
      }
    }
    return Result.Err(err as Error);
  }
}
