import { pkgInfo } from "./package-info.mjs";
import * as fs from "fs";

const getInfo = async (name, version, opts = {}) => {
  return await pkgInfo(name, version, opts);
};

export const loadOpts = (rulesFile) => {
  try {
    var content = fs.readFileSync(rulesFile, "utf8");
    return JSON.parse(content);
  } catch (err) {
    return {};
  }
};

export const getOpts = ({ maxDays, ...opts }) => {
  const rules = opts.rulesFile || opts.rules;
  opts = {
    ...loadOpts(rules),
    ...opts,
  };
  try {
    return {
      maxDays: maxDays && parseInt(maxDays),
      ...opts,
    };
  } catch (e) {
    return {};
  }
};

export const getPkgDependencies = async (pkgFilePath, opts = {}) => {
  var content = fs.readFileSync(pkgFilePath, "utf8");
  const data = JSON.parse(content);
  const dependencies = data.dependencies || {};
  const devDependencies = opts.dev ? data.devDependencies || {} : {};
  let allDependencies = { ...dependencies, ...devDependencies };
  const { exclude } = opts;
  if (exclude) {
    allDependencies = Object.keys(allDependencies).reduce((acc, key) => {
      const entry = allDependencies[key];
      return !exclude.includes(key) ? { ...acc, [key]: entry } : acc;
    }, {});
  }
  return allDependencies;
};

export const fetch = async (packageObjs, opts = {}) => {
  const { names, pretty, filter } = opts;
  const promises = Object.entries(packageObjs).map(
    async ([packageName, version]) => {
      const pkgInfo = await getInfo(packageName, version, opts);
      return pkgInfo;
    }
  );
  let packages = await Promise.all(promises);
  let invalid = packages.find((p) => p.invalid) ? true : false;
  // if filter enabled, return only the packages that are invalid
  if (filter) {
    packages = packages.filter((pkg) => pkg.invalid);
  }
  if (names) {
    packages = packages.map((pkg) => pkg.name);
  }
  if (pretty) {
    packages = packages.join(",");
  }
  return {
    packages,
    invalid,
  };
};
