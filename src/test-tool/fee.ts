import { AbiItems, EthTransactionReceipt } from "@polyjuice-provider/base";
import SudtContractArtifacts from "../../contracts/erc20.json";
import { Tester } from "./base";
import {
  TestAccount,
  deployContract,
  getWeb3,
  requestBatchRpc,
  getTransactionReceipt,
  JsonRpcPayload,
  getNonce,
} from "./helper";
import fs from "fs";
import crypto from "crypto";
import { asyncSleep } from ".";
import {
  AccountInfo,
  batchExecute,
  buildSendContractSerializedTransaction,
  initAccountsInfo,
  initContractAccountInfo,
} from "./txs";

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
  receipt: EthTransactionReceipt;
  gasPrice: string;
  gasPriceType: GasPriceType;
  executeTimeInMilSecs: number;
  accountId: number;
  nonce: number;
}

export interface RawTransactionResult {
  rawTx: string | null;
  gasPrice: string;
  gasPriceType: GasPriceType;
  accountId: number;
  nonce: number;
}

export interface SendTransactionResult {
  txReceipt: EthTransactionReceipt | null;
  gasPrice: string;
  gasPriceType: GasPriceType;
  executeTimeInMilSecs: number | null;
  accountId: number;
  nonce: number;
  err?: Error;
}

export interface ReceiptChecker {
  gasPrice: string;
  gasPriceType: GasPriceType;
  getTime: () => Promise<SendTransactionResult>;
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

  async runTest1() {
    console.log("---- Run Test4 ----");
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

    const pollTransactionReceiptTimeOutMilsec =
      +process.env.POLL_TX_RECEIPT_TIME_OUT || 60 * 1000; // time out for 1 minutes
    const pollTransactionIntervalMilsec =
      +process.env.POLL_TX_RECEIPT_INTERVAL || 5 * 1000; //try fetch receipt every 5s

    const testAccounts = this.testAccounts.slice(
      0,
      +process.env.MAX_ACCOUNT || this.testAccounts.length
    );
    const accountInfos = await batchExecute(testAccounts, initAccountsInfo);
    const contractAccount = await initContractAccountInfo(this.contractAddress);

    const prepareRawTxResults = async (accountInfos: AccountInfo[]) => {
      const rawTxResults: RawTransactionResult[] = [];
      const rawTxResPromises = accountInfos.map(async (account, index) => {
        const gasPriceId: number = index >= 3 ? index % 3 : index;
        const gasPrice = gasPriceList[gasPriceId];
        const gasPriceType = getGasPriceTypeById(gasPriceId);

        try {
          const simpleErc20Transfer1CkbData = `0xa9059cbb000000000000000000000000${account.polyjuiceAddress.slice(
            2
          )}0000000000000000000000000000000000000000000000000000000000000001`;
          const tx = {
            from: account.ethAddress,
            to: contractAccount.address,
            data: simpleErc20Transfer1CkbData,
            gasPrice: "0x" + BigInt(gasPrice).toString(16),
            gas: "0xffffff",
            value: "0x0",
          };
          const nonce = await getNonce(account.accountId);
          const rawTx = buildSendContractSerializedTransaction(
            account,
            contractAccount,
            tx,
            nonce
          );
          const rawTxRes: RawTransactionResult = {
            rawTx: rawTx,
            gasPrice,
            gasPriceType,
            accountId: parseInt(account.accountId),
            nonce: parseInt(nonce),
          };
          return rawTxRes;
        } catch (error) {
          console.log(
            `account ${account.ethAddress} prepare raw tx failed, err: ${error.message}, gasPriceType: ${gasPriceType}`
          );
        }
      });

      for (const rawTxResPromise of rawTxResPromises) {
        const res = await rawTxResPromise;
        rawTxResults.push(res);
      }

      return rawTxResults;
    };

    const rawTxResults = await batchExecute(accountInfos, prepareRawTxResults);
    console.log(
      `prepare ${rawTxResults.length} raw transactions, ready to batch send.`
    );

    const sendTxPromiseList: Promise<ExecuteFeeResult>[] = [];
    const divideBatchTxs = async (rawTxResults: RawTransactionResult[]) => {
      const chunkSize = 20;
      const batchPayloadsList: JsonRpcPayload[][] = [];
      const rawTxResultsList: RawTransactionResult[][] = [];
      for (let i = 0; i < rawTxResults.length; i += chunkSize) {
        const chunkTxs = rawTxResults.slice(i, i + chunkSize);
        const batchPayload = chunkTxs.map((res) => {
          return {
            jsonrpc: "2.0",
            method: "poly_submitL2Transaction",
            params: [res.rawTx],
            id: "0x" + crypto.randomBytes(8).toString("hex"),
          } as JsonRpcPayload;
        });
        batchPayloadsList.push(batchPayload);
        rawTxResultsList.push(chunkTxs);
      }
      return {
        batchPayloadsList,
        rawTxResultsList,
      };
    };

    const { batchPayloadsList, rawTxResultsList } = await divideBatchTxs(
      rawTxResults
    );
    const sendBatchTxs = async (
      batchPayloads: JsonRpcPayload[][],
      rawTxResultsList: RawTransactionResult[][]
    ) => {
      if (batchPayloads.length !== rawTxResultsList.length) {
        throw new Error("batchPayloads.length !== rawTxResultsList.length");
      }

      const receiptCheckers: ReceiptChecker[] = [];
      const receiptCheckerPromises = batchPayloads.map(
        async (payloads: JsonRpcPayload[], id) => {
          const rawTxResults = rawTxResultsList[id];

          const txHashes: Array<string | null> = await requestBatchRpc(
            payloads
          );
          const date1 = new Date();
          console.log(`send ${payloads.length} transactions in one Batch`);

          const chunkReceiptChecker = rawTxResults.map((rawTxResult, index) => {
            const txHash = txHashes[index];
            const fetchReceipt = new Promise(async (resolve, reject) => {
              try {
                let timeCounterMilsecs = 0;
                let txReceipt: EthTransactionReceipt;

                if (!txHash) {
                  const sendTxResult: SendTransactionResult = {
                    txReceipt: null,
                    gasPrice: rawTxResult.gasPrice,
                    gasPriceType: rawTxResult.gasPriceType,
                    executeTimeInMilSecs: null,
                    accountId: rawTxResult.accountId,
                    nonce: rawTxResult.nonce,
                    err: new Error(
                      `tx failed to submit. accountId: ${rawTxResult.accountId}, nonce: ${rawTxResult.nonce}, gasPrice: ${rawTxResult.gasPrice}`
                    ),
                  };
                  return resolve(sendTxResult);
                }

                while (true) {
                  try {
                    await asyncSleep(pollTransactionIntervalMilsec);
                    txReceipt = await getTransactionReceipt(txHash);
                    if (txReceipt != null) {
                      break;
                    }

                    timeCounterMilsecs += pollTransactionIntervalMilsec;
                    if (
                      timeCounterMilsecs > pollTransactionReceiptTimeOutMilsec
                    ) {
                      return reject(
                        new Error(
                          `accountId: ${rawTxResult.accountId}, nonce: ${rawTxResult.nonce}, gasPrice: ${rawTxResult.gasPrice}, time out in ${pollTransactionReceiptTimeOutMilsec} milliseconds. txHash: ${txHash}`
                        )
                      );
                    }
                  } catch (error) {
                    if ((error.message as string).startsWith("request to")) {
                      continue;
                    }
                    console.log(error.message);
                  }
                }

                const date2 = new Date();
                const diffInMilSecs = date2.getTime() - date1.getTime();
                const sendTxResult: SendTransactionResult = {
                  txReceipt: txReceipt,
                  gasPrice: rawTxResult.gasPrice,
                  gasPriceType: rawTxResult.gasPriceType,
                  executeTimeInMilSecs: diffInMilSecs,
                  accountId: rawTxResult.accountId,
                  nonce: rawTxResult.nonce,
                };
                return resolve(sendTxResult);
              } catch (error) {
                return reject(error);
              }
            });

            return {
              gasPrice: rawTxResult.gasPrice,
              gasPriceType: rawTxResult.gasPriceType,
              getTime: async () => {
                return fetchReceipt as Promise<SendTransactionResult>;
              },
            } as ReceiptChecker;
          });
          return chunkReceiptChecker;
        }
      );
      for (const checkerPromise of receiptCheckerPromises) {
        const checker = await checkerPromise;
        receiptCheckers.push(...checker);
      }
      return receiptCheckers;
    };
    const receiptCheckers = await sendBatchTxs(
      batchPayloadsList,
      rawTxResultsList
    );

    for (const receiptChecker of receiptCheckers) {
      const receiptTime = new Promise(async (resolve, reject) => {
        try {
          const res = await receiptChecker.getTime();
          if (res.err) {
            return reject(res.err);
          }
          const executeResult: ExecuteFeeResult = {
            receipt: res.txReceipt,
            gasPrice: res.gasPrice,
            gasPriceType: res.gasPriceType,
            executeTimeInMilSecs: res.executeTimeInMilSecs,
            accountId: res.accountId,
            nonce: res.nonce,
          };
          console.log(
            `account ${executeResult.accountId} finished, nonce: ${executeResult.nonce}, gasPrice: ${executeResult.gasPrice}, time: ${executeResult.executeTimeInMilSecs}ms`
          );
          return resolve(executeResult);
        } catch (error) {
          console.log(`account failed. err: ${error.message}`);
          return reject(error);
        }
      }) as Promise<ExecuteFeeResult>;
      sendTxPromiseList.push(receiptTime);
    }

    return Promise.allSettled(sendTxPromiseList);
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
  console.log(`======= execute results: ${sortResult.length} =======`);
  sortResult.forEach((result) => {
    console.debug(
      `=> account: ${result.accountId}, gasPrice ${result.gasPrice}, time: ${
        result.executeTimeInMilSecs
      } milsecs, status: ${result.receipt.status === "0x1"}, nonce: ${
        result.nonce
      }, txHash: ${result.receipt.transactionHash}`
    );
  });

  const rejectResult = settleResults.filter((r) => r.status === "rejected");
  console.log(`=== failed result: ${rejectResult.length} ===`);
  rejectResult.map((r: PromiseRejectedResult) => {
    console.log(`failed, ${r.reason}`);
    return r.reason;
  });
}

export async function getGasPrice() {
  const { web3 } = getWeb3();
  const price = await web3.eth.getGasPrice();
  return price;
}
