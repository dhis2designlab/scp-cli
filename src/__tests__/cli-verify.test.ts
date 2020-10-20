const consola = require('consola');
//const { componentHandler } = require('../../src/cli-verify');
import { componentHandler } from '../../src/cli-verify';
const packageDir = '../../src';
const package_ = {
    helloWorld: function () {
        /* eslint-disable no-console */
        console.log('Hello world!');
        /* eslint-enable no-console */
    }
}
const constants = require("../../src/constants");

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

test('Correct Package.json structure', () => {
    const packageJson = {
        "org.dhis2:scp-components": [
            {
                "export": "helloWorld",
                "name": "Hello World",
                "description": "Greeting component"
            }
        ]
    };
    const expected: any = [];
    expected['helloWorld'] = {
        "name": "Hello World",
        "description": "Greeting component"
    };
    const errors = new ErrorList();
    const specifiedComponents: any = [];
    const packageDetails = {
        packageJson,
        packageDir,
        package_
    };
    componentHandler(packageDetails, errors, specifiedComponents);
    expect(specifiedComponents.sort()).toEqual(expected.sort());
});


test(`Missing keyword ${constants.components}`, () => {
    const packageJson = {
        "": [
            {
                "export": "helloWorld",
                "name": "Hello World",
                "description": "Greeting component"
            }
        ]
    };
    const expected = new ErrorList();
    expected.push(`package.json does not include ${constants.components} field`);
    const errors = new ErrorList();
    const specifiedComponents: any = [];
    const packageDetails = {
        packageJson,
        packageDir,
        package_
    };
    componentHandler(packageDetails, errors, specifiedComponents);
    expect(errors).toEqual(expected);
});


test(`Empty array with components ${constants.components}`, () => {
    const packageJson =
    {
        "org.dhis2:scp-components": []
    };
    const expected = new ErrorList();
    expected.push(`package.json includes ${constants.components} field, but the list is empty`);
    const errors = new ErrorList();
    const specifiedComponents: any = [];
    const packageDetails = {
        packageJson,
        packageDir,
        package_
    };
    componentHandler(packageDetails, errors, specifiedComponents);
    expect(errors).toEqual(expected);
});

test(`All fields are empty`, () => {
    const packageJson = {
        "org.dhis2:scp-components": [
            {
                "export": "",
                "name": "",
                "description": ""
            }
        ]
    };
    const errors = new ErrorList();
    const specifiedComponents: any = [];
    const packageDetails = {
        packageJson,
        packageDir,
        package_
    };
    componentHandler(packageDetails, errors, specifiedComponents);
    expect(errors.list).toContainEqual(expect.objectContaining({ 'text': 'property "description" is empty' }));
    expect(errors.list).toContainEqual(expect.objectContaining({ 'text': 'property "name" is empty' }));
    expect(errors.list).toContainEqual(expect.objectContaining({ 'text': 'property "export" is empty' }));
});

const packageJsonOk = {
    [constants.components]: [
        {
            "export": "helloWorld",
            "name": "Hello World",
            "description": "Greeting component"
        }
    ]
};

test(`Exception in processing`, () => {
    const packageJson = packageJsonOk;
    const errors = new ErrorList();
    const packageDetails = {
        packageJson,
        packageDir,
        package_
    };
    // This will throw because specifiedComponents is null ...
    componentHandler(packageDetails, errors, null!);
    expect(errors.list.map(item => item.text)).toContainEqual(expect.stringContaining("problem when processing package.json "));

});

function withoutKey(object: { [key:string]: any }, key: string) {
    const clone = { ...object };
    delete clone[key];
    return clone;
}

describe("parameterized tests", () => {
    const cases = [];
    for (const key of ["export", "name", "description"]) {
        cases.push([
            `Empty '${key}' field`,
            { [constants.components]: [{ ...packageJsonOk[constants.components][0], [key]: "" }] },
            [{ 'text': `property "${key}" is empty` }]
        ]);
        cases.push([
            `Property '${key}' not a string`,
            { [constants.components]: [{ ...packageJsonOk[constants.components][0], [key]: 124 }] },
            [{ 'text': `property "${key}" must be a string` }]
        ]);
        cases.push([
            `Missing '${key}' field`,
            { [constants.components]: [withoutKey(packageJsonOk[constants.components][0], key)] },
            [{ 'text': `one of the components does not have the "${key}" property` }]
        ]);
    }
    test.each(cases)("%s", (label, packageJson, expectedErrors: any) => {
        const errors = new ErrorList();
        const specifiedComponents: any = [];
        const packageDetails = {
            packageJson,
            packageDir,
            package_
        };
        componentHandler(packageDetails, errors, specifiedComponents);
        for (const expectedError of expectedErrors) {
            expect(errors.list).toContainEqual(expect.objectContaining(expectedError));
        }
    });
});



