import { Result } from "@adviser/result";

export async function scopey<T>(fn: (scope: Scope) => Promise<T>, log = console.error): Promise<Result<T>> {
  const scope = new Scope(log);
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

  constructor(scope: Scope, fn: () => Promise<T>) {
    this.evalFn = fn;
    this.scope = scope;
  }

  cleanup(fn: (t: WithoutPromise<T>) => Promise<void>): this {
    this.cleanupFn = fn;
    return this;
  }
  catch(fn: (err: Error) => Promise<void>): this {
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
      this.scope.onCatch(async () => {
        return this.catchFn(err as Error);
      });
      throw err;
    } finally {
      this.scope.onFinally(async () => {
        if (ctx) {
          try {
            await this.cleanupFn(ctx as WithoutPromise<T>);
          } catch (err) {
            this.scope.log(`Scope error in cleanup: ${err}`);
          }
        }
        await this.finallyFn();
        return;
      });
    }
  }
}

export class Scope {
  constructor(public readonly log = console.error) {}
  // readonly builders: EvalBuilder<unknown>[] = [];
  eval<T>(fn: () => Promise<T>): EvalBuilder<T> {
    const bld = new EvalBuilder<T>(this, fn);
    // this.builders.push(bld as EvalBuilder<unknown>);
    return bld;
  }

  cleanups: ((ctx: unknown) => Promise<void>)[] = [];
  onCleanup<T>(fn: (ctx: T) => Promise<void>) {
    this.cleanups.push(fn as (ctx: unknown) => Promise<void>);
  }
  catchFns: ((err: Error) => Promise<void>)[] = [];
  onCatch(fn: () => Promise<void>) {
    this.catchFns.push(fn);
  }
  finallys: (() => Promise<void>)[] = [];
  onFinally(fn: () => Promise<void>) {
    this.finallys.push(fn);
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
        await fn(err as Error);
      } catch (err) {
        this.log(`Scope error in catch: ${err}`);
      }
    }
    return Result.Err(err as Error);
  }
}