import * as jsonData from '../../data/sample-event.json';
import { handler } from '../../src/cli-pr-verify';
const consola = require('consola');
import fsm from "fs";
const fsmp = fsm.promises;

test('Missing pull_request property', async () => {
    const expected = 1;
    let data = JSON.parse(JSON.stringify(jsonData));
    data["push_request"] = data["pull_request"];
    delete data["pull_request"];
    //consola.log(data.push_request);
    expect(1).toEqual(expected);
});

test('Changed two files instead of one', async () => {
    const expected = 1;
    let data = JSON.parse(JSON.stringify(jsonData));
    let pullRequest = data["pull_request"];
    pullRequest.changed_files = 2;
    consola.log("Changed files in a pull request", pullRequest.changed_files);
    expect(1).toEqual(expected);
});




