# How to run

pass `test-accounts.json` in project root dir. you can checkout the `test-accounts-example.json` for ref (the account id is optional, though).

commands for different environments

```json
    "start:alphanet": "ENV_PATH=./.alphanet.env ts-node ./src/index.ts",
    "start:devnet": "ENV_PATH=./.devnet.env ts-node ./src/index.ts",
    "start:testnet": "ENV_PATH=./.testnet.env ts-node ./src/index.ts",
    "start:mainnet": "ENV_PATH=./.mainnet.env ts-node ./src/index.ts",
```

## test

```sh
MAX_ACCOUNTS=20 EXECUTE_NUMBER=20 yarn start:devnet
```

the `MAX_ACCOUNTS` can be set from env to control how many accounts used for sending transaction to run the test 1.

the `EXECUTE_NUMBER` (default is 10) can be set from env to control how many rounds you want the 3 accounts to continually send transaction to run the test 2.
