#!/usr/bin/env node

import consola from "consola";
import yargs from "yargs";
import * as constants from "./constants";
import process from "process";
import chalk from "chalk";
import fetch from "node-fetch";
import { verificationHandler } from "./cli-verify"
import fsm from "fs";
import validate from "validate-npm-package-name"
import semver from "semver"
import * as diff from "diff";

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
        .option("pull-request-url", {
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
        } else if (argv.pullRequestUrl) {
            const response = await fetch(argv.pullRequestUrl as string);
            const pullRequest = await response.json();
            await pullRequestVerify({"pull_request": pullRequest});
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

export async function pullRequestVerify(eventData: Record<string, unknown>, repoDir: (string | null) = null): Promise<void> {
    consola.debug(`The event payload: ${eventData}`);

    if (!eventData.hasOwnProperty("pull_request")) {
        throw new Error("event-json does not have a pull_request property.");
    }
    consola.info(chalk.green("OK: event is a pull request"));
    const pullRequest = eventData["pull_request"] as Record<string, unknown>;

    if (pullRequest !== undefined && pullRequest.changed_files !== 1) {
        throw new Error("More than one file has been changed.");
    }
    consola.info(chalk.green("OK: pull request only changes one file"));

    const filesUrl = `${pullRequest.url}/files`;
    consola.debug({ filesUrl });
    const response = await fetch(filesUrl);
    const files = await response.json();
    fileNameVerify(files[0].filename);

    // const diff = await getDiffFile(pullRequest.diff_url as string);
    // const packages = await parseChanges(diff);
    const { oldFile, newFile } = await getChangedFileData(pullRequest, files);
    const packages = await extractPackages(oldFile, newFile);

    await verifyPackageIdentifier(packages[0], repoDir);
}

export async function fileNameVerify(fileName: string): Promise<void> {
    if (fileName !== constants.whitelistFile) {
        throw new Error(`Changed file ${fileName} instead of ${constants.whitelistFile}`);
    }
    consola.debug(chalk.green(`OK: only changed ${constants.whitelistFile}`));
}

export async function getChangedFileData(pullRequest: Record<string, any>, files: Record<string, string>[]): Promise<{newFile: string, oldFile: string}> {
    try { 
        const oldRevision = pullRequest.base.sha;
        const oldFileUrl = `${pullRequest.base.repo.html_url}/raw/${oldRevision}/list.csv`;
        const newFileUrl = files[0].raw_url;
        let oldFile;
        {
            const response = await fetch(oldFileUrl);
            oldFile = await response.text();
        }
        /*
        if ( oldFile.slice(-1) !== "\n" ) {
            oldFile += "\n";
        }
        */
        let newFile;
        {
            const response = await fetch(newFileUrl);
            newFile = await response.text();
        }
        /*
        if ( newFile.slice(-1) !== "\n" ) {
            newFile += "\n";
        }
        */
        return { newFile, oldFile };
    } catch (error) {
        throw new Error(`Error extracting package data: ${error}`);
    }
}

export async function extractPackages(oldFile: string, newFile: string): Promise<PackageData[]> {
    const packages = [];
    const oldLines = oldFile.split(/\r?\n/);
    const newLines = newFile.split(/\r?\n/);
    for ( const fLines of [ oldLines, newLines ] ) {
        if ( fLines.slice(-1)[0] === "" ) {
            fLines.pop();
        }
    }
    const changes = diff.diffArrays(oldLines, newLines);
    consola.log(`changes =`, changes);
    for (const change of changes) {
        if ( change.removed ) {
            throw new Error(`Change is removing a line`);
        } else if ( change.added ) {
            for ( const value of change.value ) {
                const pgArr: string[] = value.split(`,`);
                const packageData = {
                    identifier: pgArr[0],
                    version: pgArr[1],
                };
                packages.push(packageData);
            }
        }
    }
    consola.log(`packages =`, packages);
    if (packages.length != 1) {
        throw new Error(`Must change exactly 1 line in the file`);
    }
    return packages;
}

export async function verifyPackageIdentifier(packageData: PackageData, repoDir: (string | null) = null): Promise<void> {
    const { identifier, version } = packageData;
    const desc = JSON.stringify(packageData);
    consola.log(`Validating package identifier..`);
    const validateIdentifier = validate(identifier);
    if (!validateIdentifier.validForNewPackages) {
        if (validateIdentifier.errors !== undefined && validateIdentifier.errors.length !== 0) {
            for (let i = 0; i < validateIdentifier.errors.length; i++) {
               consola.error(`Invalid package identifier: ${validateIdentifier.errors[i]}`);
            }
        }
        throw new Error(`Invalid package identier: ${identifier}`);
    }
    consola.log(`Validating package version..`);
    const validateVersion = semver.valid(version);
    if (validateVersion === null) {
        throw new Error(`Invalid package version: ${version}`)
    }
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
    consola.info(chalk.green(`OK: fetched package.json`));
    await verifyPackageJson(packageJson, repoDir);
}

export async function verifyPackageJson(packageJson: { [key: string]: unknown }, repoDir: (string | null) = null): Promise<void> {
    const { name, version } = packageJson;
    const desc = JSON.stringify({ name, version });
    if (!packageJson.hasOwnProperty("repository")) {
        throw new Error(`No repository defined for ${desc}`);
    }    
    consola.info(chalk.green(`OK: package.json contains repository property`));
    const repository = packageJson.repository as Record<string, unknown>;
    if (!repository.hasOwnProperty("type")) {
        throw new Error(`package.json/repository must have type`);
    }
    if (repository.type !== "git") {
        throw new Error(`package.json/repository must have git type, not ${repository.type}`);
    }
    consola.info(chalk.green(`OK: package.json/repository/type is ${repository.type}`));
    if (!repository.hasOwnProperty("url")) {
        throw new Error(`package.json/repository must have url`);
    }

    consola.info(chalk.green("OK: pull request checks passed."));
    
    let url = repository.url as string;
    url = url.replace("git+https", "git");
    consola.debug(`Will clone ${url} with version ${version} into ${globals.repoDir}`);
    const useRepoDir = repoDir || globals.repoDir;
    try {
        await rimrafp(useRepoDir);
        {
            const args = ["git", "clone", "--depth", "1", "--branch", `v${version}`, url, useRepoDir]
            const results = await miscm.pspawn(args[0], args.slice(1), {stdio: "inherit", shell: true});
            consola.debug("results", results);
            const { code, error } = results;
            if ( error || code !== 0 ) {
                throw new Error(`Failed to run ${args.join(" ")} code=${code} error=${error}`);
            }
        }
        try {
            process.chdir(useRepoDir);
            consola.info(chalk.green(`Switched to a directory: ${process.cwd()}`));
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
                throw new Error(`Failed to run ${cmd} ${args.join(" ")}`);
            }
        }
        const currentDir = process.cwd();
        consola.info(`Current directory: ${currentDir}`);
        await verificationHandler(currentDir);
    } finally {
        consola.info(`Cleaning up ${useRepoDir}`);
        await rimrafp(useRepoDir);
    }
}