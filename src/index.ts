import {
  asyncSleep,
  FeeTest,
  loadJsonFile,
  outputTestReport,
  TestAccount,
} from "./test-tool";
import path from "path";

const { ENV_PATH, MODE, WAIT_INTERVAL_MILSEC, TEST_CASE, TIMEOUT_MS } =
  process.env;
const waitIntervalMilsec = parseInt(WAIT_INTERVAL_MILSEC) || 5000; // wait 5 seconds
const testcaseNumber = TEST_CASE ? parseInt(TEST_CASE) : 0;

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

const fee = async (test: FeeTest, testNumber: number = 0) => {
  try {
    switch (testNumber) {
      case 0:
        {
          const results = await test.runTest1();
          await outputTestReport(results);
          console.log("--------");
          console.log("");

          await test.runTest2();
          console.log("--------");
          console.log("");
        }
        break;

      case 1:
        {
          const results = await test.runTest1();
          await outputTestReport(results, test.gasPriceList);
          console.log("--------");
          console.log("");
        }
        break;

      case 2:
        {
          await test.runTest2();
          console.log("--------");
          console.log("");
        }
        break;

      default:
        console.log("invalid testcase number.");
        break;
    }
  } catch (error) {
    //console.log(error);
    process.exit(123);
  }
};

const execute = async (test: FeeTest) => {
  try {
    if (MODE === "forever") {
      await fee(test, testcaseNumber);
      await asyncSleep(waitIntervalMilsec);
      await execute(test);
    }

    return await fee(test, testcaseNumber);
  } catch (error) {
    //console.log(error);
  }
};

const run = async () => {
  if (TIMEOUT_MS) {
    const timeoutMilsecs = +TIMEOUT_MS;
    const timeoutSecs = +TIMEOUT_MS / 1000;
    setTimeout(() => {
      console.log(`reach timeout ${timeoutSecs}s, exit.`);
      process.exit(0);
    }, timeoutMilsecs);
  }

  const test = await initTest();
  try {
    await execute(test);
  } catch (error) {
    //console.log(error);
  }
};

run();
