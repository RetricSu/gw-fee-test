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

```sh
yarn account:devnet
```

require running [kicker](https://github.com/RetricSu/godwoken-kicker) on background.

### other testnet

```sh
yarn account
```

## test

- test1

every test accounts will send only one transaction in total with different gasPrice, then we output all the receipt time in ASC order.

- test2

only take first 3 accounts, each account use a fix gasPrice to send one transaction in a row, then we execute N rows to collect the average receipt time for these 3 accounts and output it.

## env control

- `MAX_ACCOUNTS`: can be set from env to control how many accounts used for sending transaction to run the test 1.

- `EXECUTE_NUMBER`: (default is 10) can be set from env to control how many rounds you want the 3 accounts to continually send transaction to run the test 2.

- `TEST_CASE`: (default is 0 means run all tests in order) can be set from env to control what specific test you want to run, eg: `TEST_CASE=3 yarn start:devnet` run test3 in devnet.

- `MODE=forever`: can be set from env to let the test will run forever.

- `TIMEOUT_MS`: timeout milliseconds in forever mode

- `WAIT_INTERVAL_MILSEC`: can be set from env. in forever mode, if `TEST_CASE` is not `0`, we execute all test in order, and then waits 5 seconds to execute the next round by default. this env is use to change the wait interval time.

- `POLL_TX_RECEIPT_TIME_OUT`: milliseconds, default 1m

- `POLL_TX_RECEIPT_INTERVAL`: milliseconds, default 5s

- `PREPARE_TOTAL_ACCOUNT`: generate devnet accounts count, default to 1000

example:

```sh
TEST_CASE=1 MODE=forever TIMEOUT_MS=60000 WAIT_INTERVAL_MILSEC=7000 MAX_ACCOUNT=10 yarn start:devnet
```

api pressure test:

```sh
MAX_ACCOUNT=5 TOTAL_DUPLICATE=5 TOTAL_WRONG_DUPLICATE=200 yarn api:devnet
```
