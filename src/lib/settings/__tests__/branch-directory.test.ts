import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { canAccessBranchDirectory, filterBranchDirectory, paginateBranchDirectory, type BranchDirectoryDTO } from "../branch-directory";

const branches: BranchDirectoryDTO[] = [
  { id: "1", name: "Head Office", code: "HQ-01", email: "hq@kn.test", phone: "+91 111", address: "One", city: "Delhi", state: "Delhi", country: "India", currency: "INR", status: "ACTIVE", userCount: 1, memberCount: 1, accountCount: 1, loanCount: 1 },
  { id: "2", name: "Riverside", code: "DEL-02", email: "river@kn.test", phone: "+91 222", address: "Two", city: "Delhi", state: "Delhi", country: "India", currency: "INR", status: "INACTIVE", userCount: 0, memberCount: 0, accountCount: 0, loanCount: 0 },
];

describe("Branch Directory", () => {
  test("requires relational manage permission and global branch scope", () => {
    assert.equal(canAccessBranchDirectory(["settings.branch.manage"], true), true);
    assert.equal(canAccessBranchDirectory(["settings.branch.manage"], false), false);
    assert.equal(canAccessBranchDirectory(["settings.view"], true), false);
  });

  test("searches name, code, email, and phone and filters status", () => {
    assert.deepEqual(filterBranchDirectory(branches, "hq-01", "ALL").map((branch) => branch.id), ["1"]);
    assert.deepEqual(filterBranchDirectory(branches, "+91 222", "ALL").map((branch) => branch.id), ["2"]);
    assert.deepEqual(filterBranchDirectory(branches, "", "INACTIVE").map((branch) => branch.id), ["2"]);
  });

  test("paginates safely", () => {
    const result = paginateBranchDirectory(branches, 99, 1);
    assert.equal(result.page, 2);
    assert.equal(result.totalPages, 2);
    assert.equal(result.rows[0]?.id, "2");
  });
});
