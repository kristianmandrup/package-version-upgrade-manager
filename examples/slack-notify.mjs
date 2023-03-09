import { WebClient } from "@slack/web-api";
import { getPackageInfo } from "package-version-upgrade-manager";

// Read a token from the environment variables
const token = process.env.SLACK_TOKEN;

// Initialize
const web = new WebClient(token);

// Given some known conversation ID (representing a public channel, private channel, DM or group DM)
const conversationId = "...";

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
