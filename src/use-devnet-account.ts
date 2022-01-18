import {
  depositDevnetAccounts,
  generateDevnetAccounts,
} from "./test-tool/helper";

const run = async () => {
  await generateDevnetAccounts();
  await depositDevnetAccounts();
};

run();
