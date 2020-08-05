#!/usr/bin/env node

const pathm = require("path");
const __file__ = pathm.basename(__filename);
const consola = require("consola");
const {ESLint} = require("eslint");
const yargs = require("yargs");
const debugm = require("debug");
const chalk = require("chalk");
const debug = debugm(`scp:${__file__}`);
const fsm = require("fs");
const fsmp = fsm.promises;
const constants = require("./constants");
const utilm = require("util");
const cpm = require("child_process");

const cpmp = {
    exec: utilm.promisify(cpm.exec),
}

const { options } = require("yargs");

const command = "verify [arg]";
const describe = "this command will verify the package";

function builder(yargs) {
    yargs.option("package-dir", {
        alias: "d"
    })
    return yargs;
}

function pspawn(...args) {
    let stdout = undefined;
    let stderr = undefined;
    consola.debug(`pspawn: args = `, args);
    const cp = cpm.spawn(...args);
    cp.stdout && cp.stdout.on("data", (data) => { stdout = (stdout || "") + data; });
    cp.stderr && cp.stderr.on("data", (data) => { stderr = (stderr || "") + data; });
    return new Promise((resolve, reject) => {
        cp.on("close", (...args) => {
            resolve(["close", ...args])
        })
        cp.on("error", (...args) => {
            consola.debug(`cp error, args = `, args);
            resolve(["error", ...args])
        })
    }).then((result)=>{
        consola.debug(`result =`, result);
        const resolveType = result[0];
        if ( resolveType === "close" ) {
            const [ _, code, signal ] = result;
            return { code, signal, stdout, stderr, error: undefined };
        } else {
            const [ _, error ] = result; 
            return { code: undefined, signal: undefined, stdout, stderr, error };
        }
    })
}

async function handler(argv) {
    consola.debug(`entry: argv =`, argv);
    const packageDir = argv["package-dir"] || ".";
    const packageJsonFile = pathm.join(packageDir, "package.json");
    consola.debug(`packageJsonFile = ${packageJsonFile}`);
    const packageJsonString = await fsmp.readFile(packageJsonFile);
    const packageJson = JSON.parse(packageJsonString);
    consola.debug(`packageJson =`, packageJson);
    const errors = [];

    {
        const results = await pspawn("eslint", [packageDir], {stdio: "inherit", shell: true});
        const { code, signal, stdout, stderr, error } = results;
        if ( error || code !== 0 ) {
            consola.error(`Failure when linting package directory ${packageDir}: failed with ${error || code}`);
        }
    }

    if (packageJson.hasOwnProperty("keywords")) {
        consola.debug(`Found keywords in package.json`);
        const keywords = packageJson["keywords"];
        if (keywords.indexOf(constants.keyword) >= 0) {
            consola.debug(`Found dhis2 keyword`);
        } else {
            errors.push({ text: `keyword ${constants.keyword} is not specified in package.json` });
        }
    } else {
        errors.push({ text: `package.json does not have any keywords, and needs ${constants.keyword}` });
    }
    if (errors.length) {
        for (const error of errors) {
            consola.error(chalk.red(`Found error: ${error.text}`));
        }
        process.exitCode = 1;
    } else {
        consola.info(chalk.green(`Verification passed`));
        process.exitCode = 0;
    }
}

Object.assign(module.exports, { command, describe, builder, handler});