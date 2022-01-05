import { AbiItems } from "@polyjuice-provider/base";
import { TestAccount } from ".";
import SudtContractArtifacts from "../../contracts/erc20.json";
import { Tester } from "./base";
import { deployContract, getWeb3 } from "./helper";
import fs from "fs";

const DEFAULT_MINI_CURRENT_GAS_PRICE = "200"; // only used when rpc gas price return 0x1;
// 3 grades of gas price rate: price * RATE / 10;
const LOW_RATE_IN_10 = 5;
const HIGH_RATE_IN_10 = 20;
const EVEN_RATE_IN_10 = 11;

const ERC20_NAME = "test";
const ERC20_SYMBOL = "tt";
const ERC20_TOTAL_SUPPLY = "160000000000000000000000000000";
const ERC20_SUDT_ID = 1;

const ABI = SudtContractArtifacts.abi as AbiItems;
const BYTE_CODE = SudtContractArtifacts.bytecode;
const DEPLOY_ARGS = [
  ERC20_NAME,
  ERC20_SYMBOL,
  ERC20_TOTAL_SUPPLY,
  ERC20_SUDT_ID,
];

export enum GasPriceType {
  Low,
  Even,
  High,
}

export function getGasPriceTypeById(id: number) {
  if (id > 2) {
    throw new Error("invalid id for gasPriceType.");
  }
  const GasPriceTypeMap = [
    GasPriceType.Low,
    GasPriceType.Even,
    GasPriceType.High,
  ];
  return GasPriceTypeMap[id];
}

export interface ExecuteFeeResult {
  receipt: any;
  gasPrice: string;
  gasPriceType: GasPriceType;
  executeTimeInMilSecs: number;
}

export class FeeTest extends Tester {
  public contractAddress: string = null;

  async prepareContract() {
    if (this.contractAddress == null) {
      // use the provide contract
      if (process.env.ERC20_ADDRESS != null) {
        this.contractAddress = process.env.ERC20_ADDRESS;
        console.log("use contract from env =>", this.contractAddress);
      } else {
        this.contractAddress = await deployContract(
          ABI,
          BYTE_CODE,
          DEPLOY_ARGS,
          this.testAccounts[0].privateKey
        );
        console.log("successful deploy contract =>", this.contractAddress);

        // write the contract address to env for use next time
        await fs.appendFileSync(
          process.env.ENV_PATH,
          `\nERC20_ADDRESS=${this.contractAddress}`
        );
      }
    }
  }

  async run() {
    console.log("---- Run Test1 ----");
    const that = this;

    await this.prepareContract();

    const gasPrice = await getGasPrice();
    const currentGasPrice =
      gasPrice === "1" ? DEFAULT_MINI_CURRENT_GAS_PRICE : gasPrice;

    const lowGasPrice = (
      (BigInt(currentGasPrice) * BigInt(LOW_RATE_IN_10)) /
      BigInt(10)
    ).toString(10);
    const evenGasPrice = (
      (BigInt(currentGasPrice) * BigInt(EVEN_RATE_IN_10)) /
      BigInt(10)
    ).toString(10);
    const highGasPrice = (
      (BigInt(currentGasPrice) * BigInt(HIGH_RATE_IN_10)) /
      BigInt(10)
    ).toString(10);
    const gasPriceList = [lowGasPrice, evenGasPrice, highGasPrice];

    console.log("gasPriceList", gasPriceList);

    if (this.testAccounts.length === 0) {
      console.log("zero test accounts, please try prepareTestAccounts first!");
      return [];
    }

    console.log(
      `load ${this.testAccounts.length} accounts, ready to test with ${
        process.env.MAX_ACCOUNT || this.testAccounts.length
      }.`
    );
    let executePromiseList: Promise<ExecuteFeeResult>[] = [];
    let counter: number = 0;
    for (const [index, account] of Object.entries(this.testAccounts)) {
      if (
        process.env.MAX_ACCOUNT != null &&
        +index > +process.env.MAX_ACCOUNT
      ) {
        // control max accounts used for test from env
        continue;
      }

      if (+index >= 3 && +index % 3 === 0) {
        counter = 0;
      }
      const gasPriceId = counter;
      counter++;

      const gasPrice = gasPriceList[gasPriceId];
      const gasPriceType = getGasPriceTypeById(gasPriceId);

      const { Contract } = getWeb3(account.privateKey, ABI);
      const contract = new Contract(ABI, this.contractAddress);

      const receiptTime = new Promise(async (resolve, reject) => {
        try {
          const date1 = new Date();
          const nextAccount: TestAccount =
            +index + 1 === that.testAccounts.length
              ? that.testAccounts[0]
              : that.testAccounts[index];
          const receipt = await contract.methods
            .transfer(nextAccount.ethAddress, 1)
            .send({
              from: account.ethAddress,
              gasPrice: gasPrice,
            });
          const date2 = new Date();
          const diffInMilSecs = date2.getTime() - date1.getTime();
          const result: ExecuteFeeResult = {
            receipt,
            gasPrice: gasPrice,
            gasPriceType: gasPriceType,
            executeTimeInMilSecs: diffInMilSecs,
          };
          console.log(
            `account ${index} finished, gasPrice: ${result.gasPrice}, time: ${result.executeTimeInMilSecs}ms`
          );
          return resolve(result);
        } catch (error) {
          console.log(`account ${index} failed, gasPrice: ${gasPrice}. err: ${error.message}`);
          return reject(error);
        }
      }) as Promise<ExecuteFeeResult>;

      executePromiseList.push(receiptTime);
    }
    return Promise.allSettled(executePromiseList);
  }

  async runTest2() {
    console.log("---- Run Test2 ----");
    const that = this;

    await this.prepareContract();

    const gasPrice = await getGasPrice();
    const currentGasPrice =
      gasPrice === "1" ? DEFAULT_MINI_CURRENT_GAS_PRICE : gasPrice;

    const lowGasPrice = (
      (BigInt(currentGasPrice) * BigInt(LOW_RATE_IN_10)) /
      BigInt(10)
    ).toString(10);
    const evenGasPrice = (
      (BigInt(currentGasPrice) * BigInt(EVEN_RATE_IN_10)) /
      BigInt(10)
    ).toString(10);
    const highGasPrice = (
      (BigInt(currentGasPrice) * BigInt(HIGH_RATE_IN_10)) /
      BigInt(10)
    ).toString(10);
    const gasPriceList = [lowGasPrice, evenGasPrice, highGasPrice];

    console.log("gasPriceList", gasPriceList);

    if (this.testAccounts.length < 3) {
      console.log(
        "need more than 3 test accounts, please try prepareTestAccounts first!"
      );
      return [];
    }

    console.log(
      `load ${this.testAccounts.length} accounts, ready to test with 3.`
    );

    const lowGasPriceResults = [];
    const highGasPriceResults = [];
    const evenGasPriceResults = [];

    const executeNumber = process.env.EXECUTE_NUMBER
      ? +process.env.EXECUTE_NUMBER
      : 10;

    const executeOneRow = async () => {
      const txs = [];
      for (const index of [0, 1, 2]) {
        const account = this.testAccounts[index];
        const gasPrice = gasPriceList[index];
        const sendTx = new Promise(async (resolve, reject) => {
          try {
            const { Contract } = getWeb3(account.privateKey, ABI);
            const contract = new Contract(ABI, this.contractAddress);

            const date1 = new Date();
            const nextAccount: TestAccount =
              +index + 1 === that.testAccounts.length
                ? that.testAccounts[0]
                : that.testAccounts[index];
            const receipt = await contract.methods
              .transfer(nextAccount.ethAddress, 1)
              .send({
                from: account.ethAddress,
                gasPrice: gasPrice,
              });
            const date2 = new Date();
            const diffInMilSecs = date2.getTime() - date1.getTime();

            const gasPriceType = getGasPriceTypeById(index);

            switch (gasPriceType) {
              case GasPriceType.Low:
                lowGasPriceResults.push(diffInMilSecs);
                break;

              case GasPriceType.Even:
                evenGasPriceResults.push(diffInMilSecs);
                break;

              case GasPriceType.High:
                highGasPriceResults.push(diffInMilSecs);
                break;

              default:
                throw new Error(`undefined gasPriceType. ${gasPriceType}`);
            }

            console.log(
              `account ${index} finished, gasPrice: ${gasPrice}, time: ${diffInMilSecs}ms`
            );

            return resolve(receipt);
          } catch (error) {
            console.log(`account ${index} failed, gasPrice: ${gasPrice}.`);
            return reject(error);
          }
        });
        txs.push(sendTx);
      }
      return Promise.allSettled(txs);
    };

    for (const i of [...Array(executeNumber).keys()]) {
      console.log(`=== start ${i + 1}th row ===`);
      await executeOneRow();
    }

    console.log(
      `lowGas Result => average: ${calAverageTime(
        lowGasPriceResults
      )} milsecs,`,
      lowGasPriceResults
    );
    console.log(
      `highGas Result => average: ${calAverageTime(
        highGasPriceResults
      )} milsecs,`,
      highGasPriceResults
    );
    console.log(
      `evenGas Result => average: ${calAverageTime(
        evenGasPriceResults
      )} milsecs,`,
      evenGasPriceResults
    );
  }
}

export function calAverageTime(data: number[]) {
  const sum = data.reduce((partial_sum, a) => partial_sum + a, 0);
  return sum / data.length;
}

export async function outputTestReport(
  settleResults: PromiseSettledResult<ExecuteFeeResult>[]
) {
  const results = settleResults
    .filter((r) => r.status === "fulfilled")
    .map((r: PromiseFulfilledResult<ExecuteFeeResult>) => {
      return r.value;
    });
  const sortResult = results.sort(
    (a, b) => a.executeTimeInMilSecs - b.executeTimeInMilSecs
  );
  console.log("");
  console.log("======= execute results =======");
  sortResult.forEach((result) => {
    console.debug(
      `=> gasPrice ${result.gasPrice}, time: ${result.executeTimeInMilSecs} milsecs`
    );
  });
}

export async function getGasPrice() {
  const { web3 } = getWeb3();
  const price = await web3.eth.getGasPrice();
  return price;
}
