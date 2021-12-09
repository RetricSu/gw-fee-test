# How to run

pass `test-accounts.json` in project root dir. you can checkout the `test-accounts-example.json` for ref (the account id is optional, though).

commands for different environments

```json
    "start:alphanet": "ENV_PATH=./.alphanet.env ts-node ./src/index.ts",
    "start:devnet": "ENV_PATH=./.devnet.env ts-node ./src/index.ts",
    "start:testnet": "ENV_PATH=./.testnet.env ts-node ./src/index.ts",
    "start:mainnet": "ENV_PATH=./.mainnet.env ts-node ./src/index.ts",
```

```sh
MAX_ACCOUNTS=20 yarn start:devnet
```

the `MAX_ACCOUNTS` can be set from env to control how many accounts used for sending transaction to run the fee test.
