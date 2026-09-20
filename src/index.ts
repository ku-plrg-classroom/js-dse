import {
  scriptName,
  log,
  err,
  getArgs,
  readFile,
  readJSON,
} from './helper';

import yargs from 'yargs';

import { Conc } from './sym';
import { DSE, Instrumenter, Runtime } from './dse';
import { pathCondToString, pathToString } from './path';
import { closeSolver, initSolver } from './solver';

// Read the target file and the initial input
const readTarget = (cmd: string, argv: any): [string, Conc[]] => {
  const [ targetPath, inputPath ] = getArgs(cmd, argv, 2);

  const code = readFile(targetPath);
  log(`The target file is \`${targetPath}\`.`);

  const input = readJSON(inputPath);
  if (!Array.isArray(input)) err('The input must be an array.');
  log(`The input file is \`${inputPath}\`.`);

  return [code, input];
}

// Instrument the target JS file
const instrument = async (argv: any) => {
  const [ targetPath ] = getArgs('instrument', argv, 1);

  log('Instrumenting the target JS file...');
  const code = readFile(targetPath);
  log(`The target file is \`${targetPath}\`.`);

  console.log(new Instrumenter(code).instrument());
}

// Run the target function once with the given input
const run = async (argv: any) => {
  log('Running the target function with the given input...');
  const [ code, input ] = readTarget('run', argv);

  const { path, ret, bounded } = new Runtime(code).run(input);

  console.log(`Path: ${pathToString(path)}`);
  console.log(`Path condition: ${pathCondToString(path)}`);
  console.log(`Return: ${String(ret)}`);
  if (bounded) console.log(`(the execution was cut off at the depth bound)`);
}

// Explore the target function by dynamic symbolic execution
const dse = async (argv: any) => {
  log('Exploring the target function...');
  const [ code, input ] = readTarget('dse', argv);

  const engine = new DSE(code, input);
  await initSolver();
  await engine.explore();

  console.log(engine.toString(/* showDetail */ true));
}

// Parse the command-line arguments
let reported = false;
(async () => {
  try {
    await yargs(process.argv.slice(2))
      .scriptName(scriptName)
      .locale('en')   // yargs would otherwise follow the system locale (LANG)
      .usage('Usage: $0 <command> [options]')
      .command('instrument', 'Instrument the target JS file', () => {}, instrument)
      .example('$0 instrument target.js', 'Instrument the target JS file')
      .command('run', 'Run the target function once', () => {}, run)
      .example('$0 run target.js input.json', 'Run the target function once')
      .command('dse', 'Explore the target function', () => {}, dse)
      .example('$0 dse target.js input.json', 'Explore the target function')
      .demandCommand(1, `You need a command to run \`${scriptName}\`.`)
      // Report an error of a command without the usage message
      .fail((msg: string, e: any, y: any) => {
        if (e === undefined || e === null) console.error(`${y.help()}\n\n${msg}`);
        else if (typeof e === 'string') console.error(e);
        else throw e;
        reported = true;
        process.exitCode = 1;
      })
      .parseAsync();
  } catch (e) {
    if (typeof e !== 'string') throw e;
    else if (!reported) console.error(e);
    process.exitCode = 1;
  } finally {
    closeSolver();
  }
})();
