# DHIS2 SCP CLI

This NPM package helps you to create NPM packages with React components that can be used to build DHIS2 apps or other components.

This package provides a command line interface `dhis2-scp-cli` with various commands.

* `dhis2-scp-cli verify`: This command will check the quality of your npm package.
* `dhis2-scp-cli pr-verify`: This command is run during the whitelist pipeline. Not meant to be used directly.

The command will do the following:

* Verify that the package's `package.json` has the `dhis2-component-search` keyword (see section 1.1).
* Verify that the package's `package.json` has the `dhis2ComponentSearch` property with correct values and structure (see section 1.3).
* Verify that the package passes an `npm audit` check.
* Verify that the package passes an `eslint` check.

## Technology used

This package uses the following technology:

* [ESLint](https://eslint.org/)
* [Jest](https://jestjs.io/)
* [Node.js](https://nodejs.org/)
* [TypeScript](https://www.typescriptlang.org/)
* [yargs](https://yargs.js.org/)

## Depends upon (during `pr-verify`)
* Unpkg - for fetching the package.json file from the published package.
* GitHub - for cloning source repo and performing further verification.

# Package verification guide

## 1 Verification prerequisites

### 1.1 Keyword

Your `package.json` file must include `dhis2-component-search` keyword as follows:

```json
{
  "keywords": [
      "dhis2-component-search"
  ]
}
```

### 1.2 Repository

Currently we only support packages hosted on Github.
Your `package.json` file must include `repository` property, that includes key/value pairs for repository type and url. This must be the HTTPS url, not SSH.
Inside your `package.json`it would look like this:

```json
{
   "repository": {
        "type" : "git",
        "url" : "https://github.com/npm/cli.git"
    }
}
```
The URL should be a publicly available and you must specify the repository type and url. Note that you cannot use shortcut syntax, e.g. `"repository": "github:user/repo"`.


### 1.3 The `dhis2ComponentSearch` property

The `dhis2ComponentSearch` property of a `package.json` file includes the information about the package that is relevant to The Shared Component Platform and its search functionality.

The `dhis2ComponentSearch` property must include key/value pairs for framework (using `language` key, we currently support `react` and `angular`), and components. The `component` property, in turn, takes an array of component objects. Each component object must include following information defined as key/value pairs:

__Required__:
* The `name` property contains a name of the exported component.
* The `export` property contains an export of the exported component. This needs to match the actual export in the code.
* The `description` property contains description of the exported component.

__Optional__:
* The `dhis2Version` optional property contains the DHIS2 versions supported by the exported component, the versions must be specified as an array of strings.

Inside your `package.json`, the `dhis2ComponentSearch` property may look something like this:

```json
{
   "dhis2ComponentSearch": {
    "language": "react",
    "components": [
      {
        "name": "Organizational Unit Tree",
        "export": "OrgUnitTree",
        "description": "A simple OrgUnit Tree",
        "dhis2Version": [
          "32.0.0",
          "32.1.0",
          "33.0.0"
        ]
      }
    ]
   }
}
```

### 1.4 Components as commonJS or ES modules

Our verification process requires your components to be distributed as [commonJS modules](https://en.wikipedia.org/wiki/CommonJS) or [ES modules](https://en.wikipedia.org/wiki/ECMAScript). The command `npm install` should result in a valid module.
One good way to achieve this is with the help of [@dhis2/cli-app-scripts](https://platform.dhis2.nu/#/), as it bundles `commonjs` and `es` module formats. A simple [boilerplate](https://github.com/haheskja/scp-react-boilerplate) can help you get started. Another good way is to build the library with [create-react-library](https://www.npmjs.com/package/create-react-library).

### 1.5 NPM and Github

Your package must be published on [NPM](https://www.npmjs.com) and have a public [Github](https://www.github.com) repository. Since we verify a specific version of the package, a git tag with this version should be added. When tagging releases in a version control system, the tag for a version must be `vX.Y.Z` e.g. `v1.0.2`.

## 2 Pre-verification

You can use [dhis2-scp cli](https://github.com/dhis2designlab/scp-cli) to verify your package locally before you submit your package for verification. It provides a command
```properties
dhis2-scp-cli verify
```
that runs all the checks included in the verification.

## 3 Verification process

When all the prerequisites are met, you may proceed with the verification.

[DHIS2 SCP Whitelist](https://github.com/dhis2designlab/scp-whitelist) repository contains a list of verified NPM packages. Pull requests to this repository will be validated with a GitHub actions workflow.

 To submit your package for verification you would need to modify [`list.csv`](https://github.com/dhis2designlab/scp-whitelist/blob/main/list.csv) file by adding a new line containing your npm package `identifier`and its `version` separated by a comma, e.g. `lodash,4.17.14`. Since you do not have a write access to the repository, a change in this file will
write it to a new branch in your fork, so you can make a pull request. Fill in a title and description and create your pull request, which in turn, will trigger the verification workflow on your package.

The verification workflow:

* Checks for verification prerequisites defined in section 1
* Lints the code
* Runs npm audit

