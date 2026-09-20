import assert from 'assert';
import fs from 'fs';

import { generate } from 'astring';

import { MAX_DEPTH, RUNTIME, parse, readFile, readJSON } from '../src/helper';
import { DSE, Instrumenter, Runtime } from '../src/dse';
import { pathToString } from '../src/path';
import { closeSolver, initSolver } from '../src/solver';

// Expected result of the exploration, stored in `example/<name>.expected.json`.
// A path is identified by its sequence of branch decisions, so the concrete
// inputs the solver happens to produce do not matter.
interface Expected {
  run: {                 // one execution on the initial input
    path: string;        // the signature of the path it took
    ret: string;         // the value it returned
  };
  paths: string[];       // the signature of every feasible path
  infeasible: string[];  // the signature of every infeasible path condition
}

// Every `example/<name>.js` that has an input file and an expected file
const names = fs
  .readdirSync('example')
  .filter(f => f.endsWith('.js') && !f.endsWith('.instrumented.js'))
  .map(f => f.slice(0, -3))
  .filter(n => fs.existsSync(`example/${n}.json`))
  .filter(n => fs.existsSync(`example/${n}.expected.json`))
  .sort();

// Explore each example once
const cache: { [name: string]: DSE } = {};
async function getDSE(name: string): Promise<DSE> {
  if (cache[name]) return cache[name];
  const code = readFile(`example/${name}.js`);
  const input = readJSON(`example/${name}.json`);
  const engine = new DSE(code, input);
  await engine.explore();
  return cache[name] = engine;
}

function check(name: string, kind: keyof Expected, what: string) {
  it(`should find the correct ${what}`, async () => {
    try {
      const engine = await getDSE(name);
      const expected: Expected = readJSON(`example/${name}.expected.json`);
      const actual = kind === 'paths'
        ? engine.paths.map(p => pathToString(p.path))
        : [...engine.infeasible];
      assert.equal(actual.length, expected[kind].length, `number of ${what}`);
      assert.deepEqual([...actual].sort(), [...expected[kind]].sort(), what);
    } catch (e) {
      if (typeof e === 'string') assert.fail(e);
      else throw e;
    }
  });
}

// The instrumented code of every example, compared with
// `example/<name>.instrumented.js`.  These tests need the instrumenter only,
// so they are the very first ones to pass.
//
// The two programs are compared as ASTs, not as text: the whitespace, the
// quotes of a string literal, and the *numbering* of the branch ids do not
// matter.  The ids are renumbered in the order of their first appearance, so
// that an instrumenter which issues them in another order still passes as
// long as it puts every `br`, `and` and `or` at the same place.
const BRANCH_METHODS = ['br', 'and', 'or'];
function normalizeCode(code: string): string {
  const ids = new Map<number, number>();
  const walk = (node: any): void => {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node === null || typeof node !== 'object') return;
    delete node.start;
    delete node.end;
    delete node.raw;
    if (
      node.type === 'CallExpression' &&
      node.callee.type === 'MemberExpression' &&
      node.callee.object.type === 'Identifier' &&
      node.callee.object.name === RUNTIME &&
      BRANCH_METHODS.includes(node.callee.property.name) &&
      node.arguments.length > 0 &&
      node.arguments[0].type === 'Literal' &&
      typeof node.arguments[0].value === 'number'
    ) {
      const id = node.arguments[0].value;
      if (!ids.has(id)) ids.set(id, ids.size);
      node.arguments[0] = { type: 'Literal', value: ids.get(id) };
    }
    for (const key of Object.keys(node)) walk(node[key]);
  };
  const program = parse(code);
  walk(program);
  return generate(program);
}

describe('instrument', () => {
  for (const name of names) {
    it(`should instrument ${name}.js correctly`, () => {
      try {
        const code = readFile(`example/${name}.js`);
        const expected = readFile(`example/${name}.instrumented.js`);
        const actual = new Instrumenter(code).instrument();
        assert.equal(
          normalizeCode(actual), normalizeCode(expected), 'instrumented code'
        );
      } catch (e) {
        if (typeof e === 'string') assert.fail(e);
        else throw e;
      }
    });
  }
});

// One concolic execution of every example on its initial input.  These tests
// need the instrumenter and the runtime, but neither the solver nor the
// exploration, so they pass right after the `instrument` tests.
describe('run', () => {
  for (const name of names) {
    it(`should run ${name}.js along the correct path`, () => {
      try {
        const code = readFile(`example/${name}.js`);
        const input = readJSON(`example/${name}.json`);
        const expected: Expected = readJSON(`example/${name}.expected.json`);
        const { path, ret } = new Runtime(code).run(input);
        assert.equal(pathToString(path), expected.run.path, 'path');
        assert.equal(String(ret), expected.run.ret, 'returned value');
      } catch (e) {
        if (typeof e === 'string') assert.fail(e);
        else throw e;
      }
    });
  }
});

describe('dse', () => {
  before(async () => { await initSolver(); });
  after(() => { closeSolver(); });

  for (const name of names) {
    describe(`${name}.js`, () => {
      check(name, 'paths', 'paths');
      check(name, 'infeasible', 'infeasible path conditions');
    });
  }
});

// The bounds.  `example/bounded.js` loops as long as its input allows, so one
// of its executions is cut off after `MAX_DEPTH` decisions: `br` throws
// `DepthExceeded`, and the path is reported as bounded.  `example/forever.js`
// enters a `for (;;)` whose condition is never symbolic, so the depth bound
// never applies: it is cut off after `MAX_STEPS` steps by `StepsExceeded`.
describe('bounds', () => {
  it('should cut off an execution at the depth bound', async () => {
    try {
      const engine = await getDSE('bounded');
      const bounded = engine.paths.filter(info => info.bounded);
      assert.equal(bounded.length, 1, 'number of bounded paths');
      assert.equal(
        bounded[0].path.length, MAX_DEPTH,
        'decisions of the bounded path'
      );
      assert.equal(bounded[0].ret, undefined, 'the execution did not return');
    } catch (e) {
      if (typeof e === 'string') assert.fail(e);
      else throw e;
    }
  });

  it('should cut off an execution at the steps bound', async () => {
    try {
      const engine = await getDSE('forever');
      const bounded = engine.paths.filter(info => info.bounded);
      assert.equal(bounded.length, 1, 'number of bounded paths');
      assert.equal(
        pathToString(bounded[0].path), '3:7-3:12@T',
        'the path of the bounded execution'
      );
      assert.equal(bounded[0].ret, undefined, 'the execution did not return');
    } catch (e) {
      if (typeof e === 'string') assert.fail(e);
      else throw e;
    }
  });
});

// The printed report.  The generated inputs and the returned values are
// stripped before the comparison, so only the format and the paths are
// checked -- not which satisfying input the solver returned.
function normalizeReport(report: string): string[] {
  return report
    .split('\n')
    .map(line => line.replace(/ -- .*$/, ''))
    .map(line => line.replace(/^(\s+[*~x] )\d+: /, '$1'))
    .sort();
}

describe('report', () => {
  it('should print the report in the documented format', async () => {
    try {
      const engine = await getDSE('simple');
      const expected = [
        'Paths: 2',
        '      * 0: 3:7-3:14@F',
        '      * 1: 3:7-3:14@T, 5:9-5:14@F',
        'Infeasible: 1',
        '      x 0: 3:7-3:14@T, 5:9-5:14@T',
      ].join('\n');
      assert.deepEqual(
        normalizeReport(engine.toString(true)),
        normalizeReport(expected)
      );
    } catch (e) {
      if (typeof e === 'string') assert.fail(e);
      else throw e;
    }
  });

  it('should mark a path cut off by a bound with `~`', async () => {
    try {
      const engine = await getDSE('forever');
      const expected = [
        'Paths: 2',
        '      * 0: 3:7-3:12@F',
        '      ~ 1: 3:7-3:12@T',
        'Infeasible: 0',
      ].join('\n');
      assert.deepEqual(
        normalizeReport(engine.toString(true)),
        normalizeReport(expected)
      );
    } catch (e) {
      if (typeof e === 'string') assert.fail(e);
      else throw e;
    }
  });
});
