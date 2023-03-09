import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import * as fs from "fs";
import path from "path";

import { getPkgDependencies, fetch } from "./fetch.mjs";
import { createXlsReport } from "./xls-report.mjs";
import { getOpts } from "./fetch.mjs";

export const getPackageInfo = async (pkgfile, opts) => {
  opts = getOpts(opts);
  const packageObjs = await getPkgDependencies(pkgfile, opts);
  return await fetch(packageObjs, {
    rulesFile: opts.rules,
    ...opts,
  });
};

const doExit = ({ exit, invalid }) => {
  if (!exit) return;
  invalid ? process.exit(1) : process.exit(0);
};

export const mainFn = (argv) => {
  if (!argv.pkgfile) {
    console.error(`Missing argument with path to package.json file`);
    return;
  }
  if (argv.pkgfile) {
    const { pkgfile, output } = argv;
    console.log(`Processing: ${pkgfile}`);
    (async () => {
      const opts = getOpts(argv);
      const { invalid, packages } = await getPackageInfo(pkgfile, opts);
      const { names, exit } = opts;
      if (names) {
        console.log(packages);
        doExit({ exit, invalid });
        return;
      }

      const jsonStr = JSON.stringify(packages, null, 2);
      if (output) {
        console.log(`Writing to file: ${output}`);
        try {
          fs.writeFileSync(output, jsonStr, "utf8");
          console.log("Done :)");
        } catch (err) {
          console.error("File write error", err);
          throw err;
        }
      } else {
        console.log(jsonStr);
      }
      doExit({ exit, invalid });
    })();
  }
};

export const reportFn = (argv) => {
  const { filepath } = argv;
  console.log(`Generating XLS report file for: ${filepath}`);
  createXlsReport(filepath);
};

yargs(hideBin(process.argv))
  .command(
    "info [pkgfile]",
    "fetch package info from package.json file ",
    (yargs) => {
      return yargs.positional("pkgfile", {
        describe: "file path to package.json",
        default: path.join(process.cwd(), "package.json"),
      });
    },
    mainFn
  )
  .command(
    "xls-report [filepath]",
    "generate xls file (Excel) from report json file ",
    (yargs) => {
      return yargs.positional("filepath", {
        describe: "file path to report json file",
        default: path.join(process.cwd(), "report.json"),
      });
    },
    reportFn
  )
  .option("verbose", {
    alias: "v",
    type: "boolean",
    description: "Verbose package info",
  })
  .option("exit", {
    alias: "e",
    type: "boolean",
    description:
      "Exit with system exitcode depending on policy rule validation",
  })
  .option("names", {
    alias: "n",
    type: "boolean",
    description: "Output only package names",
  })
  .option("pretty", {
    alias: "p",
    type: "boolean",
    description: "Pretty output package names",
  })
  .option("filter", {
    alias: "f",
    type: "boolean",
    description: "Apply rules filter to only output invalid packages",
  })
  .option("dev", {
    type: "boolean",
    description: "Include devDependencies",
  })
  .option("output", {
    alias: "o",
    type: "string",
    description: "Output file to store the report",
  })
  .option("rules", {
    alias: "r",
    type: "string",
    description: "rules file",
  })
  .option("maxSVD", {
    alias: "s",
    type: "string",
    description: "maximum semver diff such as: minor",
  })
  .option("maxDays", {
    alias: "d",
    type: "string",
    description: "maximum number of days since last release",
  })
  .option("maxPatchDiff", {
    type: "string",
    description: "maximum patch versions behind",
  })
  .option("maxMinorDiff", {
    type: "string",
    description: "maximum minor versions behind",
  })
  .option("maxMajorDiff", {
    type: "string",
    description: "maximum major versions behind",
  })

  .parse();
