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
import axios from "axios";

export const command = "pr-verify [event-json]";
export const describe = "this command will verify a pull request";

export function builder(yargs: yargs.Argv) {
    yargs.positional("event-json", {
        type: "string"
    })
    return yargs;
}


export async function handler(argv: yargs.Arguments) {
    consola.debug(`entry: argv =`, argv);
    try {
        const eventString = await fsm.promises.readFile(argv.eventJson as string);
        const eventData = JSON.parse(eventString.toString());
        pullRequestVerify(eventData);
    } catch (error) {
        consola.error(`ERROR: ${error.toString()}`);
        process.exitCode = 1;
    }

}

export async function pullRequestVerify(eventData: any) {
    consola.debug(`The event payload: ${eventData}`);

    if (!eventData.hasOwnProperty("pull_request")) {
        throw new Error("event-json does not have a pull_request property.");
    }
    consola.info("OK: event is a pull request");
    const pullRequest = eventData["pull_request"];

    if (pullRequest !== undefined && pullRequest.changed_files !== 1) {
        throw new Error("More than one file has been changed.");
    }
    consola.info("OK: pull request only changes one file");

    const filesUrl = `${pullRequest.url}/files`;
    consola.debug({ filesUrl });
    const response = await axios.get(filesUrl);
    const files = response.data;
    consola.debug({ files });

    if (files[0].filename !== constants.whitelistFile) {
        throw new Error(`Changed file ${files[0].filename} instead of ${constants.whitelistFile}`);
    }
    consola.info(`OK: only changed ${constants.whitelistFile}`)
    consola.log(`Checks passed`);
}