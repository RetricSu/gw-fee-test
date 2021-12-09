import { HexNumber, HexString } from "@ckb-lumos/base";
import Web3 from "web3";
import crypto from "crypto";
import keccak256 from "keccak256";
import { AbiItems, PolyjuiceConfig } from "@polyjuice-provider/base";
import PolyjuiceHttpProvider, {
  PolyjuiceAccounts,
} from "@polyjuice-provider/web3";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
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