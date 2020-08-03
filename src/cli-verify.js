#!/usr/bin/env node

const pathm = require("path");
const __file__ = pathm.basename(__filename);
const consola = require("consola");
const yargs = require("yargs");
const debugm = require("debug");
const debug = debugm(`scp:${__file__}`);
const fsm = require("fs");
const fsmp = fsm.promises;
const constants = require("./constants");

const command = "verify [arg]";
const describe = "this command will verify the package";

function builder(yargs) {
    yargs.option("package-dir", {
        alias: "d"
    })
    return yargs;
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
            consola.error(`Found error: ${error.text}`);
        }
        process.exitCode = 1;
    } else {
        consola.info(`Verification passed`);
        process.exitCode = 0;
    }
}

Object.assign(module.exports, { command, describe, builder, handler });