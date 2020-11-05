#!/usr/bin/env node

import pathm from "path";
import consola from "consola";
// const { ESLint } = require("eslint");
import yargs from "yargs";
import chalk from "chalk";
import fsm from "fs";
const fsmp = fsm.promises;
import * as constants from "./constants";
// import { pspawn } from "./misc";

/* eslint-disable no-prototype-builtins */

export const command = "verify [arg]";
export const describe = "this command will verify the package";

export function builder(yargs: yargs.Argv): yargs.Argv {
    yargs.option("package-dir", {
        alias: "d",
        type: "string"
    })
    return yargs;
}


interface ErrorItem {
    text: string;
}

class ErrorList {
    list: ErrorItem[];
    constructor() {
        this.list = []
    }

    push(text: string, options?: Record<string, unknown>) {
        consola.debug(`Pushing error: ${text}${options || ""}`);
        this.list.push({ text });
    }
}

export interface PackageDetails {
    packageJson: Record<string, unknown>,
    packageDir: string,
    package_: Record<string, unknown>,
}

export async function handler(argv: yargs.Arguments): Promise<void> {
    consola.debug(`entry: argv =`, argv);
    const packageDir: string = argv["package-dir"] as string || "./";
    await verificationHandler(packageDir);
}

export async function verificationHandler(packageDir: string): Promise<void> {
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
    // const package_ = await import(pathm.resolve(`${packageDir}`));
    let package_ = undefined;
    try {
        consola.log(`Will import package path ${packageDir} -> `,pathm.resolve(`${packageDir}`));
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        package_ = require(pathm.resolve(`${packageDir}`));
    } catch ( error ) {
        consola.warn(`Could not import ${packageDir}, probbably it is not a valid commonjs module. Will skip checks for exports.`)
    }

    consola.log("Test package=", package_);

    const packageDetails = {
        packageJson,
        packageDir,
        package_
    };

    consola.debug(`specifiedComponents = `, specifiedComponents);

    if (packageJson.hasOwnProperty("keywords")) {
        consola.log(`Found keywords in package.json`);
        const keywords = packageJson["keywords"];
        if (keywords.indexOf(constants.keyword) >= 0) {
            consola.log(`Found dhis2 keyword`);
        } else {
            errors.push(`keyword ${constants.keyword} is not specified in package.json`);
        }
    } else {
        errors.push(`package.json does not have any keywords, and needs ${constants.keyword}`);
    }

    try {
        componentHandler(packageDetails, errors, specifiedComponents);
    } catch (error) {
        errors.push(`keyword ${constants.keyword} is not specified in package.json`);
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
    dhis2Version?: Array<string>;
}
export interface SpecifiedComponents {
    [key: string]: SpecifiedComponent;
}

function isArrayOfStrings(value: unknown): boolean {
    return Array.isArray(value) && value.every(item => typeof item === "string");
}

export async function componentHandler(packageDetails: PackageDetails, errors: ErrorList, specifiedComponents: SpecifiedComponents): Promise<void> {
    const { package_, packageJson } = packageDetails;
    if (!packageJson.hasOwnProperty(constants.dhis2Scp)) {
        errors.push(`package.json does not include ${constants.dhis2Scp} field`);
        return;
    }
    const dhis2Scp = packageJson[constants.dhis2Scp] as Record<string, unknown>;
    if (!dhis2Scp.hasOwnProperty(constants.components)) {
        errors.push(`package.json/${constants.dhis2Scp} does not include ${constants.components} field`);
        return;
    }
    if (!dhis2Scp.hasOwnProperty(constants.framework)) {
        errors.push(`package.json/${constants.dhis2Scp} does not include ${constants.framework}`);
    } else if (typeof dhis2Scp[constants.framework] !== "string") {
        errors.push(`package.json/${constants.dhis2Scp} includes ${constants.framework} but it is not a string`);
    } else if (["react", "angular"].indexOf((dhis2Scp[constants.framework] as string).toLowerCase()) < 0) {
        errors.push(`package.json/${constants.dhis2Scp} includes ${constants.framework} but it is not "react" or "angular"`)
    }
    const componentsList = dhis2Scp[constants.components];
    if (!Array.isArray(componentsList)) {
        errors.push(`package.json/${constants.dhis2Scp} includes ${constants.components} but it is not an array`);
        return;
    }
    if (componentsList.length == 0) {
        errors.push(`package.json/${constants.dhis2Scp} includes ${constants.components} field, but the list is empty`);
        return;
    }
    for (let i = 0; i < componentsList.length; i++) {
        try {
            const componentsListItem = componentsList[i];

            if (componentsListItem.hasOwnProperty("dhis2Version") && !(isArrayOfStrings(componentsListItem["dhis2Version"]))) {
                errors.push(`property "dhis2Version" must be an array of strings`);
                continue;
            }

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

            const { export: key, name, description, dhis2Version } = componentsListItem;
            if (package_ != undefined) {
                if (!package_.hasOwnProperty(key)) {
                    errors.push(`package.json ${constants.components}[${i}] specified export "${key}" is not exported from the package`);
                    continue;
                }

                consola.debug(`Found export "${key}" specified in ${constants.components}[${i}]: `, { name, description, dhis2Version });
            } else {
                consola.warn(`Assuming that the exported component ${key} exists since package was not imported`);
            }
            specifiedComponents[key] = { name, description, dhis2Version };
        } catch (error) {
            errors.push(`problem when processing package.json ${constants.components}[${i}]: ${error}`);
        }
    }
}


// TODO FIXME
// module.exports = componentHandler;
// Object.assign(module.exports, { command, describe, builder, handler, componentHandler });

// export { command, describe, builder, handler, componentHandler };