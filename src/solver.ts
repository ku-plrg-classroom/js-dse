import { err, warn } from './helper';
import { Conc, Sym, symToString } from './sym';

// The Z3 solver is loaded as a WebAssembly module, so it must be initialized
// asynchronously before any query, and its worker threads must be terminated
// before the process can exit.
//
//     const { Context } = await init();
//     const { Int, Solver } = new Context('main');
//
// See the lecture slide "Z3 From a Program" for the raw API.

// A Z3 expression: an integer (`Arith`) or a boolean (`Bool`) expression.
// The high-level API builds them by chaining methods:
//
//     Int.const('x').mul(2).eq(y)      // 2 * x === y
//     Int.const('x').lt(y.sub(x))      // x < y - x
//     b.not()                          // !b
//
export type Z3Expr = any;

// The Z3 context: `ctx.Int.const(name)`, `ctx.Bool.const(name)`,
// `ctx.Int.val(n)`, `ctx.Bool.val(b)`, `new ctx.Solver()`, ...
export type Z3Ctx = any;

// A symbolic input of the analysis.  The sort of a parameter is taken from the
// initial input: `[0, false]` declares an integer and a boolean parameter.
export interface Param {
  name: string;
  sort: 'number' | 'boolean';
}

// The result of a query
export type SolveResult =
  | { status: 'sat'; model: Conc[] }
  | { status: 'unsat' }
  | { status: 'unknown' };

// Integer inputs are kept within this bound so that the concrete execution of
// the generated input stays faithful: Z3 integers are unbounded, while a
// JavaScript number is only exact up to 2^53.
const BOUND = 1 << 20;

let z3: any = null;
let ctx: Z3Ctx = null;

// Initialize the solver
export async function initSolver(): Promise<void> {
  if (ctx) return;
  const { init } = await import('z3-solver');
  z3 = await init();
  ctx = new z3.Context('main');
}

// Terminate the worker threads of the solver, letting the process exit
export function closeSolver(): void {
  if (z3) z3.em.PThread.terminateAllThreads();
  z3 = null;
  ctx = null;
}

// Solve a path condition, and return an input satisfying it if it is
// satisfiable.  The returned model gives one concrete value per parameter, in
// the order of the parameters.
// The conversion of a symbolic expression into a Z3 expression, which is
// implemented in `dse.ts` and passed in to avoid a cycle between the modules.
export type ToZ3 = (
  ctx: Z3Ctx,
  consts: Map<string, Z3Expr>,
  sym: Sym,
) => Z3Expr;

export async function solve(
  pc: Sym[],
  params: Param[],
  base: Conc[],
  toZ3: ToZ3,
): Promise<SolveResult> {
  if (!ctx) err('The solver is not initialized.');

  // Declare a Z3 constant for every symbolic input
  const consts = new Map<string, Z3Expr>();
  for (const { name, sort } of params) {
    consts.set(
      name,
      sort === 'number' ? ctx.Int.const(name) : ctx.Bool.const(name)
    );
  }

  // `Optimize` is a solver that minimizes an objective.  Asking for the input
  // closest to the one of the current execution keeps the inputs the path
  // condition does not mention unchanged, so that a value concretized during
  // that execution stays valid -- and it keeps the generated inputs readable.
  const solver = new ctx.Optimize();

  // Keep the integer inputs within the exact range of a JavaScript number
  for (const { name, sort } of params) {
    if (sort !== 'number') continue;
    const c = consts.get(name);
    solver.add(c.ge(ctx.Int.val(-BOUND)), c.le(ctx.Int.val(BOUND)));
  }

  // The path condition itself
  for (const cond of pc) solver.add(toZ3(ctx, consts, cond));

  // Prefer the input closest to `base`, the input of the current execution
  const zero = ctx.Int.val(0);
  const one = ctx.Int.val(1);
  const dist = (name: string, sort: string, from: Conc) => {
    const c = consts.get(name);
    if (sort === 'boolean') {
      return ctx.If(c.eq(ctx.Bool.val(from as boolean)), zero, one);
    }
    const diff = c.sub(ctx.Int.val(from as number));
    return ctx.If(diff.ge(zero), diff, diff.neg());
  };
  if (params.length > 0) {
    solver.minimize(
      params
        .map(({ name, sort }, i) => dist(name, sort, base[i]))
        .reduce((a: Z3Expr, b: Z3Expr) => a.add(b))
    );
  }

  const status = await solver.check();
  if (status === 'unsat') return { status: 'unsat' };
  if (status !== 'sat') {
    warn(`The solver returned \`unknown\`: ${pc.map(symToString).join(' && ')}`);
    return { status: 'unknown' };
  }

  // Read the model.  An input that the path condition does not constrain does
  // not appear in the model, and keeps its default value.
  const m = solver.model();
  const model = params.map(({ name, sort }) => {
    const value = m.eval(consts.get(name));
    if (sort === 'number') {
      return ctx.isIntVal(value) ? Number(value.value()) : 0;
    } else {
      return ctx.isTrue(value) ? true : false;
    }
  });
  return { status: 'sat', model };
}
