#!/usr/bin/env node

import pathm from "path";
const __file__ = pathm.basename(__filename);
const consola = require("consola");
const { ESLint } = require("eslint");
import yargs from "yargs";
const debugm = require("debug");
const chalk = require("chalk");
const debug = debugm(`scp:${__file__}`);
import fsm from "fs";
const fsmp = fsm.promises;
import * as constants from "./constants";
import utilm from "util";
import cpm from "child_process";



const cpmp = {
    exec: utilm.promisify(cpm.exec),
}

const { options } = require("yargs");

export const command = "verify [arg]";
export const describe = "this command will verify the package";

function builder(yargs: yargs.Argv) {
    yargs.option("package-dir", {
        alias: "d"
    })
    return yargs;
}

function pspawn(...args: string[]) {
    let stdout: string | undefined = undefined;
    let stderr: string | undefined = undefined;
    consola.debug(`pspawn: args = `, args);
    const cp: any = (cpm.spawn as any)(...args);
    cp.stdout && cp.stdout.on("data", (data: any) => { stdout = (stdout || "") + data; });
    cp.stderr && cp.stderr.on("data", (data: any) => { stderr = (stderr || "") + data; });
    return new Promise((resolve, reject) => {
        cp.on("close", (...args: string[]) => {
            resolve(["close", ...args])
        })
        cp.on("error", (...args: string[]) => {
            consola.debug(`cp error, args = `, args);
            resolve(["error", ...args])
        })
    }).then((result: any) => {
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

interface ErrorItem {
    text: string;
}

class ErrorList {
    list: ErrorItem[];
    constructor() {
        this.list = []
    }

    push(text: string, options?: {}) {
        consola.debug(`Pushing error: ${text}`);
        this.list.push({ text });
    }
}

export interface PackageDetails {
    packageJson: any,
    packageDir: string,
    package_: any,
};

export async function handler(argv: yargs.Arguments) {
    consola.debug(`entry: argv =`, argv);
    const packageDir: string = argv["package-dir"] as string || "./";
    const packageJsonFile = pathm.join(packageDir, "package.json");
    consola.debug(`packageJsonFile = ${packageJsonFile}`);
    const packageJsonString = await fsmp.readFile(packageJsonFile);
    const packageJson = JSON.parse(packageJsonString.toString());
    consola.debug(`packageJson =`, packageJson);
    const errors = new ErrorList();
    const specifiedComponents: SpecifiedComponents = {};

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

export interface SpecifiedComponent {
    name: string;
    description: string;
};
export interface SpecifiedComponents {
    [key: string]: SpecifiedComponent;
};

export async function componentHandler(packageDetails: PackageDetails, errors: ErrorList, specifiedComponents: SpecifiedComponents) {
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

// TODO FIXME
// module.exports = componentHandler;
// Object.assign(module.exports, { command, describe, builder, handler, componentHandler });

// export { command, describe, builder, handler, componentHandler };