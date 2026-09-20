import chalk from 'chalk';
import inspect from 'object-inspect';

import acorn from 'acorn';
import {
  Expression,
  FunctionDeclaration,
  Node,
  Pattern,
  Program,
} from 'acorn';

import fs from 'fs';

enum LogLevel {
  LOG,
  WARN,
  ERROR,
}

export const scriptName = './js-dse';

// The maximum number of branch decisions in a single execution.  A loop whose
// condition depends on an input has infinitely many paths, so the engine only
// explores the ones with at most `MAX_DEPTH` decisions.
export const MAX_DEPTH = 16;

// The maximum number of statements a single execution may run.  A loop whose
// condition does not depend on any input contributes no decision, so the depth
// bound alone would not stop `while (true) { }`.
export const MAX_STEPS = 100000;

// Read the file
export function readFile(path: string): string {
  if (!fs.existsSync(path)) err(`File not found: \`${path}\`.`);
  return fs.readFileSync(path, 'utf-8').toString().trim();
}

// Write the file
export function writeFile(path: string, content: string): void {
  fs.writeFileSync(path, content);
}

export function getArgs(cmd: string, argv: any, expected: number): string[] {
  if (argv._.length - 1 != expected) {
    err(`Exactly ${expected} arguments are required for \`${cmd}\`.`);
  }
  return argv._.slice(1);
}

// Read the JSON file
export function readJSON(path: string): any {
  return JSON.parse(readFile(path));
}

// Get the string representation of a value
export function getString(value: any): string {
  if (typeof value === 'string') return value;
  if (value === undefined || value === null) return String(value);
  if (value.hasOwnProperty('toString')) return value.toString();
  return inspect(value, { depth: 3 });
}

// Log a message
export function log(
  value: any,
  level: LogLevel = LogLevel.LOG,
  header: string = 'INFO',
  color: (msg: string) => string = chalk.white
) {
  let print;
  switch (level) {
    case LogLevel.LOG:
      print = console.log;
      break;
    case LogLevel.WARN:
      print = console.warn;
      break;
    case LogLevel.ERROR:
      print = (msg: string) => { throw msg; };
      break;
  }
  const msg = color(`[${header.padEnd(5, ' ')}] ${getString(value)}`);
  if (level === LogLevel.ERROR) throw msg;
  else print(msg);
}

// Warning message
export function warn(value: any) {
  log(value, LogLevel.WARN, 'WARN', chalk.yellow);
}

// Error message
export function err(value: any): never {
  log(value, LogLevel.ERROR, 'ERROR', chalk.red);
  throw value;
}

// To-do message: always throws, so a `todo()`-only body type-checks
export function todo(msg: string = ''): never {
  log(msg, LogLevel.ERROR, 'TODO', chalk.red);
  throw msg;
}

// An unsupported construct: the given code is outside the JS subset
export function unsupported(node: Node, what: string = node.type): never {
  return err(`Unsupported construct: \`${what}\`.`);
}

// Cursor in the code
export class Cursor {
  index: number;
  line: number;
  col: number;
  constructor(code: string, index: number) {
    const lines = code.substring(0, index).split('\n');
    this.index = index;
    this.line = lines.length;
    this.col = index - lines.slice(0, -1).join('\n').length;
  }
  toString = (): string => `${this.line}:${this.col}`;
}

// Range of code
export class Range {
  start: Cursor;
  end: Cursor;
  constructor(start: Cursor, end: Cursor) {
    this.start = start;
    this.end = end;
  }
  static fromCode(code: string, start: number, end: number): Range {
    return new Range(new Cursor(code, start), new Cursor(code, end));
  }
  static fromNode(code: string, node: Node): Range {
    return Range.fromCode(code, node.start, node.end);
  }

  toString = (): string => `${this.start.toString()}-${this.end.toString()}`;
}

// Parse the string into an AST
export function parse(code: string): Program {
  return acorn.parse(code, { ecmaVersion: 2023 });
}

// Get the top-level function declarations of the program.  The *first* one is
// the entry point, and its parameters are the symbolic inputs of the analysis;
// the others may be called by it.
export function getFuncs(program: Program): FunctionDeclaration[] {
  const funcs = program.body.filter(
    (node): node is FunctionDeclaration => node.type === 'FunctionDeclaration'
  );
  if (program.body.length !== funcs.length || funcs.length === 0) {
    err('The target file must consist of function declarations only.');
  }
  return funcs;
}

// Get the names of the parameters of a function
export function getParamNames(func: FunctionDeclaration): string[] {
  return func.params.map((param: Pattern) => {
    if (param.type !== 'Identifier') unsupported(param, 'non-simple parameter');
    return param.name;
  });
}

// --------------------------------------------------------------------------
// Building the instrumented AST
// --------------------------------------------------------------------------

// The name of the runtime object in the instrumented code
export const RUNTIME = '__dse__';

// Parse an expression from its source text
export function createExpr(code: string): Expression {
  return acorn.parseExpressionAt(code, 0, { ecmaVersion: 2023 });
}

// A literal: `createLit('+')` is the expression `'+'`
export function createLit(value: string | number | boolean): Expression {
  const raw = typeof value === 'string' && !/['\\]/.test(value)
    ? `'${value}'`
    : JSON.stringify(value);
  return { type: 'Literal', value, raw, start: -1, end: -1 };
}

// A call to the runtime: `createCall('bin', args)` is `__dse__.bin(...args)`
export function createCall(method: string, args: Expression[]): Expression {
  return {
    type: 'CallExpression',
    callee: createExpr(`${RUNTIME}.${method}`),
    arguments: args,
    optional: false,
    start: -1, end: -1,
  };
}

// `() => <body>`, which delays the evaluation of `body`
export function createArrow(body: Expression): Expression {
  return {
    type: 'ArrowFunctionExpression',
    id: null, params: [], body, expression: true,
    async: false, generator: false, start: -1, end: -1,
  };
}

// `<target> = <value>`
export function createAssign(target: Pattern, value: Expression): Expression {
  return {
    type: 'AssignmentExpression',
    operator: '=', left: target, right: value, start: -1, end: -1,
  };
}
