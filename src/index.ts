import {
  asyncSleep,
  FeeTest,
  loadJsonFile,
  outputTestReport,
  TestAccount,
} from "./test-tool";
import path from "path";

const { ENV_PATH, MODE, WAIT_INTERVAL_MILSEC } = process.env;
const waitIntervalMilsec = parseInt(WAIT_INTERVAL_MILSEC) || 5000; // wait 5 seconds

let filePath;
if (ENV_PATH === "./.devnet.env") {
  filePath = path.resolve(__dirname, "../devnet-test-accounts.json");
} else {
  filePath = path.resolve(__dirname, "../test-accounts.json");
}

const initTest = async () => {
  const jsonData = await loadJsonFile(filePath);
  if (jsonData == null) {
    throw new Error("you must provide account json file!");
  }

  console.log(
    `load test accounts from json file. total accounts: ${
      (jsonData as TestAccount[]).length
    }`
  );

  const test = new FeeTest(jsonData as TestAccount[]);
  return test;
};

const fee = async (test: FeeTest) => {
  try {
    const results = await test.run();
    await outputTestReport(results);
    console.log("--------");
    console.log("");

    await test.runTest2();
    console.log("--------");
    console.log("");
  } catch (error) {
    console.log(error);
    process.exit(123);
  }
};

const run = async () => {
  const test = await initTest();
  await execute(test);
};

const execute = async (test: FeeTest) => {
  if (MODE === "forever") {
    await fee(test);
    await asyncSleep(waitIntervalMilsec);
    await execute(test);
  }

  return await fee(test);
};

run();
