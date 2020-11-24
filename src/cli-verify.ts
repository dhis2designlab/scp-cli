#!/usr/bin/env node

import pathm from "path";
import consola from "consola";
// const { ESLint } = require("eslint");
import yargs from "yargs";
import chalk from "chalk";
import fsm from "fs";
const fsmp = fsm.promises;
import * as constants from "./constants";
import * as miscm from "./misc";
import semver from "semver"

/* eslint-disable no-prototype-builtins */

export const command = "verify [arg]";
export const describe = "this command will verify the package";

var module: boolean = true; //keep track of whether or not the package is an npm module

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
        consola.debug(`Pushing error: ${text} with options ${options}`);
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
    const warnings = new ErrorList();
    const successes =  new ErrorList();
    const specifiedComponents: SpecifiedComponents = {};

    let package_ = undefined;
    try {
        let absPath = pathm.resolve(`${packageDir}`);
        consola.info(`Will import package path ${packageDir} -> `, absPath);
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        package_ = require(absPath);
        consola.debug("Test package: ", package_);
    } catch (error) {
        module = false;
        consola.warn(`Could not import ${packageDir}, probably it is not a valid commonjs module. Will skip checks for exports.`)
    }



    const packageDetails = {
        packageJson,
        packageDir,
        package_
    };

    consola.debug(`specifiedComponents = `, specifiedComponents);

    if (packageJson.hasOwnProperty("keywords")) {
        consola.info(chalk.green(`Found keywords in package.json`));
        const keywords = packageJson["keywords"];
        if (keywords.indexOf(constants.keyword) >= 0) {
            consola.info(chalk.green(`Found ${constants.keyword} keyword in package.json`));
        } else {
            errors.push(`keyword ${constants.keyword} is not specified in package.json`);
        }
    } else {
        errors.push(`package.json does not have any keywords, and needs ${constants.keyword}`);
    }

    try {
        await componentHandler(packageDetails, errors, specifiedComponents);
    } catch (error) {
        errors.push(`keyword ${constants.keyword} is not specified in package.json`);
    }

    try {
        await packageLinter(packageDir);
    } catch (error) {
        errors.push(`Failure when linting package directory ${packageDir}: failed with ${error}`);
    }

    if (module) {
        try {
            await npmAuditor();
        } catch (error) {
            errors.push(`Failure when auditing package directory ${packageDir}: failed with ${error}`);
        }
    } else {
        consola.warn(`The package at ${packageDir} does not appear to be a valid commonjs module. Skipping npm audit`)
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
    
   // Executes all promises in parallell and waits upon completion of all to write results.
   /*
   const promises = [
       componentHandler(packageDetails, errors, specifiedComponents),
       packageLinter(packageDir, warnings, successes),
       npmAuditor(warnings, successes, module)
    ]

    Promise.all(promises).then(() => {
        if (successes.list.length) {
            for (const success of successes.list) {
                consola.info(chalk.green(`${success.text}`));
            }
        }
    
        if (warnings.list.length) {
            for (const warning of warnings.list) {
                consola.info(chalk.yellow(`${warning.text}`));
            }
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
    }).catch((err) => {
        consola.error(chalk.red(err.message)); //all should resolve atm.
    })

    */
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
    //consola.debug(`\nDHIS2SCP: ` + JSON.stringify(dhis2Scp) +`\n`);
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

            if (componentsListItem.hasOwnProperty(constants.version)) {
                if (!isArrayOfStrings(componentsListItem[constants.version])) {
                    errors.push(`property ${constants.version} must be an array of strings`);
                    continue;
                } else {
                    const versions = componentsListItem[constants.version];
                    consola.debug(`DHIS2 version(s) found: ${versions.toString()} on component ${componentsListItem.name}`);
                    versionValidate(versions);
                }
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
            consola.debug(`\npackage_ ` + JSON.stringify(package_) + `\n`);
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

export async function versionValidate(versions:string[]) :Promise<void> {
    for (let i = 0; i< versions.length; i++) {
        if (semver.valid(versions[i]) === null ) throw new Error(`Invalid dhis2 version: ${versions[i]}`);
    }
    consola.debug(`DHIS2 version(s): ${versions.toString()} validated`);
}

export async function packageLinter(packageDir: string): Promise<void> {
    //Some potential default values, almost impossible to realize
    /*
        "--ignore-pattern 'node_modules/'", 
        "--ignore-pattern 'dist/'",
        "--parser-options=ecmaVersion:6",
        "--env es6",
        "--parser-options=sourceType:module",
        "--fix-dry-run",
    */
    const cmd = "eslint";
    const args = [ packageDir ];
    consola.debug(`running ${cmd} ${args}`);
    const results = await miscm.pspawn(cmd, args, {stdio: "inherit", shell: true});
    const { code, signal, stdout, stderr, error } = results; 
    if (error || code === 2 ) {
        consola.warn(`Failure when linting package directory ${packageDir}: failed with code ${error || code}.`); //Verification still passes
    } else if (code !== 0) {
        //assumes code 1, only one left
        consola.warn(`Linting of package directory ${packageDir} completed successfully, but atleast 1 error was found. Exit code ${code}`);
    } else {
        consola.info(chalk.green(`eslint successfully completed.`));
    }
}

export async function npmAuditor(): Promise<void> {
    const cmd = "npm";
    const args = ["audit", "--parseable"];
    consola.debug(`running ${cmd} ${args}`);
    const results = await miscm.pspawn(cmd, args, {stdio: "inherit", shell: true});
    const { code, signal, stdout, stderr, error } = results; 
    if (error) {
        consola.warn(`Failure when auditing package. Failed with ${error}`)
    } else if (code !== 0) {
        consola.warn(`Some vulnerabilites were found during the auditing of your package. Consider 'npm audit fix'. Exit code ${code}.`);
    } else {
        consola.info(chalk.green(`npm audit successfully completed.`));
    }
}
