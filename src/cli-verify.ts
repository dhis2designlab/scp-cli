#!/usr/bin/env node

import pathm from "path";
const __file__ = pathm.basename(__filename);
const consola = require("consola");
// const { ESLint } = require("eslint");
import yargs from "yargs";
const debugm = require("debug");
const chalk = require("chalk");
const debug = debugm(`scp:${__file__}`);
import fsm from "fs";
const fsmp = fsm.promises;
import * as constants from "./constants";
import utilm from "util";
import cpm from "child_process";
import { pspawn } from "./misc";


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

    consola.debug(`specifiedComponents = `, specifiedComponents);

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
};

export interface SpecifiedComponent {
    name: string;
    description: string;
    dhis2Version?: Array<string>;
};
export interface SpecifiedComponents {
    [key: string]: SpecifiedComponent;
};

function isArrayOfStrings(value: any) : boolean {
    return Array.isArray(value) && value.every(item => typeof item === "string");
}

export async function componentHandler(packageDetails: PackageDetails, errors: ErrorList, specifiedComponents: SpecifiedComponents) {
    const { package_, packageJson, packageDir } = packageDetails;
    if (!packageJson.hasOwnProperty(constants.dhis2Scp)) {
        errors.push(`package.json does not include ${constants.dhis2Scp} field`);
        return;
    }
    const dhis2Scp = packageJson[constants.dhis2Scp];
    if (!dhis2Scp.hasOwnProperty(constants.components)) {
        errors.push(`package.json/${constants.dhis2Scp} does not include ${constants.components} field`);
        return;
    }
    if (!dhis2Scp.hasOwnProperty(constants.framework)) {
        errors.push(`package.json/${constants.dhis2Scp} does not include ${constants.framework}`);
    } else if (typeof dhis2Scp[constants.framework] !== "string") {
        errors.push(`package.json/${constants.dhis2Scp} includes ${constants.framework} but it is not a string`);
    } else if (["react", "angular"].indexOf(dhis2Scp[constants.framework].toLowerCase()) < 0) {
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
            let componentsListItem = componentsList[i];

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
            if (!package_.hasOwnProperty(key)) {
                errors.push(`package.json ${constants.components}[${i}] specified export "${key}" is not exported from the package`);
                continue;
            }

            consola.debug(`Found export "${key}" specified in ${constants.components}[${i}]: `, { name, description, dhis2Version});
            specifiedComponents[key] = { name, description, dhis2Version};
        } catch (error) {
            errors.push(`problem when processing package.json ${constants.components}[${i}]: ${error}`);
        }
    }
}


// TODO FIXME
// module.exports = componentHandler;
// Object.assign(module.exports, { command, describe, builder, handler, componentHandler });

// export { command, describe, builder, handler, componentHandler };