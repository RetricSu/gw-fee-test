import {
  FeeTest,
  loadJsonFile,
  outputTestReport,
  TestAccount,
} from "./test-tool";
import path from "path";

const { ENV_PATH } = process.env;

let filePath;
if (ENV_PATH === "./.devnet.env") {
  filePath = path.resolve(__dirname, "../devnet-test-accounts.json");
} else {
  filePath = path.resolve(__dirname, "../test-accounts.json");
}

const fee = async () => {
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
  try {
    const results = await test.run();
    await outputTestReport(results);

    await test.runTest2();
    process.exit(0);
  } catch (error) {
    console.log(error);
    process.exit(123);
  }
};

const run = async () => {
  await fee();
};

run();
