import {
  Expression,
  FunctionDeclaration,
  Program,
  Statement,
} from 'acorn';

import { generate } from 'astring';

import {
  MAX_DEPTH,
  MAX_STEPS,
  RUNTIME,
  Range,
  createArrow,
  createAssign,
  createCall,
  createLit,
  err,
  getFuncs,
  getParamNames,
  parse,
  todo,
  unsupported,
} from './helper';

import {
  Conc,
  Sym,
  Value,
  asBool,
  asNum,
  binarySym,
  concrete,
  concToString,
  concretize,
  hasVar,
  input,
  symToString,
  unarySym,
} from './sym';

import {
  Decision,
  DepthExceeded,
  Path,
  RunResult,
  StepsExceeded,
  flip,
  pathCond,
  pathToString,
} from './path';

import { Param, Z3Ctx, Z3Expr, solve } from './solver';

// A hash function, provided as a builtin of the subset.  The solver has no
// theory for it: a path condition containing `hash` is `unknown`.  This is the
// `hash` example of the lecture, and the reason DSE concretizes.
export function hash(n: number): number {
  return ((n * 1103515245 + 12345) % 2048 + 2048) % 2048;
}

// ------------------------------------------------------------------------- //
// The instrumenter
// ------------------------------------------------------------------------- //
// Rewrite the target program so that it computes concolic values instead of
// plain ones.  Every expression becomes a call to the runtime, and every
// condition is wrapped in `__dse__.br`, which records the branch decision and
// gives back a plain boolean for the real JavaScript engine:
//
//     let z = 2 * x;                  let z = __dse__.bin('*', __dse__.lit(2), x);
//     if (z === y) { ... }            if (__dse__.br(0, __dse__.bin('===', z, y))) { ... }
//
// Statements are left alone: blocks, loops, `break`, `continue`, `return` and
// the call stack are all handled by the engine that runs the instrumented
// code.
export class Instrumenter {
  program: Program;
  funcs: FunctionDeclaration[];

  // The source range of every branch site, indexed by the id passed to `br`
  ranges: Range[] = [];

  constructor(public code: string) {
    this.program = parse(code);
    this.funcs = getFuncs(this.program);
  }

  // Instrument every function of the program, and generate its source
  instrument(): string {
    for (const func of this.funcs) func.body.body = this.stmts(func.body.body);
    return generate(this.program);
  }

  // Issue an id for a branch site, remembering the range of its condition
  site(node: Expression): number {
    this.ranges.push(Range.fromNode(this.code, node));
    return this.ranges.length - 1;
  }

  // A condition becomes `__dse__.br(<id>, <condition>)`, which records the
  // decision and evaluates to a plain boolean.  Given as a guide: every case
  // of `stmt` and `expr` below builds a node in the same way.
  cond(node: Expression): Expression {
    const id = this.site(node);
    return createCall('br', [createLit(id), this.expr(node)]);
  }

  // Instrument a list of statements
  stmts(stmts: Statement[]): Statement[] {
    return stmts.map(stmt => this.stmt(stmt));
  }

  // Instrument a statement, in place.
  //
  // Read `cond` above first: it is the pattern that every case here and in
  // `expr` follows -- build a new node with the helpers of `helper.ts`
  // (`createCall`, `createLit`, `createArrow`, `createAssign`).
  //
  // Most statements need no instrumentation of their own: the blocks, the
  // loops, `break`, `continue`, `return` and the call stack are all handled by
  // the JavaScript engine that runs the instrumented code.  Only the
  // expressions inside them, and the conditions, have to be rewritten.
  stmt(stmt: Statement): Statement {
    switch (stmt.type) {
      case 'EmptyStatement':
      case 'BreakStatement':
      case 'ContinueStatement':
        return stmt;

      case 'ExpressionStatement':
        stmt.expression = this.expr(stmt.expression);
        return stmt;

      case 'BlockStatement':
        stmt.body = this.stmts(stmt.body);
        return stmt;

      case 'VariableDeclaration': {
        // This subset has neither destructuring nor a declaration without an
        // initializer; report them with `unsupported`.
        todo('VariableDeclaration');
      }

      case 'IfStatement': {
        // The test is a condition, and the alternate is optional.
        todo('IfStatement');
      }

      case 'WhileStatement':
      case 'DoWhileStatement': {
        todo('WhileStatement');
      }

      case 'ForStatement': {
        // `init`, `test` and `update` are all optional, and `init` is either a
        // declaration or an expression.  A `for` without a test loops forever,
        // so give it the test `true`: the runtime then gets a chance to count
        // the iteration.
        todo('ForStatement');
      }

      case 'ReturnStatement': {
        // The argument is optional.
        todo('ReturnStatement');
      }

      default: return unsupported(stmt);
    }
  }

  // Instrument an expression, in place.  Every expression of the subset
  // becomes a call to the runtime, so that it computes a concolic value.
  expr(expr: Expression): Expression {
    switch (expr.type) {
      // `1` becomes `__dse__.lit(1)`
      case 'Literal':
        return createCall('lit', [expr]);

      // A variable already holds a concolic value
      case 'Identifier':
        return expr;

      // `-e` becomes `__dse__.un('-', e)`
      case 'UnaryExpression':
        if (!expr.prefix) unsupported(expr);
        return createCall('un', [
          createLit(expr.operator),
          this.expr(expr.argument),
        ]);

      case 'BinaryExpression': {
        // `l + r` becomes `__dse__.bin('+', l, r)`.  Note that the left
        // operand of `in` may be a `PrivateIdentifier`, which is not an
        // expression.
        todo('BinaryExpression');
      }

      case 'LogicalExpression': {
        // `&&` and `||` short-circuit, so the right operand must *not* be
        // evaluated yet: pass it as `() => right` (`createArrow`) to
        // `__dse__.and` or `__dse__.or`.  The left operand is a branch of its
        // own, so it needs a `site`, and the runtime calls `br` on it.
        todo('LogicalExpression');
      }

      case 'ConditionalExpression': {
        // The test is a condition.
        todo('ConditionalExpression');
      }

      case 'AssignmentExpression': {
        // `x = e` only needs its right-hand side instrumented, and a compound
        // assignment `x += e` becomes `x = __dse__.bin('+', x, e)`.
        todo('AssignmentExpression');
      }

      case 'UpdateExpression': {
        // `++x` is an assignment of `__dse__.bin('+', x, __dse__.lit(1))`.
        // `x++` evaluates to the *old* value, so the assignment is delayed and
        // handed to `__dse__.post` as `() => x = ...`.
        todo('UpdateExpression');
      }

      case 'CallExpression': {
        // `hash(e)` becomes `__dse__.hash(e)`, since the solver has no theory
        // for it.  Any other call is a call to a function of the program: its
        // arguments are instrumented, and the real call stack does the rest.
        todo('CallExpression');
      }

      case 'SequenceExpression': {
        todo('SequenceExpression');
      }

      default: return unsupported(expr);
    }
  }
}

// ------------------------------------------------------------------------- //
// The runtime
// ------------------------------------------------------------------------- //
// The instrumented code calls these methods instead of computing with plain
// values.  Each of them computes the concrete result -- with the real
// JavaScript operator -- and, at the same time, builds the symbolic
// expression that describes how that result was computed.
export class Runtime {
  code: string;
  instrumented: string;        // the instrumented source
  entry: string;               // the name of the entry function
  params: string[];            // the names of the symbolic inputs
  ranges: Range[];             // the source range of every branch site
  runner: (rt: Runtime) => Function;

  // The state of the current execution
  path: Path = [];
  seen: Set<string> = new Set();
  steps: number = 0;

  constructor(code: string) {
    const instrumenter = new Instrumenter(code);
    const func = instrumenter.funcs[0];
    this.code = code;
    this.instrumented = instrumenter.instrument();
    this.ranges = instrumenter.ranges;
    this.entry = func.id.name;
    this.params = getParamNames(func);
    this.runner = eval(
      `(${RUNTIME}) => { ${this.instrumented}; return ${this.entry}; }`
    );
  }

  // Run the instrumented function once with the given concrete input
  run(args: Conc[]): RunResult {
    const { params } = this;
    if (args.length !== params.length) {
      err(`The input must have ${params.length} value(s).`);
    }
    this.path = [];
    this.seen = new Set();
    this.steps = 0;

    let ret: Conc | undefined = undefined;
    let bounded = false;
    try {
      const value = this.runner(this).apply(
        null,
        params.map((name, i) => input(name, args[i]))
      );
      if (value !== undefined) ret = (value as Value).conc;
    } catch (e) {
      if (e instanceof DepthExceeded || e instanceof StepsExceeded) {
        bounded = true;
      } else throw e;
    }
    return { path: this.path, ret, bounded };
  }

  // ----------------------------------------------------------------------- //
  // Called from the instrumented code
  // ----------------------------------------------------------------------- //

  // A literal has no symbolic part
  lit = (value: Conc): Value => concrete(value);

  // `a && b` and `a || b`.  The left operand is a branch, and the right one is
  // delayed: it is only evaluated when the left one does not decide the
  // result.  The whole expression evaluates to one of the two operands.
  and = (id: number, left: Value, right: () => Value): Value =>
    this.br(id, left) ? right() : left;
  or = (id: number, left: Value, right: () => Value): Value =>
    this.br(id, left) ? left : right();

  // `x++` and `x--`: the update is delayed, and the old value is the result
  post = (old: Value, update: () => Value): Value => { update(); return old; };

  // A unary operation: `-` on a number and `!` on a boolean
  un = (op: string, value: Value): Value => {
    switch (op) {
      case '-': return { conc: -asNum(value), sym: unarySym('-', value.sym) };
      case '!': return { conc: !asBool(value), sym: unarySym('!', value.sym) };
      default: return err(`Unsupported operator: \`${op}\`.`);
    }
  }

  // A binary operation.
  //
  // `+`, `-`, `*`, `<`, `<=`, `>`, `>=`, `===` and `!==` are computed with the
  // real JavaScript operator, and the symbolic expression is built with
  // `binarySym` at the same time.
  //
  // `%` is *concretized*: the solver's `%` does not agree with JavaScript's on
  // negative operands, so the result keeps its concrete value but loses its
  // symbolic expression (`concretize`), and no branch on it can be flipped.
  //
  // `==`, `!=` and `/` are outside the subset, and `===` between a number and
  // a boolean is an error.
  bin = (op: string, left: Value, right: Value): Value => {
    todo('Runtime.bin');
  }

  // The builtin `hash`, which the solver cannot reason about.  Its result has
  // to be concretized -- this is the step that lets DSE go where symbolic
  // execution is stuck.
  hash = (value: Value): Value => {
    todo('Runtime.hash');
  }

  // Take a branch on a condition, record it as a decision, and give back a
  // plain boolean for the real JavaScript engine.
  //
  // Two conditions are *not* recorded:
  //
  //   * one that does not depend on any input -- the counter of
  //     `for (let i = 0; i < 3; i++)` is never symbolic, so the loop
  //     contributes nothing to the path condition, and
  //   * one the path condition already contains -- `a && b` evaluates to `a`
  //     itself when `a` is false, and the enclosing `if` would record it twice.
  br = (id: number, cond: Value): boolean => {
    // 1. Count the step, and throw `StepsExceeded` beyond `MAX_STEPS`.
    // 2. Record a decision -- the range `this.ranges[id]`, the symbolic
    //    condition, and the direction this execution takes -- unless one of
    //    the two rules above applies.  `symToString` gives the formula of a
    //    condition, and `hasVar` tells whether it depends on an input.
    // 3. Throw `DepthExceeded` when the path already has `MAX_DEPTH`
    //    decisions.
    // 4. Give back the concrete boolean, so that the instrumented code can
    //    branch on it.
    todo('Runtime.br');
  }
}

// Convert a symbolic expression into a Z3 expression, where `ctx` is the Z3
// context and `consts` maps the name of every symbolic input to its Z3
// constant.
export function toZ3(
  ctx: Z3Ctx,
  consts: Map<string, Z3Expr>,
  sym: Sym,
): Z3Expr {
  switch (sym.type) {
    case 'Var': {
      const c = consts.get(sym.name);
      if (!c) err(`Unknown symbolic input: \`${sym.name}\`.`);
      return c;
    }
    case 'Num': return ctx.Int.val(sym.value);
    case 'Bool': return ctx.Bool.val(sym.value);
    case 'Unary': {
      // `neg` negates an integer and `not` negates a boolean.
      todo('Unary');
    }
    case 'Binary': {
      // `add`, `sub`, `mul`, `lt`, `le`, `gt`, `ge`, `eq` and `neq`.
      todo('Binary');
    }
  }
}

// One explored path, together with the input that drove the execution
export interface PathInfo {
  path: Path;
  input: Conc[];
  ret: Conc | undefined;
  bounded: boolean;
}

// Dynamic symbolic execution of the target function.
//
// Starting from one initial input, the engine repeatedly
//   1. runs the function concolically, collecting the path condition,
//   2. negates one decision of the path it just took, and
//   3. asks the solver for an input that follows the other side.
//
// It stops when no unexplored side of any branch is left, so the set of paths
// it finds does not depend on which satisfying input the solver happens to
// return.
export class DSE {
  code: string;
  func: FunctionDeclaration;
  initial: Conc[];
  params: Param[];

  // The explored feasible paths
  paths: PathInfo[] = [];

  // The path conditions the solver proved unsatisfiable, as signatures
  infeasible: string[] = [];

  constructor(code: string, initial: Conc[]) {
    this.code = code;
    this.func = getFuncs(parse(code))[0];
    this.initial = initial;

    // The sort of every symbolic input is taken from the initial input
    const names = getParamNames(this.func);
    if (names.length !== initial.length) {
      err(`The initial input must have ${names.length} value(s).`);
    }
    this.params = names.map((name, i) => {
      const conc = initial[i];
      if (typeof conc === 'boolean') return { name, sort: 'boolean' as const };
      if (typeof conc === 'number' && Number.isInteger(conc)) {
        return { name, sort: 'number' as const };
      }
      return err(`The input \`${name}\` must be an integer or a boolean.`);
    });
  }

  // Explore the target function, filling `paths` and `infeasible`.
  //
  // Keep a worklist of inputs, starting from `this.initial`, and repeat until
  // it is empty:
  //
  //   1. Run the function concolically on one input of the worklist
  //      (`Runtime.run`), and record the path it took as a `PathInfo`.  A path
  //      that has already been run is skipped -- `pathToString` identifies it.
  //   2. For every decision of that path, from the last one backwards, build
  //      the path condition that takes the other side (`flip`, `pathCond`).
  //   3. Ask the solver for an input satisfying it, as
  //      `solve(<path condition>, this.params, <the current input>, toZ3)`.
  //      A satisfiable one goes back on the worklist; an unsatisfiable one is
  //      recorded in `this.infeasible` by its signature.
  //
  // A path condition should be sent to the solver only once, and never for a
  // prefix of a path that has already been run: such a prefix is known to be
  // feasible, and asking again would only add a duplicate to the worklist.
  //
  // Note that one `Runtime` instruments the code once, and can be run many
  // times.
  async explore(): Promise<void> {
    todo('DSE.explore');
  }

  // The call that produced a path, e.g. `sort(3, 7)`
  call(input: Conc[]): string {
    const name = this.func.id ? this.func.id.name : 'f';
    return `${name}(${input.map(concToString).join(', ')})`;
  }

  // Conversion to string.  Paths are sorted by their signature, so that the
  // report does not depend on the order in which they were discovered.
  toString = (showDetail: boolean = false): string => {
    const paths = [...this.paths].sort((a, b) =>
      pathToString(a.path).localeCompare(pathToString(b.path))
    );
    const infeasible = [...this.infeasible].sort();

    let str = `Paths: ${paths.length}\n`;
    if (showDetail) {
      paths.forEach((info, i) => {
        const mark = info.bounded ? '~' : '*';
        str += `      ${mark} ${i}: ${pathToString(info.path)}`;
        str += ` -- ${this.call(info.input)} => ${String(info.ret)}\n`;
      });
    }
    str += `Infeasible: ${infeasible.length}\n`;
    if (showDetail) {
      infeasible.forEach((sig, i) => { str += `      x ${i}: ${sig}\n`; });
    }
    return str.trim();
  }
}
