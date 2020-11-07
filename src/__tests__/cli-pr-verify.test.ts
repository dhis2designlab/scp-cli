// import * as jsonData from '../../data/sample-event.json';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const jsonData = require("../../data/sample-event.json"); 
import { pullRequestVerify, fileNameVerify, getDiffFile, parseChanges } from '../../src/cli-pr-verify';
import * as prVerify from '../../src/cli-pr-verify';
import chalk from "chalk";

// const consola = require('consola');
import consola from "consola";
import * as constants from "../constants";

jest.setTimeout(50000);

test('Missing pull_request property', async () => {
    const data = JSON.parse(JSON.stringify(jsonData));
    data["push_request"] = data["pull_request"];
    delete data["pull_request"];
    await expect(
        pullRequestVerify(data)
    ).rejects.toThrow(new Error('event-json does not have a pull_request property.'));
});

test('Pull_request undefined', async () => {
    const data = JSON.parse(JSON.stringify(jsonData));
    data["pull_request"] = {};
    await expect(
        pullRequestVerify(data)
    ).rejects.toThrow(new Error('More than one file has been changed.'));
});

test('Changed two files instead of one', async () => {
    const data = JSON.parse(JSON.stringify(jsonData));
    const pullRequest = data["pull_request"];
    pullRequest.changed_files = 2;
    await expect(
        pullRequestVerify(data)
    ).rejects.toThrow(new Error('More than one file has been changed.'));
});

test('Changing the wrong file', async () => {
    await expect(
        fileNameVerify("whitelist.csv")
    ).rejects.toThrow(new Error(`Changed file whitelist.csv instead of ${constants.whitelistFile}`));
});

test("Changing the right file", async () => {
    const consoleSpy = jest
        .spyOn(consola, 'debug')
        .mockImplementation(() => { return; });
    fileNameVerify("list.csv");
    expect(consoleSpy).toHaveBeenCalledWith(chalk.green(`OK: only changed ${constants.whitelistFile}`));
});

test("Right output for correct run", async () => {
    const data = JSON.parse(JSON.stringify(jsonData));
    const consoleSpy = jest
        .spyOn(consola, 'info')
        .mockImplementation(() => { return; });
    await pullRequestVerify(data);
    expect(consoleSpy).toHaveBeenCalledWith(chalk.green("OK: event is a pull request"));
    expect(consoleSpy).toHaveBeenCalledWith(chalk.green("OK: pull request only changes one file"));
    expect(consoleSpy).toHaveBeenCalledWith(chalk.green("OK: fetched package.json"));
});


test("Could not fetch diff file", async () => {
    await expect(
        getDiffFile("test")
    ).rejects.toThrowError(`Error fetching diff file`);
});

test("Failure on three packages added in pull-request", async () => {
    const diff = `
    +scp-component-test-library,1.0.1
    +scp-component-test-library,1.0.2
    +lodash,4.17.20`;
    await expect(
        parseChanges(diff)
    ).rejects.toThrowError(`Error extracting package data`);
});

test("Verify package identifier", async () => {
    const consoleSpy = jest
        .spyOn(consola, 'info')
        .mockImplementation(() => { return; });
    await prVerify.verifyPackageIdentifier({identifier: "scp-component-test-library", version: "1.0.2"});
    expect(consoleSpy).toHaveBeenCalledWith(chalk.green("OK: event is a pull request"));
});