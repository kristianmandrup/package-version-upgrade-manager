"use strict";
import got from "got";
import registryUrl from "registry-url";
import pkg from "semver";
import diffDates from "diff-dates";
import semverDiff from "semver-diff";
import semver from "semver";

const { compare, valid } = pkg;

const maintainerNames = (maintainers) =>
  maintainers &&
  maintainers
    .reduce((acc, maintainer) => {
      acc.push(maintainer.name);
      return acc;
    }, [])
    .join(", ");

const excludeKeys = ["modified", "created"];
const versionsFor = (time) =>
  Object.keys(time)
    .filter((key) => !excludeKeys.includes(key))
    .filter((v) => v);

const dateFor = (date) => {
  if (!date) return date;
  let d = new Date(date);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

const sortVersions = (versions, loose = false) =>
  Array.from(versions)
    .filter((x) => valid(x))
    .sort((a, b) => compare(a, b, loose));

const semVerMap = {
  major: 1000,
  premajor: 100,
  minor: 10,
  preminor: 9,
  patch: 8,
  prepatch: 7,
  prerelease: 6,
  build: 5,
};

export const pkgInfo = (name, rawVersion, opts = {}) => {
  const dayDiff = (date1, date2) => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const days = diffDates(d2, d1, "days");
    return days || 0;
  };

  const semVerDiffToNum = (diff) => semVerMap[diff] || 0;

  const versionDiffTooLarge = (maxDiff, versionDifference) =>
    semVerDiffToNum(maxDiff) < semVerDiffToNum(versionDifference);

  const cleanVersion = (version) => semver.valid(semver.coerce(version));

  const calcSemVersionDiff = (version, latestVersion) =>
    semverDiff(version, latestVersion);

  const subVersions = (v1, v2) => {
    try {
      const v1Num = parseInt(v1);
      const v2Num = parseInt(v2);
      return v2Num - v1Num;
    } catch (e) {
      return 0;
    }
  };

  const versionCalcDiff = (version, latestVersion) => {
    const v1s = version.split(".");
    const v2s = latestVersion.split(".");
    const arr = v1s.reduce((acc, v1, index) => {
      const v2 = v2s[index];
      const vdiff = subVersions(v1, v2);
      const num = vdiff >= 0 ? vdiff : 0;
      acc.push(num);
      return acc;
    }, []);
    return arr.join(".");
  };

  if (typeof name !== "string") {
    return Promise.reject(new Error("package name required"));
  }
  const fullUrl = [registryUrl(), name.toLowerCase()].join("");
  return got(fullUrl)
    .then((data) => {
      const dataParsed = JSON.parse(data.body);
      const name = dataParsed.name || "";
      const time = dataParsed.time || {};
      const allVersions = versionsFor(time);
      const sortedVersions = sortVersions(allVersions || []);
      const versions = sortedVersions.slice(-5);
      const latestRawVersion = sortedVersions[sortedVersions.length - 1];
      const version = cleanVersion(rawVersion);
      const latestVersion = cleanVersion(latestRawVersion);

      const latestVersionDt = time["" + latestVersion];
      const latestVersionDate = dateFor(latestVersionDt) || "";

      const versionDt = time["" + version];
      const versionDate = dateFor(versionDt) || "";
      const description = dataParsed.description || "";
      const license = dataParsed.license || "";
      const homepage = dataParsed.homepage || "";
      const daysBehindLatestVersion = dayDiff(versionDt, latestVersionDt) || 0;

      const authorName =
        dataParsed.author?.name ||
        maintainerNames(dataParsed.maintainers) ||
        "";

      const semVerDiff = calcSemVersionDiff(version, latestVersion);
      const versionDiff = versionCalcDiff(version, latestVersion);
      let [majorDiff, minorDiff, patchDiff] = versionDiff.split(".");
      majorDiff = parseInt(majorDiff || 0);
      minorDiff = parseInt(minorDiff || 0);
      patchDiff = parseInt(patchDiff || 0);

      let { names, packages, categories } = opts;
      const defaultRules = opts;
      let rules = defaultRules;
      packages = packages || {};
      // override default rules with category rules if present
      if (categories) {
        const catRulesObj = categories.rules || {};
        const catList = categories.list || {};
        const keys = Object.keys(catList || []);
        for (let catName of keys) {
          const catPkgList = catList[catName] || [];
          const catRule = catRulesObj[catName] || {};
          for (pkgName of catPkgList) {
            packages[pkgName] = catRule;
          }
        }
      }
      // override default rules with package specific rules if present
      if (packages) {
        const packageRules = packages[name] || {};
        rules = {
          ...defaultRules,
          ...packageRules,
        };
      }
      let { maxSVD, maxDays, maxPatchDiff, maxMinorDiff, maxMajorDiff } = rules;

      const invalidMajorDiff =
        maxMajorDiff && parseInt(maxMajorDiff) < majorDiff;
      const invalidMinorDiff =
        !invalidMajorDiff && maxMinorDiff && parseInt(maxMinorDiff) < minorDiff;
      const invalidPatchDiff =
        !invalidMinorDiff && maxPatchDiff && parseInt(maxPatchDiff) < patchDiff;

      const invalidVersionDiff = versionDiffTooLarge(maxSVD, semVerDiff);
      const invalidVersionDateDiff = daysBehindLatestVersion > maxDays;

      const invalidDetailDiff =
        invalidMajorDiff || invalidMinorDiff || invalidPatchDiff;
      const invalid =
        invalidDetailDiff || (invalidVersionDiff && invalidVersionDateDiff);

      const baseOutput = {
        name,
        version,
        versionDate,
        semVerDiff,
        versionDiff,
        majorDiff,
        minorDiff,
        patchDiff,
        latestVersion,
        latestVersionDate,
        daysBehindLatestVersion,
        invalid,
      };

      const verboseOutput = {
        // time,
        description,
        license,
        homepage,
        author: authorName,
        versions,
      };
      if (names) {
        return {
          name,
          invalid,
        };
      }

      const output = {
        verbose: { ...baseOutput, ...verboseOutput },
        normal: baseOutput,
      };

      return opts.verbose ? output.verbose : output.normal;
    })
    .catch(function (err) {
      if (err.statusCode === 404) {
        err.message = "Package doesn't exist";
      }

      throw err;
    });
};
