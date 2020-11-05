#!/usr/bin/env node

import consola from "consola";
// const { ESLint } = require("eslint");
import yargs from "yargs";

/*
import debugm from "debug";
const debug = debugm(`scp:${__file__}`);
*/

import * as constants from "./constants";
import process from "process";
import fetch from "node-fetch";
import simpleGit from "simple-git";
import { verificationHandler } from "./cli-verify"
import fsm from "fs";

import * as miscm from "./misc";

import rimraf from "rimraf";
const rimrafp = (path: string, options: rimraf.Options = {}) => {
    return new Promise((resolve, reject) => {
        rimraf(path, options, (error) => {
            if (error) reject(error);
            resolve();
        })
    })
}

export interface PackageData {
    identifier: string,
    version: string,
}

export const command = "pr-verify [event-json]";
export const describe = "this command will verify a pull request";

export function builder(yargs: yargs.Argv): yargs.Argv {
    yargs
        .positional("event-json", {
            type: "string"
        })
        .option("fake-package-data", {
            type: "string",
            default: null,
        })
        .option("repo-dir", {
            alias: "d",
            type: "string"
        })
    return yargs;
}

interface Globals {
    repoDir: string;
}

export const globals: Globals = {
    repoDir: "./repo-dir"
};

export async function handler(argv: yargs.Arguments): Promise<void> {
    consola.debug(`entry: argv =`, argv);
    if (argv.repoDir != null) {
        globals.repoDir = argv.repoDir as string;
    }
    try {

        if (argv.fakePackageData != null) {
            const [ identifier, version ] = (argv.fakePackageData as string).split(",");
            await verifyPackageIdentifier({identifier, version});
        } else {
            const eventString = await fsm.promises.readFile(argv.eventJson as string);
            const eventData = JSON.parse(eventString.toString());
            await pullRequestVerify(eventData);
        }
    } catch (error) {
        consola.error(`ERROR: ${error.toString()}`);
        process.exitCode = 1;
    }

}

/* eslint-disable no-prototype-builtins */

export async function pullRequestVerify(eventData: Record<string, unknown>): Promise<void> {
    consola.debug(`The event payload: ${eventData}`);

    if (!eventData.hasOwnProperty("pull_request")) {
        throw new Error("event-json does not have a pull_request property.");
    }
    consola.info("OK: event is a pull request");
    const pullRequest = eventData["pull_request"] as Record<string, unknown>;

    if (pullRequest !== undefined && pullRequest.changed_files !== 1) {
        throw new Error("More than one file has been changed.");
    }
    consola.info("OK: pull request only changes one file");

    const filesUrl = `${pullRequest.url}/files`;
    consola.debug({ filesUrl });
    const response = await fetch(filesUrl);
    const files = await response.json();
    fileNameVerify(files[0].filename);
    const diff = await getDiffFile(pullRequest.diff_url as string);
    const packages = await parseChanges(diff);

    await verifyPackageIdentifier(packages[0]);


    consola.log("Added packages", packages);
    consola.info("OK: checks passed");
}

export async function fileNameVerify(fileName: string): Promise<void> {
    if (fileName !== constants.whitelistFile) {
        throw new Error(`Changed file ${fileName} instead of ${constants.whitelistFile}`);
    }
    consola.debug(`OK: only changed ${constants.whitelistFile}`);
}

export async function getDiffFile(url: string): Promise<string> {
    try {
        const response = await fetch(url);
        const result = await response.text();
        return result;
    } catch (error) {
        throw new Error(`Error fetching diff file: ${error}`);
    }
}

export async function parseChanges(diff: string): Promise<PackageData[]> {
    const packages = [];
    const results = (diff.match(/^\+[^+]+/gm) || `No results found`);
    for (let i = 0; i < results.length; i++) {
        const pg = results[i].replace(/(\n|\+)/g, "");
        const pgArr: string[] = pg.split(`,`);
        const packageData = {
            identifier: pgArr[0],
            version: pgArr[1],
        };
        packages.push(packageData);
    }
    //FIXME: Change to one
    if (packages.length !== 1) {
        throw new Error(`Error extracting package data`);
    }
    return packages;
}

export async function verifyPackageIdentifier(packageData: PackageData): Promise<void> {
    const { identifier, version } = packageData;
    const desc = JSON.stringify(packageData);
    // TODO consider escaping before constructing URL
    const url = `https://unpkg.com/${identifier}@${version}/package.json`;
    consola.debug({ url });
    const response = await fetch(url);
    if (response.status === 404) {
        throw new Error(`Could not find package with ${desc}`);
    }
    if (!response.ok) {
        throw new Error(`Error fetching package.json for ${desc} from ${url}: ${response.status} / ${response.statusText}`);
    }
    const packageJson = await response.json();
    consola.debug({ packageJson });
    consola.info(`OK: got package.json`);
    await verifyPackageJson(packageJson);
}

export async function verifyPackageJson(packageJson: { [key: string]: unknown }): Promise<void> {
    const { name, version } = packageJson;
    const desc = JSON.stringify({ name, version });
    // https://docs.npmjs.com/cli/v6/configuring-npm/package-json#repository
    if (!packageJson.hasOwnProperty("repository")) {
        throw new Error(`No repository defined for ${desc}`);
    }
    consola.info(`OK: package.json contains repository property`);
    const repository = packageJson.repository as Record<string, unknown>;
    if (!repository.hasOwnProperty("type")) {
        throw new Error(`package.json/repository must have type`);
    }
    if (repository.type !== "git") {
        throw new Error(`package.json/repository must have git type, not ${repository.type}`);
    }
    consola.info(`OK: package.json/repository/type is ${repository.type}`);
    if (!repository.hasOwnProperty("url")) {
        throw new Error(`package.json/repository must have url`);
    }
    let url = repository.url as string;
    url = url.replace("git+https", "https");
    url = "https://github.com/dhis2designlab/scp-component-test-library.git";
    const git = simpleGit();
    consola.debug(`Will clone ${url} with version ${version} into ${globals.repoDir}`);
    await rimrafp(globals.repoDir);
    await git.raw(["clone", "--depth", "1", url, globals.repoDir]);
    await git.raw(["--git-dir", `${globals.repoDir}\\.git`, "checkout", `v${version}`]);
    try {
        process.chdir(globals.repoDir);
        consola.log(`Switched to a directory: ${process.cwd()}`);
    } catch (err) {
        consola.error(`chdir: ${err}`);
    }
    {
        const cmd = "npm";
        const args = ["install"];
        consola.debug("calling ...", {cmd, args});
        const results = await miscm.pspawn(cmd, args, {stdio: "inherit", shell: true});
        consola.debug("results", results);
        const { code, error } = results;
        if ( error || code !== 0 ) {
            throw new Error(`Failed to run ${cmd} ${args}`);
        }
    }
    const currentDir = process.cwd();
    consola.log(`Current directory: ${currentDir}`);
    await verificationHandler(currentDir);
}