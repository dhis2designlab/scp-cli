#!/usr/bin/env node

import pathm from "path";
const __file__ = pathm.basename(__filename);

import debugm from "debug";
const debug = debugm(`scp:${__file__}`);
import consola from "consola";
import yargs from "yargs";
import chalk from "chalk";
import boxen from "boxen"; 
((consola as unknown) as Record<string, unknown>)._stdout = process.stderr;
import * as verifyCommand from "./cli-verify";
import * as prVerifyCommand from "./cli-pr-verify";
const greeting = chalk.white.bold('DHIS2-SCP-CLI');
const boxenOptions = {
  padding: 1,
  margin: 1,
  borderStyle: "round",
  borderColor: "magenta",
  backgroundColor: "#000"
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const msgBox = (boxen as any)(greeting, boxenOptions); 

async function main() {
  consola.info(msgBox);
  const middleware = (args: yargs.Arguments<unknown>) => {
    consola.level += args.verbose as number;
    debug(`entry:`, { args, level: consola.level });
  };
  const parser = yargs
    .strict()
    .middleware([middleware])
    .command(verifyCommand)
    .command(prVerifyCommand)
    .help("h")
    .alias("help", "h")
    /*
    .fail((msg, error, yargs) => {
      if ( error ) {
        consola.error(`error =`, error);
        process.exit(1);
      }
      else {
        console.error(msg);
      }
    })
    */
    .option("verbose", {
      alias: "v",
      describe: "increase verbosity",
      count: true,
      default: 0,
    });
  const parsed = parser.argv;
  consola.level += parsed.verbose;
  consola.debug(`verifyCommand.command = ${verifyCommand.command}`);
  consola.debug(`verifyCommand.describe = ${verifyCommand.describe}`);
}

main().catch((error) => {
  consola.error(`error =`, error);
  process.exitCode = 1;
});

