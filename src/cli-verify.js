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

class ErrorList {

    constructor() {
        this.list = []
    }

    push(text, options) {
        consola.debug(`Pushing error: ${text}`);
        this.list.push({ text });
    }
}

async function handler(argv) {
    consola.debug(`entry: argv =`, argv);
    const packageDir = argv["package-dir"] || "./";
    const packageJsonFile = pathm.join(packageDir, "package.json");
    consola.debug(`packageJsonFile = ${packageJsonFile}`);
    const packageJsonString = await fsmp.readFile(packageJsonFile);
    const packageJson = JSON.parse(packageJsonString);
    consola.debug(`packageJson =`, packageJson);
    const errors = new ErrorList();
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
    const package_ = require(pathm.resolve(packageDir));

    const packageDetails = {
        packageJson,
        packageDir,
        package_
    };
    try {
        componentHandler(packageDetails, errors, specifiedComponents);
    } catch (error) {
        errors.push(`keyword ${constants.keyword} is not specified in package.json`);
    }



    if (packageJson.hasOwnProperty("keywords")) {
        consola.debug(`Found keywords in package.json`);
        const keywords = packageJson["keywords"];
        if (keywords.indexOf(constants.keyword) >= 0) {
            consola.debug(`Found dhis2 keyword`);
        } else {
            errors.push(`keyword ${constants.keyword} is not specified in package.json`);
        }
    } else {
        errors.push(`package.json does not have any keywords, and needs ${constants.keyword}`);
    }
    if (errors.list.length) {
        for (const error of errors.list) {
            consola.error(chalk.red(`Found error: ${error.text}`));
        }
        process.exitCode = 1;
    } else {
        consola.info(chalk.green(`Verification passed`));
        process.exitCode = 0;
    }
}


async function componentHandler(packageDetails, errors, specifiedComponents) {
    const { package_, packageJson, packageDir } = packageDetails;
    if (packageJson.hasOwnProperty(constants.components)) {
        const componentsList = packageJson[constants.components];
        if (!(componentsList === undefined || componentsList.length == 0)) {
            for (let i = 0; i < componentsList.length; i++) {
                try {
                    let componentsListItem = componentsList[i];
                    for (const key of ["export", "name", "description"]) {
                        if (!componentsListItem.hasOwnProperty(key)) {
                            errors.push(`one of the components does not have the "${key}" property`);
                            continue;
                        }
                        if (componentsListItem[key] === "") {
                            errors.push(`property "${key}" is empty`);
                            continue;
                        }
                        if (typeof (componentsListItem[key]) !== "string") {
                            errors.push(`property "${key}" must be a string`);
                            continue;
                        }
                    }
                    const { export: key, name, description } = componentsListItem;
                    if (!package_.hasOwnProperty(key)) {
                        errors.push(`package.json ${constants.components}[${i}] specified export "${key}" is not exported from the package`);
                        continue;
                    }
                    consola.debug(`Found export "${key}" specified in ${constants.components}[${i}]: `, { name, description });
                    specifiedComponents[key] = { name, description };
                } catch (error) {
                    errors.push(`problem when processing package.json ${constants.components}[${i}]: ${error}`);
                }
            }
        } else {
            errors.push(`package.json includes ${constants.components} field, but the list is empty`);
        }
    } else {
        errors.push(`package.json does not include ${constants.components} field`);
    }
}


module.exports = componentHandler;
Object.assign(module.exports, { command, describe, builder, handler});
