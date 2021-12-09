import { TestAccount } from "./helper";

export class Tester {
  public testAccounts: TestAccount[];

  constructor(testAccounts: TestAccount[]) {
    this.testAccounts = testAccounts || [];
  }

  run() {}
}
