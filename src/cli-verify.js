#!/usr/bin/env node

const pathm = require("path");
const __file__ = pathm.basename(__filename);
const consola = require("consola");
const { ESLint } = require("eslint");
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
    }).then((result) => {
        consola.debug(`result =`, result);
        const resolveType = result[0];
        if (resolveType === "close") {
            const [_, code, signal] = result;
            return { code, signal, stdout, stderr, error: undefined };
        } else {
            const [_, error] = result;
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
    const specifiedComponents = [];

    /* Turning linting off for now
    {
        const results = await pspawn("eslint", [packageDir], {stdio: "inherit", shell: true});
        const { code, signal, stdout, stderr, error } = results;
        if ( error || code !== 0 ) {
            errors.push({ text: `Failure when linting package directory ${packageDir}: failed with ${error || code}`});
        }
    }
    */

    componentHandler(packageJson, errors, specifiedComponents);

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


async function componentHandler(packageJson, errors, specifiedComponents) {
    if (packageJson.hasOwnProperty(constants.components)) {
        const componentsList = packageJson[constants.components];
        if (!(componentsList === undefined || componentsList.length == 0)) {
            for (let i = 0; i < componentsList.length; i++) {
                let key = componentsList[i].export;
                specifiedComponents[key] = {
                    name: componentsList[i].name,
                    description: componentsList[i].description
                };
            }
            consola.debug(`Listed components`, specifiedComponents);
        } else {
            // Rather a warning, than an error
            // errors.push({ text: `Components are not listed in package.json` });
            consola.warn(`package.json includes ${constants.components} field, but the list is empty`);
        }
    } else {
        errors.push({ text: `package.json does not include ${constants.components} field` });
    }
}

Object.assign(module.exports, { command, describe, builder, handler });