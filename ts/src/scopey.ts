import { Result } from "@adviser/result";

export interface ScopeyParams {
  readonly log: (...msgs: unknown[]) => void;
  readonly catch: (err: unknown) => Promise<void>;
  readonly finally: () => Promise<void>;
  readonly id?: number;
}

export interface ScopeParams {
  readonly log: (...msgs: unknown[]) => void;
  readonly id: number;
}

export async function scopey<T>(fn: (scope: Scope) => Promise<T>, params: Partial<ScopeyParams> = {}): Promise<Result<T>> {
  const id = params.id ?? evaId++;
  const scope = new Scope({
    log: params.log ?? console.error,
    id,
  });
  scope.onCatch(async (err) => {
    if (params.catch) {
      params.catch(err);
    }
  }, -1);
  scope.onFinally(async () => {
    if (params.finally) {
      params.finally();
    }
  }, -1);
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
  readonly builderId: number;
  #withDropOnSuccess = false;

  constructor(scope: Scope, fn: () => Promise<T>, builderId: number) {
    this.evalFn = fn;
    this.scope = scope;
    this.builderId = builderId;
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
        }, this.builderId);
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
            this.scope.params.log(`Scope error in cleanup(${this.scope.params.id}:${this.builderId}): ${err}`);
          }
        }
        await this.finallyFn();
        return;
      };
      if (this.#withDropOnSuccess) {
        fn();
      } else {
        this.scope.onFinally(fn, this.builderId);
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
  _fnId?: number;
  _builderId?: number;
}

export class Scope {
  readonly params: ScopeParams;
  scopeId = 0;
  constructor(params: ScopeParams) {
    this.params = params;
  }

  // readonly builders: EvalBuilder<unknown>[] = [];
  eval<T>(fn: () => Promise<T>): EvalBuilder<T> {
    const bld = new EvalBuilder<T>(this, fn, this.scopeId++);
    // this.builders.push(bld as EvalBuilder<unknown>);
    return bld;
  }

  _registerWithUnregister<T>(fn: VoidPromiseFn<T>, arr: Array<VoidPromiseFn<never>>, builderId: number): UnregisterFn {
    arr.push(fn);
    const scopeyFn = fn;
    scopeyFn._fnId = this.scopeId++;
    scopeyFn._builderId = builderId;
    return () => {
      const idx = (arr as unknown as (typeof scopeyFn)[]).findIndex((fn) => fn._fnId === scopeyFn._fnId);
      if (idx >= 0) {
        arr.splice(idx, 1);
      }
    };
  }

  readonly cleanups: Array<VoidPromiseFn<never>> = [];
  onCleanup<T>(fn: VoidPromiseFn<T>, builderId: number): UnregisterFn {
    return this._registerWithUnregister(fn, this.cleanups, builderId);
  }

  readonly catchFns: Array<VoidPromiseFn<unknown | Error>> = [];
  onCatch(fn: VoidPromiseFn<unknown | Error>, builderId: number): UnregisterFn {
    return this._registerWithUnregister(fn, this.catchFns, builderId);
  }

  readonly finallys: Array<VoidPromiseFn<never>> = [];
  onFinally(fn: VoidPromiseFn<void>, builderId: number): UnregisterFn {
    return this._registerWithUnregister(fn, this.finallys, builderId);
  }

  async handleFinally(): Promise<void> {
    for (const fn of this.finallys.reverse()) {
      try {
        await fn();
      } catch (err) {
        this.params.log(`Scope error in finally(${this.params.id}:${fn._builderId}): ${err}`);
      }
    }
  }

  async handleCatch<T = unknown>(err: unknown): Promise<Result<T>> {
    for (const fn of this.catchFns.reverse()) {
      try {
        await fn(err);
      } catch (err) {
        this.params.log(`Scope error in catch(${this.params.id}:${fn._builderId}): ${err}`);
      }
    }
    return Result.Err(err as Error);
  }
}
