import { Range } from './helper';
import { Conc, Sym, notSym, symToString } from './sym';

// ------------------------------------------------------------------------- //
// Branch decisions and paths
// ------------------------------------------------------------------------- //

// One branch decision of an execution: the condition, symbolically, together
// with the direction the concrete execution took.
export interface Decision {
  range: Range;   // the source range of the condition
  sym: Sym;       // the condition, symbolically
  taken: boolean; // the direction of this execution
}

// A path: the sequence of decisions of one execution
export type Path = Decision[];

// The result of one concolic execution
export interface RunResult {
  path: Path;               // the branch decisions of this execution
  ret: Conc | undefined;    // the returned concrete value
  bounded: boolean;         // the execution was cut off by a bound
}

// Thrown when an execution exceeds `MAX_DEPTH` branch decisions
export class DepthExceeded { }

// Thrown when an execution exceeds `MAX_STEPS` steps
export class StepsExceeded { }

// The signature of a path, used to compare and to report paths
export function pathToString(path: Path): string {
  if (path.length === 0) return '(empty)';
  return path.map(d => `${d.range}@${d.taken ? 'T' : 'F'}`).join(', ');
}

// The path condition of a path: a decision taken to the false side contributes
// the negation of its condition.
export function pathCond(path: Path): Sym[] {
  return path.map(d => (d.taken ? d.sym : notSym(d.sym)));
}

// The path condition, as a readable formula
export function pathCondToString(path: Path): string {
  if (path.length === 0) return 'true';
  return pathCond(path).map(symToString).join(' && ');
}

// Flip one decision of a path, giving the path condition of the other side of
// that branch.
export function flip(path: Path, index: number): Path {
  return path
    .slice(0, index + 1)
    .map((d, i) => (i === index ? { ...d, taken: !d.taken } : d));
}
