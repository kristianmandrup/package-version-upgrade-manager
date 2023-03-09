<!-- vscode-markdown-toc -->

- 1. [Dependencies report](#Dependenciesreport)
- 2. [Usage](#Usage)
  - 2.1. [Exit codes](#Exitcodes)
  - 2.2. [Names](#Names)
- 3. [Generate report](#Generatereport)
- 4. [Run against rules](#Runagainstrules)
  - 4.1. [Package category rules](#Packagecategoryrules)
  - 4.2. [Package specific rules](#Packagespecificrules)
- 5. [Generate XLS (Excel) report](#GenerateXLSExcelreport)
- 6. [Complete notification example](#Completenotificationexample)

<!-- vscode-markdown-toc-config
	numbering=true
	autoSave=true
	/vscode-markdown-toc-config -->
<!-- /vscode-markdown-toc -->

# Package version upgrade manager

Replaces deprecated [package version report generator](https://www.npmjs.com/package/pkg-version-report-gen).

This tool is now focused on managing and reporting package version upgrades based on policies.

It can be run on `package.json` file to:

- generate package dependency reports.
- determine packages that are invalid according to version policies and need to be updated

The goal of this tool is to help organizations detect packages that are in need of attention and could pose security risks, technical debt issues etc.

The package contains a binary `pvum` which can be run in the Terminal CLI as described under [Usage](#2-usage)

Alternatively you can integrate the core functionality in your own NodeJS tooling, such as described under [Complete notification example](#complete-notification-example) (Slack API notifications)

```js
import { getPackageInfo } from "package-version-upgrade-manager";
```

`getPackageInfo` is `async` and returns an object with `packages` and `invalid` status.

```js
const { packages, invalid } = await getPackageInfo(pkgFile, opts);
```

## 1. <a name='Dependenciesreport'></a>Dependencies report

The default package dependencies report contains the following information for each package:

```json
{
  "name": "got",
  "version": "11.8.2",
  "versionDate": "2021-2-26",
  "semVerDiff": "major",
  "versionDiff": "1.0.0",
  "majorDiff": 1,
  "minorDiff": 0,
  "patchDiff": 0,
  "latestVersion": "12.3.1",
  "latestVersionDate": "2022-8-6",
  "daysBehindLatestVersion": 526,
  "invalid": true
}
```

If run with `--verbose` setting you can additionally get the following information (versions are last 5 versions published)

```json
{
  "description": "yargs the modern, pirate-themed, successor to optimist.",
  "license": "MIT",
  "homepage": "https://yargs.js.org/",
  "author": "bcoe, oss-bot",
  "versions": ["17.1.0", "17.1.1-candidate.0"]
}
```

You can use tools like [jq](https://stedolan.github.io/jq/) to parse the JSON and handle it as needed, such as in the early stage of a CI pipeline to notify relevant parties, abort the pipeline etc.

## 2. <a name='Usage'></a>Usage

The package installation makes the `pvum` executable available

`$ pvum`

Usage help

```bash
$ pvum --help

Commands:
  pvum info [pkgfile]         fetch package info from package.json file
  pvum xls-report [filepath]  generate xls file (Excel) from report json file

Options:
  --help     Show help                                                 [boolean]
  --version  Show version number                                       [boolean]
  -v, --verbose  Verbose package info                                  [boolean]

  -o, --output   Output file to store the report                       [string]
  -n, --names    Output only package names                             [boolean]
  -p, --pretty   Pretty output package names                             [boolean]

  -f, --filter   Apply rules filter to only output invalid packages    [boolean]
      --dev           Include devDependencies                          [boolean]
  -r, --rules    Path to rules file                                    [string]
  -s, --maxSVD   maximum semver diff such as: minor                    [string]
  -d, --maxDays  maximum number of days since last release             [string]
  --maxPatchDiff maximum patch versions behind                         [string]
  --maxMinorDiff maximum minor versions behind                         [string]
  --maxMajorDiff maximum major versions behind                         [string]
```

Print basic report

```bash
$ pvum info package.json

Processing: package.json
[
  {
    "name": "got",
    "version": "11.8.2",
    "versionDate": "2021-2-26",
    "semVerDiff": "major",
    "versionDiff": "1.0.0",
    "majorDiff": 1,
    "minorDiff": 0,
    "patchDiff": 0,
    "latestVersion": "12.4.1",
    "latestVersionDate": "2022-9-2",
    "daysBehindLatestVersion": 553,
    "invalid": false
  },
]
```

### 2.1. <a name='Exitcodes'></a>Exit codes

Use the `---exit` option to force exit with a system exit code.

The exit code will be `0` (success) when there are no invalid packages and `1` (error) if there are 1 or more invalid packages.

Example usage:

```bash
$ pvum info package.json -r rules.json --dev --names --pretty --exit
Processing: package.json
diff-dates,got,json2xls,latest-semver,read-pkg,registry-url,semver-diff,yargs
 ✘  ~/repos/personal/package-version-upgrade-manager
```

Returns pretty printed list of invalid packages with exit code 1 (error)

### 2.2. <a name='Names'></a>Names

If run with `--names` you get the list of invalid package names

```bash
$ pvum info package.json -r warn-policies.json --names
got,yargs
```

If there are NO invalid packages it returns nothing

```bash
$ pvum info package.json -r critical-policies.json --names
```

This is useful combined with [run against rules](#Runagainstrules) and `--filter` to output the list of packages that are invalid according to the version policies.

You can use different policy files for alerting on multiple policy levels such as warning and critical (see [Complete notification example](#complete-notification-example) below)

## 3. <a name='Generatereport'></a>Generate report

Generate and store basic report using the `--output` (`-o`) flag

```bash
$ pvum info package.json --output report.json

Processing: package.json
Writing to file: report.json
Done :)
```

Generate and store verbose report using the `--verbose` (`-v`) flag

```bash
$ pvum info package.json --verbose --output report.json

Processing: package.json
Writing to file: report.json
Done :)
```

## 4. <a name='Runagainstrules'></a>Run against rules

Create a rules file such as:

```json
{
  "maxSVD": "minor",
  "maxDays": 180,
  "maxMinorDiff": 2,
  "exclude": ["lodash", "moment"]
}
```

This rule file says that if a package version is either:

- more than 2 minor versions behind (`maxMinorDiff`)
- at least one minor version (`maxSVD: "minor"`) and `180` days behind latest release (ie. `maxDays`)
- and not in the list of packages to be excluded for consideration

Then the package will be marked as `invalid` in the output.

Then rule with the `-r` option pointing to the rule file

`$ pvum info -r rules.json`

Alternatively use the rule options directly

`$ pvum info -r rules.json -d 160 -s minor`

If you supply both types of rules, the options override any rule in the the rules file (overide `maxDays` in `rules.json`)

`$ pvum info -r rules.json -d 160`

With rules the `invalid` entry will be `true` or `false` depending on whether the package entry is within the constraints defined by the rules.

```bash
[
  {
    "name": "diff-dates",
    "version": "1.0.14",
    "versionDate": "2021-3-2",
    "versionDiff": "0.0.0",
    "majorDiff": 0,
    "minorDiff": 0,
    "patchDiff": 0,
    "latestVersion": "1.0.14",
    "latestVersionDate": "2021-3-2",
    "daysBehindLatestVersion": 0,
    "invalid": false
  },
  {
    "name": "got",
    "version": "11.8.2",
    "versionDate": "2021-2-26",
    "semVerDiff": "major",
    "versionDiff": "1.0.0",
    "majorDiff": 1,
    "minorDiff": 0,
    "patchDiff": 0,
    "latestVersion": "12.4.1",
    "latestVersionDate": "2022-9-2",
    "daysBehindLatestVersion": 553,
    "invalid": false
  },
 ]
```

In the above output, we can see that the package `got` has a `semVerDiff` of `major` which means it is a `major` sem version behind and more than `180` days (here `526`) behind latest release. Therefore `invalid` for `got` is marked as `false`

### 4.1. <a name='Packagecategoryrules'></a>Package category rules

You may also define package rule categories. Here we specify a set of `core` packages (`react` and `redux`) as entries in `categories.list` that all share the same package category rule as entries under `categories.rules`.

```json
{
  "maxSVD": "minor",
  "maxDays": 180,
  "maxMinorDiff": 3,
  "categories": {
    "rules": {
      "core": {
        "maxDays": 90,
        "maxMinorDiff": 2
      }
    },
    "lists": {
      "core": ["react", "redux"]
    }
  }
}
```

### 4.2. <a name='Packagespecificrules'></a>Package specific rules

You can add a `packages` entry to the rules file to set package specific rules that override default and category rules.

```json
{
  "maxSVD": "minor",
  "maxDays": 180,
  "maxMinorDiff": 3,
  "packages": {
    "react": {
      "maxDays": 90,
      "maxMinorDiff": 2
    }
  }
}
```

## 5. <a name='GenerateXLSExcelreport'></a>Generate XLS (Excel) report

The dependencies report `.json` file can be exported to an `.xslx` file (for Excel) using the `xls-report` command.

```bash
$ pvum xls-report report.json

Generating XLS report file for: report.json
Writing to file: report_2021-12-09.json
Done :)
```

## 6. <a name='Completenotificationexample'></a>Complete notification example

See this example in the `examples` folder of the repo.
Ensure the following env variables are set:

- `SLACK_TOKEN`
- `SLACK_CONVERSATION_ID`

You can notify relevant parties using [Slack](https://www.npmjs.com/package/@slack/web-api) or similar notification systems.

This could look something like the following:

```js
import { WebClient } from "@slack/web-api";
import { getPackageInfo } from "package-version-upgrade-manager";

// Read a token from the environment variables
const token = process.env.SLACK_TOKEN;

// Initialize
const web = new WebClient(token);

// Given some known conversation ID (representing a public channel, private channel, DM or group DM)
const conversationId = process.env.SLACK_CONVERSATION_ID;

const policyLabelMap = {
  warn: "Warning ⚠️",
  critical: "CRITICAL 🔥🔥🔥",
};

const notifySlackChannel = async (packageNames, policy = "warn") => {
  // Post a message to the channel, and await the result.
  // Find more arguments and details of the response: https://api.slack.com/methods/chat.postMessage
  const namesToPrint = packageNames.join(", ");
  const policyLabel = policyLabelMap[policy];
  const text = `${policyLabel} : packages to be updated: ${namesToPrint}`;
  await web.chat.postMessage({
    text,
    channel: conversationId,
  });
};

const onInvalidPackages = async (packageNames, policy) => {
  await notifySlackChannel(packageNames, policy);
};

// default options
const opts = {
  names: true,
};

const rulesFileMap = {
  warn: "warning-policies.json",
  critical: "critical-policies.json",
};

const pkgFile = "./package.json";

const handlePolicies = async (msgFn, rulesFile, { policy }) => {
  const { packages, invalid } = await getPackageInfo(pkgFile, {
    ...opts,
    rules: rulesFile,
  });
  if (invalid) {
    await onInvalidPackages(packages, policy);
  }
  const msg = msgFn(opts);
  msg && console.log(msg);
};

const msgFn = ({ policy } = {}) => policy && `${policy} policies DONE`;

const policies = ["critical", "warn"];

const run = async () => {
  for (policy in policies) {
    await handlePolicies(msgFn, rulesFileMap[policy], { policy });
  }
};
run();
```
