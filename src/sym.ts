import { err } from './helper';

// ------------------------------------------------------------------------- //
// Symbolic expressions
// ------------------------------------------------------------------------- //
// A symbolic expression is the *formula* that describes how a value was
// computed from the symbolic inputs.  It is the `sigma` of the lecture: while
// the concrete semantics computes `2 * 3 = 6`, the symbolic semantics builds
// the term `2 * alpha`.
//
// Only two sorts of values exist in this subset: integers and booleans.

export type UnaryOp = '-' | '!';

export type BinaryOp =
  | '+' | '-' | '*'                    // integer -> integer
  | '<' | '<=' | '>' | '>='            // integer -> boolean
  | '===' | '!==';                     // same sort -> boolean

export type Sym =
  | { type: 'Var'; name: string }
  | { type: 'Num'; value: number }
  | { type: 'Bool'; value: boolean }
  | { type: 'Unary'; op: UnaryOp; sym: Sym }
  | { type: 'Binary'; op: BinaryOp; left: Sym; right: Sym };

// Smart constructors
export const varSym = (name: string): Sym => ({ type: 'Var', name });
export const numSym = (value: number): Sym => ({ type: 'Num', value });
export const boolSym = (value: boolean): Sym => ({ type: 'Bool', value });
export const unarySym = (op: UnaryOp, sym: Sym): Sym =>
  ({ type: 'Unary', op, sym });
export const binarySym = (op: BinaryOp, left: Sym, right: Sym): Sym =>
  ({ type: 'Binary', op, left, right });

// The negation of a symbolic expression, used to flip a branch
export const notSym = (sym: Sym): Sym => unarySym('!', sym);

// Does the symbolic expression depend on any symbolic input?  An expression
// without a `Var` is a constant: a branch on such a condition always goes the
// same way, so there is nothing for the solver to flip.
export function hasVar(sym: Sym): boolean {
  switch (sym.type) {
    case 'Var': return true;
    case 'Num': case 'Bool': return false;
    case 'Unary': return hasVar(sym.sym);
    case 'Binary': return hasVar(sym.left) || hasVar(sym.right);
  }
}

// The string representation of a symbolic expression
export function symToString(sym: Sym): string {
  switch (sym.type) {
    case 'Var': return sym.name;
    case 'Num': return String(sym.value);
    case 'Bool': return String(sym.value);
    case 'Unary': return `${sym.op}${symToString(sym.sym)}`;
    case 'Binary':
      return `(${symToString(sym.left)} ${sym.op} ${symToString(sym.right)})`;
  }
}

// ------------------------------------------------------------------------- //
// Concolic values
// ------------------------------------------------------------------------- //
// A concolic value carries both the *concrete* value that the real execution
// produced and the *symbolic* expression that the symbolic execution built.

// The concrete values of this subset
export type Conc = number | boolean;

export interface Value {
  conc: Conc;
  sym: Sym;
}

// The symbolic literal of a concrete value
export const litSym = (conc: Conc): Sym =>
  typeof conc === 'boolean' ? boolSym(conc) : numSym(conc);

// A value without any symbolic information
export const concrete = (conc: Conc): Value => ({ conc, sym: litSym(conc) });

// A symbolic input
export const input = (name: string, conc: Conc): Value =>
  ({ conc, sym: varSym(name) });

// Forget the symbolic part of a value, keeping its concrete part.
//
// This is the heart of DSE: an operation the solver cannot reason about (the
// `hash` function of the lecture, or `%` here) is replaced by the concrete
// value it produced in *this* execution.  The engine keeps running, but the
// solver can no longer flip a branch that depends on the forgotten part.
export const concretize = (value: Value): Value => concrete(value.conc);

// Interpret a value as a number, failing if it is not one
export function asNum(value: Value): number {
  if (typeof value.conc !== 'number') err(`Not a number: \`${value.conc}\`.`);
  return value.conc;
}

// Interpret a value as a boolean, failing if it is not one.  This subset has
// no truthiness conversion: a condition must already be a boolean.
export function asBool(value: Value): boolean {
  if (typeof value.conc !== 'boolean') err(`Not a boolean: \`${value.conc}\`.`);
  return value.conc;
}

// The string representation of a concrete value
export const concToString = (conc: Conc): string => String(conc);
