import consola from "consola";
import { componentHandler, SpecifiedComponents, versionValidate } from '../../src/cli-verify';
const packageDir = '../../src';
const package_ = {
    helloWorld: function () {
        /* eslint-disable no-console */
        console.log('Hello world!');
        /* eslint-enable no-console */
    }
}
import * as constants from "../../src/constants";

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

const packageJsonOk = {
    [constants.dhis2Scp]: {
        "language": "react",
        [constants.components]: [
            {
                "export": "helloWorld",
                "name": "Hello World",
                "description": "Greeting component"
            }
        ]
    }
};

/* eslint-disable @typescript-eslint/no-explicit-any */
function updateKey(object: { [key: string]: any } | any[], path: string, operation: "set" | "delete", value: any): { [key: string]: any } | any[] {
    const pathParts = path.split("/");
    if (pathParts.length > 1) {
        const key = pathParts[0];
        const nextPath = pathParts.slice(1).join("/");
        if (Array.isArray(object)) {
            const index = parseInt(key);
            const clone = [...object];
            clone[index] = updateKey(object[index], nextPath, operation, value);
            return clone;
        } else {
            return { ...object, [key]: updateKey(object[key], nextPath, operation, value) };
        }
    }
    else {
        const key = path;
        if (operation === "delete") {
            const clone = { ...object };
            delete (clone as any)[key];
            return clone;
        } else {
            if (Array.isArray(object)) {
                const index = parseInt(key);
                const clone = [...object];
                clone[index] = value;
                return clone;
            } else {
                return { ...object, [key]: value };
            }
        }
    }
}

test('Correct Package.json structure', () => {
    const expected: SpecifiedComponents = {};
    expected['helloWorld'] = {
        "name": "Hello World",
        "description": "Greeting component"
    };
    const errors = new ErrorList();
    const specifiedComponents: SpecifiedComponents = {};
    const packageDetails = {
        packageJson: packageJsonOk,
        packageDir,
        package_
    };
    componentHandler(packageDetails, errors, specifiedComponents);
    expect(specifiedComponents).toEqual(expected);
});


test(`Missing keyword ${constants.dhis2Scp}`, () => {
    const packageJson = {
    };
    const expected = new ErrorList();
    expected.push(`package.json does not include ${constants.dhis2Scp} field`);
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
    const packageJson = updateKey(packageJsonOk, `${constants.dhis2Scp}/${constants.components}/0`, "set", {
        export: "",
        name: "",
        description: "",
    }) as Record<string, unknown>;
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


test(`Exception in processing`, () => {
    const packageJson = packageJsonOk;
    const errors = new ErrorList();
    const packageDetails = {
        packageJson,
        packageDir,
        package_
    };
    // This will throw because specifiedComponents is null ...
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    componentHandler(packageDetails, errors, null!);
    expect(errors.list.map(item => item.text)).toContainEqual(expect.stringContaining("problem when processing package.json "));

});


describe("parameterized tests", () => {
    const cases = [];
    cases.push([
        `Missing ${constants.dhis2Scp}/${constants.components}`,
        updateKey(packageJsonOk, `${constants.dhis2Scp}/${constants.components}`, "delete", null),
        [{ text: `package.json/${constants.dhis2Scp} does not include ${constants.components} field` }]
    ]);
    cases.push([
        `Empty array with ${constants.components}`,
        updateKey(packageJsonOk, `${constants.dhis2Scp}/${constants.components}`, "set", []),
        [{ text: `package.json/${constants.dhis2Scp} includes ${constants.components} field, but the list is empty` }]
    ]);
    cases.push([
        `${constants.components} not an array`,
        updateKey(packageJsonOk, `${constants.dhis2Scp}/${constants.components}`, "set", undefined),
        [{ text: `package.json/${constants.dhis2Scp} includes ${constants.components} but it is not an array` }]
    ]);
    for (const key of ["export", "name", "description"]) {
        cases.push([
            `Empty '${key}' field`,
            updateKey(packageJsonOk, `${constants.dhis2Scp}/${constants.components}/0/${key}`, "set", ""),
            [{ 'text': `property "${key}" is empty` }]
        ]);
        cases.push([
            `Property '${key}' not a string`,
            updateKey(packageJsonOk, `${constants.dhis2Scp}/${constants.components}/0/${key}`, "set", 124),
            [{ 'text': `property "${key}" must be a string` }]
        ]);
        cases.push([
            `Missing '${key}' field`,
            updateKey(packageJsonOk, `${constants.dhis2Scp}/${constants.components}/0/${key}`, "delete", null),
            [{ 'text': `one of the components does not have the "${key}" property` }]
        ]);
    }
    cases.push([
        `dhis2Version is not an array of strings`,
        updateKey(packageJsonOk, `${constants.dhis2Scp}/${constants.components}/0/dhis2Version`, "set", "32"),
        [{ 'text': `property ${constants.version} must be an array of strings` }]
    ]);
    cases.push([
        `Missing ${constants.framework} property`,
        updateKey(packageJsonOk, `${constants.dhis2Scp}/${constants.framework}`, "delete", null),
        [{ 'text': `package.json/${constants.dhis2Scp} does not include ${constants.framework}` }]
    ]);
    cases.push([
        `${constants.framework} property not a string`,
        updateKey(packageJsonOk, `${constants.dhis2Scp}/${constants.framework}`, "set", 13),
        [{ 'text': `package.json/${constants.dhis2Scp} includes ${constants.framework} but it is not a string` }]
    ]);
    cases.push([
        `${constants.framework} property not a valid option`,
        updateKey(packageJsonOk, `${constants.dhis2Scp}/${constants.framework}`, "set", "-1"),
        [{ 'text': `package.json/${constants.dhis2Scp} includes ${constants.framework} but it is not "react" or "angular"` }]
    ]);
    test.each(cases)("%s", (label, packageJson, expectedErrors: any) => {
        const errors = new ErrorList();
        const specifiedComponents: any = [];
        const packageDetails = {
            packageJson: packageJson as Record<string, unknown>,
            packageDir,
            package_
        };
        componentHandler(packageDetails, errors, specifiedComponents);
        for (const expectedError of expectedErrors) {
            expect(errors.list).toContainEqual(expect.objectContaining(expectedError));
        }
    });
});

test('Correctly specified dhis2 versions', async () => {
    const data = ["1.2.3", "1.0.1", "4.3.2"];
    const consoleSpy = jest
        .spyOn(consola, 'debug')
        .mockImplementation(() => { return; });
    await versionValidate(data);
    expect(consoleSpy).toHaveBeenCalledWith(`DHIS2 version(s): ${data.toString()} validated`);
});

test('Invalid dhis2 versions', async () => {
    const data = ["1.2.3", "1.d.1", "4.3.2"];
    await expect(
        versionValidate(data)
    ).rejects.toThrowError(`Invalid dhis2 version`);
});

