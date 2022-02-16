import { FeeTest } from "../fee";
import {
  getNonce,
  JsonRpcPayload,
  JsonRpcPayloadParams,
  requestBatchRpc,
} from "../helper";
import {
  AccountInfo,
  batchExecute,
  buildCallContractSerializedTransaction,
  ContractAccountInfo,
  initAccountsInfo,
  initContractAccountInfo,
} from "../txs";
import crypto from "crypto";

export class ApiTest extends FeeTest {
  public contractAddress: string = null;

  async initAccountsInfo() {
    if (this.testAccounts.length === 0) {
      console.log("zero test accounts, please try prepareTestAccounts first!");
      return [];
    }

    console.log(
      `load ${this.testAccounts.length} accounts, ready to test with ${
        process.env.MAX_ACCOUNT || this.testAccounts.length
      }.`
    );

    const testAccounts = this.testAccounts.slice(
      0,
      +process.env.MAX_ACCOUNT || this.testAccounts.length
    );
    const accountInfos = await batchExecute(testAccounts, initAccountsInfo);
    return accountInfos;
  }

  async run() {
    console.log("---- Run Test1 ----");
    await this.prepareContract();

    const method = "poly_executeRawL2Transaction";
    const accountInfos = await this.initAccountsInfo();
    const contractAccount = await initContractAccountInfo(this.contractAddress);

    const duplicateParamsListLength = +process.env.TOTAL_DUPLICATE || 1000;
    const duplicateWrongParamsListLength =
      +process.env.TOTAL_WRONG_DUPLICATE || 1000;

    const prepareUniqueRawTxResults = async (accountInfos: AccountInfo[]) => {
      const rawTxResults = [];
      const rawTxResPromises = accountInfos.map(async (account, _index) => {
        return await callBalanceOfTransaction(account, contractAccount);
      });

      for (const rawTxResPromise of rawTxResPromises) {
        const res = await rawTxResPromise;
        rawTxResults.push(res);
      }

      return rawTxResults;
    };

    const differentRawTxResults = await batchExecute(
      accountInfos,
      prepareUniqueRawTxResults
    );

    // send unique correct call balanceOf
    console.log("send unique correct call balanceOf");
    const paramsList = differentRawTxResults.map((val) => [val.rawTx]);
    await sendAllPayloads(method, paramsList);

    // send duplicate correct call balanceOf(so that apis can cache)
    console.log(
      "send duplicate correct call balanceOf(so that apis can cache)"
    );
    const duplicateParamsList = new Array(duplicateParamsListLength).fill(
      paramsList[0]
    );
    await sendAllPayloads(method, duplicateParamsList);

    // send duplicate wrong call balanceOf(so that apis can cache)
    console.log("send duplicate wrong call balanceOf(so that apis can cache)");
    const prepareWrongParamsList = async (accountInfos: AccountInfo[]) => {
      const account = accountInfos[0];
      const rawTxRes = await callBalanceOfWrongTransaction(
        account,
        contractAccount
      );
      return new Array(duplicateWrongParamsListLength)
        .fill(rawTxRes)
        .map((d) => [d.rawTx]);
    };
    const duplicateWrongParamsList = await prepareWrongParamsList(accountInfos);
    await sendAllPayloads(method, duplicateWrongParamsList);
  }
}

export async function callBalanceOfTransaction(
  account: AccountInfo,
  contractAccount: ContractAccountInfo
) {
  try {
    const simpleErc20BalanceOfData = `0x70a08231000000000000000000000000${account.polyjuiceAddress.slice(
      2
    )}`;
    const tx = {
      from: account.ethAddress,
      to: contractAccount.address,
      data: simpleErc20BalanceOfData,
      gasPrice: "0x00",
      gas: "0xffffff",
      value: "0x0",
    };
    const nonce = await getNonce(account.accountId);
    const rawTx = buildCallContractSerializedTransaction(
      account,
      contractAccount,
      tx,
      nonce
    );
    const rawTxRes = {
      rawTx: rawTx,
      accountId: parseInt(account.accountId),
      nonce: parseInt(nonce),
    };
    return rawTxRes;
  } catch (error) {
    console.log(
      `account ${account.ethAddress} prepare raw tx failed, err: ${error.message}`
    );
  }
}

export async function callBalanceOfWrongTransaction(
  account: AccountInfo,
  contractAccount: ContractAccountInfo
) {
  try {
    const simpleErc20BalanceOfData = `0x70a08232000000000000000000000000${account.polyjuiceAddress.slice(
      2
    )}`;
    const tx = {
      from: account.ethAddress,
      to: contractAccount.address,
      data: simpleErc20BalanceOfData,
      gasPrice: "0x00",
      gas: "0xffffff",
      value: "0x0",
    };
    const nonce = await getNonce(account.accountId);
    const rawTx = buildCallContractSerializedTransaction(
      account,
      contractAccount,
      tx,
      nonce
    );
    const rawTxRes = {
      rawTx: rawTx,
      accountId: parseInt(account.accountId),
      nonce: parseInt(nonce),
    };
    return rawTxRes;
  } catch (error) {
    console.log(
      `account ${account.ethAddress} prepare raw tx failed, err: ${error.message}`
    );
  }
}

export function genPayloads(
  method: string,
  paramsList: JsonRpcPayloadParams[]
) {
  const payloads: JsonRpcPayload[] = [];
  for (let i = 0; i < paramsList.length; i++) {
    const params = paramsList[i];
    const payload = {
      jsonrpc: "2.0",
      method,
      params,
      id: "0x" + crypto.randomBytes(8).toString("hex"),
    } as JsonRpcPayload;
    payloads.push(payload);
  }
  return payloads;
}

export function genBatchPayloads(
  method: string,
  paramsList: JsonRpcPayloadParams[],
  chunkSize: number = 20
) {
  const batchPayloadsList: JsonRpcPayload[][] = [];
  for (let i = 0; i < paramsList.length; i += chunkSize) {
    const chunkParams = paramsList.slice(i, i + chunkSize);
    const batchPayload = chunkParams.map((params) => {
      return {
        jsonrpc: "2.0",
        method,
        params,
        id: "0x" + crypto.randomBytes(8).toString("hex"),
      } as JsonRpcPayload;
    });
    batchPayloadsList.push(batchPayload);
  }
  return batchPayloadsList;
}

export function sendAllPayloads(
  method: string,
  paramsList: JsonRpcPayloadParams[]
) {
  const payloads = genPayloads(method, paramsList);
  const p = payloads.map(async (payload) => await requestBatchRpc([payload]));
  return Promise.all(p);
}
