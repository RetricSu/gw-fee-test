import { AbiItems } from "@polyjuice-provider/base";
import { TestAccount } from ".";
import SudtContractArtifacts from "../../contracts/erc20.json";
import { Tester } from "./base";
import { deployContract, getWeb3 } from "./helper";

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

  async run() {
    const that = this;

    if (this.contractAddress == null) {
      this.contractAddress = await deployContract(
        ABI,
        BYTE_CODE,
        DEPLOY_ARGS,
        this.testAccounts[0].privateKey
      );
      console.log("successful deploy contract =>", this.contractAddress);
    }

    const gasPrice = await getGasPrice();
    const currentGasPrice = gasPrice === "1" ? "21000" : gasPrice;

    const lowGasPrice = (
      (BigInt(currentGasPrice) * BigInt(8)) /
      BigInt(10)
    ).toString(10);
    const evenGasPrice = (BigInt(currentGasPrice) * BigInt(1)).toString(10);
    const highGasPrice = (
      (BigInt(currentGasPrice) * BigInt(12)) /
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
              gasPrice: gasPriceList[gasPriceId],
            });
          const date2 = new Date();
          const diffInMilSecs = date2.getTime() - date1.getTime();
          const result: ExecuteFeeResult = {
            receipt,
            gasPrice: gasPriceList[gasPriceId],
            gasPriceType: getGasPriceTypeById(gasPriceId),
            executeTimeInMilSecs: diffInMilSecs,
          };
          console.log(
            `account ${index} finished, gasPrice: ${result.gasPrice}, time: ${result.executeTimeInMilSecs}m`
          );
          return resolve(result);
        } catch (error) {
          return reject(error);
        }
      }) as Promise<ExecuteFeeResult>;

      executePromiseList.push(receiptTime);
    }
    return Promise.all(executePromiseList)
      .then((results) => {
        // results.forEach((result) => {
        //   console.debug(
        //     `execute result => gasPrice ${result.gasPrice}, time: ${result.executeTimeInMilSecs} milsecs`
        //   );
        // });
        return Promise.resolve(results);
      })
      .catch((err) => {
        console.log("err =>", err);
        return Promise.reject(err);
      });
  }
}

export async function outputTestReport(results: ExecuteFeeResult[]) {
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
