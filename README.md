# How to run

commands for different environments

```json
    "start:alphanet": "ENV_PATH=./.alphanet.env ts-node ./src/index.ts",
    "start:devnet": "ENV_PATH=./.devnet.env ts-node ./src/index.ts",
    "start:testnet": "ENV_PATH=./.testnet.env ts-node ./src/index.ts",
    "start:mainnet": "ENV_PATH=./.mainnet.env ts-node ./src/index.ts",
```

## accounts

### devnet

pass `devnet-test-accounts.json` in project root dir. 

you can checkout the `test-accounts-example.json` for ref (the account id is optional, though).

### other testnet

```sh
yarn accounts
```

## test

- test1

every test accounts will send only one transaction in total with different gasPrice, then we output all the receipt time in ASC order.

- test2

only take first 3 accounts, each account use a fix gasPrice to send one transaction in a row, then we execute N rows to collect the average receipt time for these 3 accounts and output it.

by running the follow command, the test1 and test2 will be execute in order.

```sh
MAX_ACCOUNTS=20 EXECUTE_NUMBER=20 yarn start:devnet
```

the `MAX_ACCOUNTS` can be set from env to control how many accounts used for sending transaction to run the test 1.

the `EXECUTE_NUMBER` (default is 10) can be set from env to control how many rounds you want the 3 accounts to continually send transaction to run the test 2.

## forever mode (in ci/testnet/staging press test, etc)

just add `MODE=forever` in your environment, the test will run forever.

in forever mode, we execute one test1/test2, and then waits 5 seconds to execute the next round by default. if you want to change the wait interval time, you can set through .env variable too. just add `WAIT_INTERVAL_MILSEC=<milliseconds>` in your environment.

example:

```sh
MODE=forever WAIT_INTERVAL_MILSEC=7000 MAX_ACCOUNT=10 EXECUTE_NUMBER=3 yarn start:devnet
```
