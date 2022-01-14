import { HexNumber, HexString } from "@ckb-lumos/base";
import Web3 from "web3";
import crypto from "crypto";
import keccak256 from "keccak256";
import {
  AbiItems,
  PolyjuiceConfig,
  EthTransactionReceipt,
} from "@polyjuice-provider/base";
import PolyjuiceHttpProvider, {
  PolyjuiceAccounts,
} from "@polyjuice-provider/web3";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { privKeys as predefinePrivateKeys } from "../configs/predefine-accounts";
import fetch from "cross-fetch";
const Contract = require("web3-eth-contract");

dotenv.config({
  path: path.resolve(process.env.ENV_PATH ?? "../../.env"),
});

const { web3_rpc } = process.env;

export interface TestAccount {
  ethAddress: HexString;
  privateKey: HexString;
  accountId?: null | HexNumber;
}

export interface JsonRpcPayload {
  jsonrpc: "2.0" | "1.0";
  method: string;
  params: any[];
  id: string | number;
}

export function newEthAccountList(length: number = 20) {
  return [...Array(length)].map((_) => generateEthAccount());
}

export function generateEthAccount() {
  const web3 = new Web3();
  const privateKey = web3.utils.randomHex(32);
  const account = web3.eth.accounts.privateKeyToAccount(privateKey);
  return {
    ethAddress: account.address,
    privateKey: account.privateKey,
  };
}

export function privateKeyToEthAddress(privateKey) {
  const ecdh = crypto.createECDH(`secp256k1`);
  ecdh.generateKeys();
  ecdh.setPrivateKey(Buffer.from(privateKey.slice(2), "hex"));
  const publicKey = "0x" + ecdh.getPublicKey("hex", "uncompressed");
  const _ethAddress =
    "0x" +
    keccak256(Buffer.from(publicKey.slice(4), "hex"))
      .slice(12)
      .toString("hex");
  return _ethAddress;
}

export async function deployContract(
  abiItems: AbiItems,
  byteCode: string,
  args: any[],
  privateKey: HexString
) {
  const { Contract } = getWeb3(privateKey);
  const ethAddress = privateKeyToEthAddress(privateKey);

  const deployTx = new Contract(abiItems)
    .deploy({
      data: byteCode,
      arguments: args,
    })
    .send({
      from: ethAddress,
    });
  const contract = await deployTx;
  return contract.options.address;
}

export function getWeb3(privateKey?: string, abiItems_?: AbiItems) {
  const abiItems = abiItems_ || [];
  const polyjuiceConfig: PolyjuiceConfig = {
    web3Url: web3_rpc,
    abiItems,
  };
  const polyjuiceHttpProvider = new PolyjuiceHttpProvider(
    polyjuiceConfig.web3Url,
    polyjuiceConfig
  );
  const web3 = new Web3(polyjuiceHttpProvider);
  const polyjuiceAccounts = new PolyjuiceAccounts(
    polyjuiceConfig,
    polyjuiceHttpProvider
  );
  web3.eth.accounts = polyjuiceAccounts;
  if (privateKey != null) {
    web3.eth.accounts.wallet.add(privateKey);
  }
  Contract.setProvider(polyjuiceHttpProvider, web3.eth.accounts);
  return { web3, Contract, polyjuiceHttpProvider, polyjuiceAccounts };
}

export function getProvider(abiItems_?: AbiItems) {
  const abiItems = abiItems_ || [];
  const polyjuiceConfig: PolyjuiceConfig = {
    web3Url: web3_rpc,
    abiItems,
  };
  const polyjuiceHttpProvider = new PolyjuiceHttpProvider(
    polyjuiceConfig.web3Url,
    polyjuiceConfig
  );
  return polyjuiceHttpProvider;
}

export async function loadJsonFile(
  path: string,
  encoding?: BufferEncoding
): Promise<Object | null> {
  try {
    const data = await fs.readFileSync(path);
    if (encoding) {
      const data_json = JSON.parse(data.toString(encoding));
      return data_json;
    }
    const data_json = JSON.parse(data.toLocaleString());
    return data_json;
  } catch (error) {
    console.error(`json file not exist, err: ${error.message}`);
    return null;
  }
}

export async function saveJsonFile(jsonObj: Object, path: string) {
  const data = JSON.stringify(jsonObj, null, 2);
  try {
    await fs.writeFileSync(path, data);
    return true;
  } catch (error) {
    console.error(`can not save the json file, err: ${error.message}`);
    return false;
  }
}

export async function generateAlphaNetAccounts() {
  const jsonData: TestAccount[] = [];
  for (const key of predefinePrivateKeys) {
    const address = privateKeyToEthAddress(key);
    const testAccount: TestAccount = {
      ethAddress: address,
      privateKey: key,
    };
    jsonData.push(testAccount);
  }
  const filePath = path.resolve(__dirname, "../../test-accounts.json");
  await saveJsonFile(jsonData, filePath);
}

export function asyncSleep(ms = 0) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function requestRpc(payload: object | object[]) {
  const res = await fetch(web3_rpc, {
    body: JSON.stringify(payload),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "POST",
    keepalive: true,
  });
  const result: any[] | any = await res.json();
  return result;
}

export async function requestBatchRpc(batchPayload: object[]) {
  const result: any[] = await requestRpc(batchPayload);
  const successResult = result.filter(
    (r) => !r.error && r.result && typeof r.result === "string"
  );
  const failedResult = result.filter((r) => r.error);
  if (failedResult.length > 0) {
    console.log(failedResult);
  }
  console.log(`(${successResult.length}/${result.length})`);
  return result.map((r) => {
    if (r.error) {
      return null;
    }
    return r.result;
  });
}

export async function getTransactionReceipt(
  txHash: string
): Promise<EthTransactionReceipt> {
  const payload = {
    jsonrpc: "2.0",
    method: "eth_getTransactionReceipt",
    params: [txHash],
    id: "0x" + crypto.randomBytes(8).toString("hex"),
  };
  const res = await requestRpc(payload);
  if (res.error) {
    throw new Error(res.error);
  }
  return res.result;
}

export async function getAccountId(scriptHash: string): Promise<string | null> {
  const payload = {
    jsonrpc: "2.0",
    method: "gw_get_account_id_by_script_hash",
    params: [scriptHash],
    id: "0x" + crypto.randomBytes(8).toString("hex"),
  };
  const res = await requestRpc(payload);
  if (res.error) {
    throw new Error(res.error);
  }
  return res.result;
}

export async function getScriptHashByShortAddress(shortAddr: string) {
  const payload = {
    jsonrpc: "2.0",
    method: "gw_get_script_hash_by_short_address",
    params: [shortAddr],
    id: "0x" + crypto.randomBytes(8).toString("hex"),
  };
  const res = await requestRpc(payload);
  if (res.error) {
    throw new Error(res.error);
  }
  return res.result;
}

export async function getNonce(accountId: HexNumber) {
  const payload = {
    jsonrpc: "2.0",
    method: "gw_get_nonce",
    params: [accountId],
    id: "0x" + crypto.randomBytes(8).toString("hex"),
  };
  const res = await requestRpc(payload);
  if (res.error) {
    throw new Error(res.error);
  }
  return res.result as HexNumber;
}
