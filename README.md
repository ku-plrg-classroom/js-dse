# JavaScript Dynamic Symbolic Execution

This is a homework assignment, and the goal of this assignment is to create a
simple **dynamic symbolic execution (DSE)** engine for a small subset of
JavaScript. Given a function and one initial input, the engine explores the
function path by path: it **instruments** the function so that it computes
symbolic expressions alongside the concrete values, runs it while collecting
the **path condition**, negates one branch of the path it just took, and asks
the [Z3](https://github.com/Z3Prover/z3) solver for an input that takes the
other side.

It utilizes the [`acorn`](https://github.com/acornjs/acorn) library to parse
the JavaScript code, the [`astring`](https://github.com/davidbonnet/astring)
library to generate the instrumented JavaScript code, and the
[`z3-solver`](https://www.npmjs.com/package/z3-solver) package, which is Z3
compiled to WebAssembly, to solve path conditions.

Please refer to the following documents for more information:
* [Type Definitions for `acorn`](https://github.com/acornjs/acorn/blob/master/acorn/src/acorn.d.ts)
* [The high-level JavaScript API of Z3](https://github.com/Z3Prover/z3/tree/master/src/api/js)
* [AST Explorer](https://astexplorer.net/)

**Table of Contents**
* [Setup](#setup)
  + [Requirements](#requirements)
  + [Installation](#installation)
  + [Building](#building)
  + [Running](#running)
* [The JavaScript Subset](#the-javascript-subset)
* [Implementation](#implementation)
  + [Instrumentation](#instrumentation)
  + [The Runtime](#the-runtime)
  + [Solving Path Conditions](#solving-path-conditions)
  + [Exploration](#exploration)
* [Paths and the Report](#paths-and-the-report)
* [Testing](#testing)
  + [Examples](#examples)


## Setup

### Requirements

| #   | Tool    | Version    |
| --- | ------- | ---------- |
| 1   | Node.js | >= 20.0.0  |
| 2   | npm     | >= 10.0.0  |

Z3 itself is installed by `npm install` as the `z3-solver` package -- there is
nothing else to install.


### Installation

```bash
npm install && npm run build
```


### Building

When you implement the missing parts, you can **build the project** using the
following command in the terminal:

```bash
npm run build
```

For **watching the changes**, you can use the following command to build the
project automatically:

```bash
npm run build:watch
```


### Running

**After building the project**, you can **run the project** using the
[`./js-dse`](./js-dse) executable in the project root directory.
```bash
./js-dse
```
The `./js-dse` executable provides the following help message:
```bash
Usage: ./js-dse <command> [options]

Commands:
  ./js-dse instrument  Instrument the target JS file
  ./js-dse run         Run the target function once
  ./js-dse dse         Explore the target function

Options:
  --help     Show help                                                 [boolean]
  --version  Show version number                                       [boolean]

Examples:
  ./js-dse instrument target.js      Instrument the target JS file
  ./js-dse run target.js input.json  Run the target function once
  ./js-dse dse target.js input.json  Explore the target function
```

In addition, you can directly **run the project without building** it as
follows:
```bash
npm run start
```

Similarly, for **watching the changes**, you can use the following command to
run the project automatically without building it:

```bash
npm run start:watch
```

A target file is a JavaScript file consisting of **function declarations**,
where the **first** one is the entry point and its **parameters are the
symbolic inputs**. An input file is a JSON array holding **one initial input**
for it. For example, [`example/simple.js`](./example/simple.js) is the program
of the lecture:

```javascript
function simple(x, y) {
  let z = 2 * x;
  if (z === y) {
    z = y - x;
    if (x < z) {
      return 1;
    } else {
      return 2;
    }
  } else {
    return 3;
  }
}
```

The `instrument` command prints the **instrumented code**, which computes
concolic values instead of plain ones:

```bash
npm run start instrument example/simple.js
```
```javascript
function simple(x, y) {
  let z = __dse__.bin('*', __dse__.lit(2), x);
  if (__dse__.br(0, __dse__.bin('===', z, y))) {
    z = __dse__.bin('-', y, x);
    if (__dse__.br(1, __dse__.bin('<', x, z))) {
      return __dse__.lit(1);
    } else {
      return __dse__.lit(2);
    }
  } else {
    return __dse__.lit(3);
  }
}
```

The `run` command executes it **once** on the initial input
[`example/simple.json`](./example/simple.json), and prints the path it took:

```bash
npm run start run example/simple.js example/simple.json
```
```bash
[INFO ] Running the target function with the given input...
[INFO ] The target file is `example/simple.js`.
[INFO ] The input file is `example/simple.json`.
Path: 3:7-3:14@F
Path condition: !((2 * x) === y)
Return: 3
```

The `dse` command explores it, starting from that input:

```bash
npm run start dse example/simple.js example/simple.json
```
```bash
[INFO ] Exploring the target function...
[INFO ] The target file is `example/simple.js`.
[INFO ] The input file is `example/simple.json`.
Paths: 2
      * 0: 3:7-3:14@F -- simple(3, 7) => 3
      * 1: 3:7-3:14@T, 5:9-5:14@F -- simple(3, 6) => 2
Infeasible: 1
      x 0: 3:7-3:14@T, 5:9-5:14@T
```

Two of the three syntactic paths are feasible, and the third one is not: under
`2x = y`, the condition `x < z` becomes `x < x`. This is the execution tree of
the lecture.

> [!WARNING]
> Please note that it does not produce the above expected output since the
> implementation is missing. You need to implement the missing parts to get the
> expected output.


## The JavaScript Subset

The engine only has to handle the following subset of JavaScript. Anything
else is reported by the given `unsupported` function, and you may assume that
no test uses it.

**Values** are **integers** and **booleans**. There are no strings, objects,
arrays, `null`, `undefined`, floating-point numbers, or implicit conversions:
the condition of a branch is always already a boolean. The **sort of every
symbolic input** is taken from the initial input, so `[0, false]` declares one
integer input and one boolean input.

| Category    | Supported                                                            |
| ----------- | -------------------------------------------------------------------- |
| Expressions | integer and boolean literals, variables                              |
|             | `-` and `!`                                                          |
|             | `+`, `-`, `*`, `%`                                                   |
|             | `<`, `<=`, `>`, `>=`, `===`, `!==`                                   |
|             | `&&`, `\|\|` (short-circuiting), `? :`                                 |
|             | `=`, `+=`, `-=`, `*=`, `%=`, `++`, `--`, and `,`                     |
|             | a call to a function of the program, including a recursive one       |
|             | `hash(e)`, the builtin of the subset                                 |
| Statements  | `let` / `const` / `var` with an initializer                          |
|             | expression statements, blocks, `;`                                   |
|             | `if` / `else`                                                        |
|             | `while`, `do`-`while`, `for (init; test; update)`                    |
|             | `break`, `continue` (without a label), `return`                      |

Two operations are **concretized**: `%`, whose meaning differs from the
solver's on negative operands, and the builtin `hash`, for which the solver has
no theory at all. Both keep the concrete value they computed but lose their
symbolic expression, so a branch that depends on them cannot be flipped. This
is exactly the `hash` example of the lecture: the engine keeps running where
plain symbolic execution is stuck, at the price of missing some paths.

Division `/` is not supported, since integer division in the solver does not
agree with JavaScript's `/`.


## Implementation

**Please implement the missing parts** (denoted by `todo()` functions) in
[`src/dse.ts`](./src/dse.ts). It is the **only file you have to modify, and
the only file you submit**; everything else -- parsing, the AST builders, the
loading and the teardown of Z3, the command-line interface, and the report --
is given in the other files of `src`.

The file has four parts, in this order. The first one is enough to make the
`instrument` tests pass, and the first two make the `run` tests pass, so
implement them first and use `./js-dse instrument` and `./js-dse run` to check
your work before you touch Z3.


### Instrumentation

The `Instrumenter` class rewrites the target program so that it computes
**concolic values** instead of plain ones. A concolic value is a **pair** of
the concrete value that the real execution produced and the symbolic
expression that describes how it was computed:

```javascript
{ conc: 6, sym: 2 * x }
```

You implement its two visitors `stmt` and `expr`. The given method `cond` is
the pattern they follow: build a new node with the helpers of
[`src/helper.ts`](./src/helper.ts) -- `createCall`, `createLit`,
`createArrow`, and `createAssign`. A few cases of each visitor are already
written as worked examples (`ExpressionStatement`, `BlockStatement`,
`Literal`, `Identifier`, and `UnaryExpression`); every remaining `todo` is a
variation of one of them.

Note how **little** the statements need: blocks, loops, `break`, `continue`,
`return`, and the call stack are all handled by the JavaScript engine that runs
the instrumented code. Only the expressions inside them have to be rewritten,
and only the conditions need a wrapper. Three cases deserve attention:

* **`&&` and `||` short-circuit.** The right operand must not be evaluated
  before the left one is known, so it is passed as a function:
  `a && b` becomes `__dse__.and(<id>, a, () => b)`.
* **A postfix `x++` evaluates to the old value.** The assignment is delayed in
  the same way: `__dse__.post(x, () => x = __dse__.bin('+', x, __dse__.lit(1)))`.
* **A `for` without a test loops forever.** Giving it the test `true` lets the
  runtime count the iteration and stop a runaway execution.


### The Runtime

The `Runtime` class is what the instrumented code calls. You implement `bin`,
`hash`, and `br`; `lit`, `un`, `and`, `or`, and `post` are given, and `un` is the guide the others follow -- compute the concrete result
with the real JavaScript operator, and build the symbolic expression for it at
the same time.

`br` records a **decision** in the current path, and gives back a plain boolean
so that the instrumented code can branch on it. Two rules explain why a program
has fewer decisions than it has syntactic branches:

* A condition that **does not depend on any input** is not a decision: the
  counter of `for (let i = 0; i < 3; i++)` is never symbolic, so the loop
  contributes nothing to the path condition.
* A condition the path condition **already contains** is not recorded again.
  This matters for `if (a && b)`: when `a` is false, the value of `a && b` is
  `a` itself, and the `if` would otherwise record `a` twice.

An execution is cut off after `MAX_DEPTH` decisions or `MAX_STEPS` steps, so
that a loop or a recursion whose depth follows an input has finitely many
paths.


### Solving Path Conditions

`toZ3` translates a symbolic expression into a Z3 expression with the
high-level API of the lecture:

```javascript
x.mul(2).eq(y)      // 2 * x === y
x.lt(y.sub(x))      // x < y - x
b.not()             // !b
```

The cases for a variable and for a literal are given as a guide. The given
`solve` of [`src/solver.ts`](./src/solver.ts) takes `toZ3` as its last
argument, so that the two files do not depend on each other.


### Exploration

The `DSE` class holds the loop itself, and you implement `explore`. Starting
from the initial input, it repeatedly

1. runs the function concolically on an input, and records the path it took,
2. negates one decision of that path, from the last one backwards, and
3. asks the solver for an input that takes the other side of that branch.

An unsatisfiable path condition is recorded in `infeasible`; a satisfiable one
gives the next input. The loop stops when no unexplored side of any branch is
left.

> [!TIP]
> The solver is asked for the input **closest to the one of the current
> execution**, so that an input the path condition does not mention keeps its
> value. This is what keeps a concretized `hash(x)` valid after the flip, and
> it is already implemented in the given part of `solve`.


## Paths and the Report

A **path** is identified by its sequence of decisions, each written as the
**source range** of the condition (`line:col-line:col`) and the direction the
execution took (`@T` or `@F`):

```
3:7-3:14@T, 5:9-5:14@F
```

The report lists the feasible paths and the path conditions the solver proved
infeasible:

```
Paths: 2
      * 0: 3:7-3:14@F -- simple(3, 7) => 3
      * 1: 3:7-3:14@T, 5:9-5:14@F -- simple(3, 6) => 2
Infeasible: 1
      x 0: 3:7-3:14@T, 5:9-5:14@T
```

A path that was cut off by a bound is marked with `~` instead of `*`, and the
path of an execution without any decision is written `(empty)`.

**Neither the numbering of the paths nor the generated inputs matter.** The
tests compare the *set* of path signatures, because the engine may legitimately
report a different satisfying input for the same path -- a different version of
Z3, or a different exploration order, would give other values. The set of paths
itself does not depend on either.


## Testing

You can **test the project** using the following command in the terminal:

```bash
npm run test
```

For **watching the changes**, you can use the following command to test the
project automatically:

```bash
npm run test:watch
```

It contains **100 different tests** over the **24 JavaScript files**:

| Group        | Tests | What it needs                                        |
| ------------ | ----- | ---------------------------------------------------- |
| `instrument` | 24    | the instrumenter                                     |
| `run`        | 24    | the instrumenter and the runtime                     |
| `dse`        | 48    | all four parts                                       |
| `bounds`     | 2     | all four parts                                       |
| `report`     | 2     | all four parts                                       |

The `instrument` group compares the **instrumented code** of each example with
`example/<name>.instrumented.js`, which is exactly what `./js-dse instrument`
prints for it. It needs the instrumenter only, so it is the group that passes
**first**: implement `stmt` and `expr`, and those 24 tests go green. The two
programs are compared as **ASTs**, not as text: the whitespace, the quotes of
a string literal, and the **numbering of the branch ids** do not matter, as
long as every `br`, `and` and `or` is at the same place with the same
operands.

The `run` group checks **one execution on the initial input** -- the path it
takes and the value it returns. It uses neither the solver nor `explore`, so
it is the **next** group to pass: add `bin`, `hash` and `br`, and those 24
tests go green before you write a single Z3 query.

```bash
$ npm run test
  instrument
    ✔ should instrument assign.js correctly
    ✔ should instrument bool.js correctly
    ...
    ✔ should instrument update.js correctly

  run
    ✔ should run assign.js along the correct path
    ✔ should run bool.js along the correct path
    ...
    ✔ should run update.js along the correct path

  dse
    assign.js
      ✔ should find the correct paths
      ✔ should find the correct infeasible path conditions
    ...
    update.js
      ✔ should find the correct paths
      ✔ should find the correct infeasible path conditions

  bounds
    ✔ should cut off an execution at the depth bound
    ✔ should cut off an execution at the steps bound

  report
    ✔ should print the report in the documented format
    ✔ should mark a path cut off by a bound with `~`

  100 passing (695ms)
```


### Examples

The `example` directory contains four different files for each example:

1. `*.js`: the target JavaScript file, whose first function is the entry point
2. `*.json`: the **initial input**, a JSON array with one value per parameter
3. `*.instrumented.js`: the **instrumented code**, as printed by
   `./js-dse instrument`
4. `*.expected.json`: the **expected result** -- the path of one execution on
   the initial input, the signature of every feasible path, and of every
   infeasible path condition

| Example       | What it exercises                                                        |
| ------------- | ------------------------------------------------------------------------ |
| `assign`      | compound assignment, an assignment as an expression, `? :`               |
| `bool`        | a boolean input, `!`, a branch that is infeasible in one direction       |
| `bounded`     | a loop whose trip count is symbolic, cut off at `MAX_DEPTH`              |
| `call`        | symbolic values flowing through calls to other functions                 |
| `dowhile`     | `do`-`while` with an early `return`                                      |
| `forever`     | `for (;;)` without a test: a concrete infinite loop, cut off at `MAX_STEPS` |
| `forloop`     | a `for` whose counter is concrete, so only the body branches             |
| `gcd`         | recursion, where `%` concretizes the argument of the next call           |
| `hash`        | the builtin `hash`: the solver is stuck, the concrete value is not       |
| `logical`     | `&&` and `\|\|`, where the left clause is a branch of its own              |
| `loop`        | `while` with a `break`, the loop walkthrough of the lecture              |
| `modulo`      | `%` is concretized, so a branch on it is lost                            |
| `nested`      | nested `if`/`else`, and a value that stops being symbolic                |
| `nestedloop`  | nested `for` loops, where a condition already in the path is not recorded again |
| `parity`      | mutual recursion whose depth follows the input, cut off at `MAX_DEPTH`   |
| `range`       | `>=`, `<=` and `!==`, and an `&&` as the condition of an `if`            |
| `sequence`    | `var`, the comma operator in a `for` and in a `return`, an assignment as an expression |
| `sign`        | a nested `? :`, and `-` on a literal and on a variable in a path condition |
| `simple`      | the running example of the lecture                                       |
| `skip`        | `continue`, and an `if` without a block                                  |
| `ternary`     | `? :` in a declaration and in a `return`                                 |
| `triple`      | three nested conditions -- the solver finds `(34, 68)` at once           |
| `unreachable` | contradictory conditions, reported as infeasible path conditions         |
| `update`      | `x++` and `++x` as values, whose old and new values differ               |

For example, [`example/simple.expected.json`](./example/simple.expected.json)
says that the initial input takes the `else` branch and returns `3`, that two
paths are feasible, and that one path condition is not:

```json
{
  "run": {
    "path": "3:7-3:14@F",
    "ret": "3"
  },
  "paths": [
    "3:7-3:14@F",
    "3:7-3:14@T, 5:9-5:14@F"
  ],
  "infeasible": [
    "3:7-3:14@T, 5:9-5:14@T"
  ]
}
```
