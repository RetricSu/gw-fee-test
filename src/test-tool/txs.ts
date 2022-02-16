import {
  TestAccount,
  getProvider,
  getAccountId,
  getScriptHashByShortAddress,
} from "./helper";
import {
  AbiItems,
  encodeArgs,
  EthTransaction,
  Signer,
  buildL2TransactionWithAddressMapping,
  buildRawL2TransactionWithAddressMapping,
} from "@polyjuice-provider/base";
import { HexNumber, HexString } from "@ckb-lumos/base";

export interface AccountInfo extends TestAccount {
  scriptHash: HexString;
  polyjuiceAddress: HexString;
  accountId: HexNumber;
}

export interface ContractAccountInfo {
  address: HexString;
  scriptHash: HexString;
  accountId: HexNumber;
  abi?: AbiItems;
}

const godwoker = getProvider().godwoker;

export async function batchExecute<T, K>(
  data: T[],
  executeFunction: (data: T[]) => Promise<K[]>,
  chunkSize: number = 120
) {
  const result: K[] = [];
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunkData = data.slice(i, i + chunkSize);
    const chunkResult = await executeFunction(chunkData);
    result.push(...chunkResult);
  }
  console.log(
    `batch execute ${executeFunction.name}, result size: ${result.length}`
  );
  return result;
}

export async function initAccountsInfo(accounts: TestAccount[]) {
  await godwoker.init();
  const accountInfos: AccountInfo[] = [];
  const accountInfoPromises: Promise<AccountInfo>[] = accounts.map(
    async (account, _id) => {
      try {
        const scriptHash = godwoker.computeScriptHashByEoaEthAddress(
          account.ethAddress
        );
        const polyjuiceAddress = scriptHash.slice(0, 42);
        const accountId = await getAccountId(scriptHash);
        return {
          ...account,
          ...{
            scriptHash,
            polyjuiceAddress,
            accountId,
          },
        } as AccountInfo;
      } catch (error) {
        console.log(
          `init account info failed ${account.ethAddress}, err: ${error.message}`
        );
      }
    }
  );
  for (const accountInfoPromise of accountInfoPromises) {
    const accountInfo = await accountInfoPromise;
    accountInfos.push(accountInfo);
  }
  return accountInfos;
}

export async function initContractAccountInfo(address: HexString) {
  await godwoker.init();
  try {
    const scriptHash = await getScriptHashByShortAddress(address);
    if (scriptHash == null) {
      throw new Error(
        `account ${address} has no scriptHash, please deposit first`
      );
    }
    const accountId = await getAccountId(scriptHash);
    if (accountId == null) {
      throw new Error(
        `account ${address} has no accountId, please deposit first`
      );
    }
    console.log(`init contract account info ${address}`);
    return {
      address,
      scriptHash,
      accountId,
    } as ContractAccountInfo;
  } catch (error) {
    const msg = `init contract account info failed ${address}, err: ${JSON.stringify(
      error
    )}`;
    console.log(msg);
    throw new Error(msg);
  }
}

export function buildSendContractSerializedTransaction(
  caller: AccountInfo,
  contract: ContractAccountInfo,
  ethTx: EthTransaction,
  nonce: string
) {
  const args = encodeArgs(ethTx);
  const rawL2Tx = {
    from_id: caller.accountId,
    to_id: contract.accountId,
    args,
    nonce,
  };
  const msg = godwoker.generateTransactionMessageToSign(
    rawL2Tx,
    caller.scriptHash,
    contract.scriptHash
  );
  const signer = new Signer(caller.privateKey);
  const _signature = signer.sign_with_private_key(msg);
  const signature = godwoker.packSignature(_signature);
  const l2Tx = { raw: rawL2Tx, signature };
  const polyL2Tx = buildL2TransactionWithAddressMapping(l2Tx, []);
  return godwoker.serializeL2TransactionWithAddressMapping(polyL2Tx);
}

export function buildCallContractSerializedTransaction(
  caller: AccountInfo,
  contract: ContractAccountInfo,
  ethTx: EthTransaction,
  nonce: string
): HexString {
  const args = encodeArgs(ethTx);
  const rawL2Tx = {
    from_id: caller.accountId,
    to_id: contract.accountId,
    args,
    nonce,
  };
  const polyL2Tx = buildRawL2TransactionWithAddressMapping(rawL2Tx, []);
  return godwoker.serializeRawL2TransactionWithAddressMapping(polyL2Tx);
}
