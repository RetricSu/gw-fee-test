import { loadAccounts } from "./test-tool";
import { ApiTest } from "./test-tool/api/execute-raw-tx";

const initTest = async () => {
  const accounts = await loadAccounts();
  const test = new ApiTest(accounts);
  return test;
};

const run = async () => {
  const test = await initTest();
  await test.run();
};

run();
