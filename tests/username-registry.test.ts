import { describe, it, expect } from "vitest";
import { Cl, ClarityType } from "@stacks/transactions";

// Contract name
const CONTRACT_NAME = "username-registry";

// Get accounts from simnet
const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;
const wallet3 = accounts.get("wallet_3")!;

// Error codes
const ERR_UNAUTHORIZED = 100;
const ERR_USERNAME_TAKEN = 101;
const ERR_USERNAME_TOO_SHORT = 102;
const ERR_USERNAME_NOT_FOUND = 106;
const ERR_NOT_OWNER = 107;
const ERR_ALREADY_HAS_USERNAME = 109;
const ERR_CANNOT_TRANSFER_TO_SELF = 110;

// Default registration fee (1 STX = 1,000,000 microSTX)
const DEFAULT_FEE = 1_000_000n;

describe("Username Registry Contract", () => {
  describe("Registration", () => {
    it("should register a valid username", () => {
      const result = simnet.callPublicFn(
        CONTRACT_NAME,
        "register-username",
        [Cl.stringAscii("alice")],
        wallet1
      );

      expect(result.result).toBeOk(Cl.stringAscii("alice"));

      // Verify the username is registered
      const info = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-username-info",
        [Cl.stringAscii("alice")],
        wallet1
      );

      expect(info.result.type).toBe(ClarityType.OptionalSome);
    });

    it("should fail to register username that is too short", () => {
      const result = simnet.callPublicFn(
        CONTRACT_NAME,
        "register-username",
        [Cl.stringAscii("ab")],
        wallet1
      );

      expect(result.result).toBeErr(Cl.uint(ERR_USERNAME_TOO_SHORT));
    });

    it("should fail to register username that is already taken", () => {
      // First registration
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-username",
        [Cl.stringAscii("alice")],
        wallet1
      );

      // Second registration with same username
      const result = simnet.callPublicFn(
        CONTRACT_NAME,
        "register-username",
        [Cl.stringAscii("alice")],
        wallet2
      );

      expect(result.result).toBeErr(Cl.uint(ERR_USERNAME_TAKEN));
    });

    it("should fail if user already has a username", () => {
      // First registration
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-username",
        [Cl.stringAscii("alice")],
        wallet1
      );

      // Try to register another username
      const result = simnet.callPublicFn(
        CONTRACT_NAME,
        "register-username",
        [Cl.stringAscii("alice2")],
        wallet1
      );

      expect(result.result).toBeErr(Cl.uint(ERR_ALREADY_HAS_USERNAME));
    });

    it("should transfer fee to contract owner on registration", () => {
      const deployerBalanceBefore = simnet.getAssetsMap().get("STX")?.get(deployer) || 0n;

      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-username",
        [Cl.stringAscii("alice")],
        wallet1
      );

      const deployerBalanceAfter = simnet.getAssetsMap().get("STX")?.get(deployer) || 0n;

      expect(deployerBalanceAfter - deployerBalanceBefore).toBe(DEFAULT_FEE);
    });

    it("should increment total usernames count", () => {
      const countBefore = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-total-usernames",
        [],
        wallet1
      );

      expect(countBefore.result).toBeUint(0);

      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-username",
        [Cl.stringAscii("alice")],
        wallet1
      );

      const countAfter = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-total-usernames",
        [],
        wallet1
      );

      expect(countAfter.result).toBeUint(1);
    });
  });

  describe("Read-Only Functions", () => {
    it("should check if username is available", () => {
      const available = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "is-username-available",
        [Cl.stringAscii("alice")],
        wallet1
      );

      expect(available.result).toBeBool(true);

      // Register the username
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-username",
        [Cl.stringAscii("alice")],
        wallet1
      );

      const notAvailable = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "is-username-available",
        [Cl.stringAscii("alice")],
        wallet1
      );

      expect(notAvailable.result).toBeBool(false);
    });

    it("should get username by address", () => {
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-username",
        [Cl.stringAscii("alice")],
        wallet1
      );

      const username = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-address-username",
        [Cl.principal(wallet1)],
        wallet1
      );

      expect(username.result).toBeSome(Cl.stringAscii("alice"));
    });

    it("should get username owner", () => {
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-username",
        [Cl.stringAscii("alice")],
        wallet1
      );

      const owner = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-username-owner",
        [Cl.stringAscii("alice")],
        wallet1
      );

      expect(owner.result).toBeSome(Cl.principal(wallet1));
    });

    it("should return registration fee", () => {
      const fee = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-registration-fee",
        [],
        wallet1
      );

      expect(fee.result).toBeUint(DEFAULT_FEE);
    });

    it("should check if address has username", () => {
      const hasBefore = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "has-username",
        [Cl.principal(wallet1)],
        wallet1
      );

      expect(hasBefore.result).toBeBool(false);

      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-username",
        [Cl.stringAscii("alice")],
        wallet1
      );

      const hasAfter = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "has-username",
        [Cl.principal(wallet1)],
        wallet1
      );

      expect(hasAfter.result).toBeBool(true);
    });
  });

  describe("Transfer", () => {
    it("should transfer username to new owner", () => {
      // Register username
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-username",
        [Cl.stringAscii("alice")],
        wallet1
      );

      // Transfer to wallet2
      const result = simnet.callPublicFn(
        CONTRACT_NAME,
        "transfer-username",
        [Cl.stringAscii("alice"), Cl.principal(wallet2)],
        wallet1
      );

      expect(result.result).toBeOk(Cl.bool(true));

      // Verify new owner
      const owner = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-username-owner",
        [Cl.stringAscii("alice")],
        wallet1
      );

      expect(owner.result).toBeSome(Cl.principal(wallet2));

      // Verify reverse lookup updated
      const newOwnerUsername = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-address-username",
        [Cl.principal(wallet2)],
        wallet1
      );

      expect(newOwnerUsername.result).toBeSome(Cl.stringAscii("alice"));

      // Verify old owner no longer has username
      const oldOwnerUsername = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-address-username",
        [Cl.principal(wallet1)],
        wallet1
      );

      expect(oldOwnerUsername.result.type).toBe(ClarityType.OptionalNone);
    });

    it("should fail to transfer if not owner", () => {
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-username",
        [Cl.stringAscii("alice")],
        wallet1
      );

      const result = simnet.callPublicFn(
        CONTRACT_NAME,
        "transfer-username",
        [Cl.stringAscii("alice"), Cl.principal(wallet3)],
        wallet2
      );

      expect(result.result).toBeErr(Cl.uint(ERR_NOT_OWNER));
    });

    it("should fail to transfer to self", () => {
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-username",
        [Cl.stringAscii("alice")],
        wallet1
      );

      const result = simnet.callPublicFn(
        CONTRACT_NAME,
        "transfer-username",
        [Cl.stringAscii("alice"), Cl.principal(wallet1)],
        wallet1
      );

      expect(result.result).toBeErr(Cl.uint(ERR_CANNOT_TRANSFER_TO_SELF));
    });

    it("should fail to transfer to user who already has username", () => {
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-username",
        [Cl.stringAscii("alice")],
        wallet1
      );

      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-username",
        [Cl.stringAscii("bob")],
        wallet2
      );

      const result = simnet.callPublicFn(
        CONTRACT_NAME,
        "transfer-username",
        [Cl.stringAscii("alice"), Cl.principal(wallet2)],
        wallet1
      );

      expect(result.result).toBeErr(Cl.uint(ERR_ALREADY_HAS_USERNAME));
    });
  });

  describe("Approved Transfer", () => {
    it("should approve and claim transfer", () => {
      // Register username
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-username",
        [Cl.stringAscii("alice")],
        wallet1
      );

      // Approve transfer to wallet2
      const approveResult = simnet.callPublicFn(
        CONTRACT_NAME,
        "approve-transfer",
        [Cl.stringAscii("alice"), Cl.principal(wallet2)],
        wallet1
      );

      expect(approveResult.result).toBeOk(Cl.bool(true));

      // Check approval
      const approval = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-transfer-approval",
        [Cl.stringAscii("alice")],
        wallet1
      );

      expect(approval.result).toBeSome(Cl.principal(wallet2));

      // Claim transfer
      const claimResult = simnet.callPublicFn(
        CONTRACT_NAME,
        "claim-transfer",
        [Cl.stringAscii("alice")],
        wallet2
      );

      expect(claimResult.result).toBeOk(Cl.bool(true));

      // Verify new owner
      const owner = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-username-owner",
        [Cl.stringAscii("alice")],
        wallet1
      );

      expect(owner.result).toBeSome(Cl.principal(wallet2));
    });

    it("should fail to claim if not approved", () => {
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-username",
        [Cl.stringAscii("alice")],
        wallet1
      );

      const result = simnet.callPublicFn(
        CONTRACT_NAME,
        "claim-transfer",
        [Cl.stringAscii("alice")],
        wallet2
      );

      expect(result.result).toBeErr(Cl.uint(ERR_UNAUTHORIZED));
    });

    it("should fail to claim if different address approved", () => {
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-username",
        [Cl.stringAscii("alice")],
        wallet1
      );

      // Approve for wallet2
      simnet.callPublicFn(
        CONTRACT_NAME,
        "approve-transfer",
        [Cl.stringAscii("alice"), Cl.principal(wallet2)],
        wallet1
      );

      // wallet3 tries to claim
      const result = simnet.callPublicFn(
        CONTRACT_NAME,
        "claim-transfer",
        [Cl.stringAscii("alice")],
        wallet3
      );

      expect(result.result).toBeErr(Cl.uint(ERR_UNAUTHORIZED));
    });
  });

  describe("Release Username", () => {
    it("should release username", () => {
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-username",
        [Cl.stringAscii("alice")],
        wallet1
      );

      const result = simnet.callPublicFn(
        CONTRACT_NAME,
        "release-username",
        [Cl.stringAscii("alice")],
        wallet1
      );

      expect(result.result).toBeOk(Cl.bool(true));

      // Verify username is available again
      const available = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "is-username-available",
        [Cl.stringAscii("alice")],
        wallet1
      );

      expect(available.result).toBeBool(true);

      // Verify user no longer has username
      const hasUsername = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "has-username",
        [Cl.principal(wallet1)],
        wallet1
      );

      expect(hasUsername.result).toBeBool(false);
    });

    it("should decrement total usernames on release", () => {
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-username",
        [Cl.stringAscii("alice")],
        wallet1
      );

      const countBefore = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-total-usernames",
        [],
        wallet1
      );

      expect(countBefore.result).toBeUint(1);

      simnet.callPublicFn(
        CONTRACT_NAME,
        "release-username",
        [Cl.stringAscii("alice")],
        wallet1
      );

      const countAfter = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-total-usernames",
        [],
        wallet1
      );

      expect(countAfter.result).toBeUint(0);
    });

    it("should fail to release if not owner", () => {
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-username",
        [Cl.stringAscii("alice")],
        wallet1
      );

      const result = simnet.callPublicFn(
        CONTRACT_NAME,
        "release-username",
        [Cl.stringAscii("alice")],
        wallet2
      );

      expect(result.result).toBeErr(Cl.uint(ERR_NOT_OWNER));
    });

    it("should fail to release non-existent username", () => {
      const result = simnet.callPublicFn(
        CONTRACT_NAME,
        "release-username",
        [Cl.stringAscii("nonexistent")],
        wallet1
      );

      expect(result.result).toBeErr(Cl.uint(ERR_USERNAME_NOT_FOUND));
    });
  });

  describe("Admin Functions", () => {
    it("should allow owner to set registration fee", () => {
      const newFee = 2_000_000n;

      const result = simnet.callPublicFn(
        CONTRACT_NAME,
        "set-registration-fee",
        [Cl.uint(newFee)],
        deployer
      );

      expect(result.result).toBeOk(Cl.uint(newFee));

      const fee = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-registration-fee",
        [],
        wallet1
      );

      expect(fee.result).toBeUint(newFee);
    });

    it("should fail to set fee if not owner", () => {
      const result = simnet.callPublicFn(
        CONTRACT_NAME,
        "set-registration-fee",
        [Cl.uint(2_000_000n)],
        wallet1
      );

      expect(result.result).toBeErr(Cl.uint(ERR_UNAUTHORIZED));
    });

    it("should use new fee for registration", () => {
      const newFee = 5_000_000n;

      // Set new fee
      simnet.callPublicFn(
        CONTRACT_NAME,
        "set-registration-fee",
        [Cl.uint(newFee)],
        deployer
      );

      const deployerBalanceBefore = simnet.getAssetsMap().get("STX")?.get(deployer) || 0n;

      // Register with new fee
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-username",
        [Cl.stringAscii("alice")],
        wallet1
      );

      const deployerBalanceAfter = simnet.getAssetsMap().get("STX")?.get(deployer) || 0n;

      expect(deployerBalanceAfter - deployerBalanceBefore).toBe(newFee);
    });
  });

  describe("Edge Cases", () => {
    it("should handle minimum length username", () => {
      const result = simnet.callPublicFn(
        CONTRACT_NAME,
        "register-username",
        [Cl.stringAscii("abc")],
        wallet1
      );

      expect(result.result).toBeOk(Cl.stringAscii("abc"));
    });

    it("should handle maximum length username", () => {
      const maxUsername = "a".repeat(30);

      const result = simnet.callPublicFn(
        CONTRACT_NAME,
        "register-username",
        [Cl.stringAscii(maxUsername)],
        wallet1
      );

      expect(result.result).toBeOk(Cl.stringAscii(maxUsername));
    });

    it("should handle usernames with numbers and special chars", () => {
      const result = simnet.callPublicFn(
        CONTRACT_NAME,
        "register-username",
        [Cl.stringAscii("user_123-test")],
        wallet1
      );

      expect(result.result).toBeOk(Cl.stringAscii("user_123-test"));
    });

    it("should allow registration after releasing username", () => {
      // Register
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-username",
        [Cl.stringAscii("alice")],
        wallet1
      );

      // Release
      simnet.callPublicFn(
        CONTRACT_NAME,
        "release-username",
        [Cl.stringAscii("alice")],
        wallet1
      );

      // Register again (different username)
      const result = simnet.callPublicFn(
        CONTRACT_NAME,
        "register-username",
        [Cl.stringAscii("alice_new")],
        wallet1
      );

      expect(result.result).toBeOk(Cl.stringAscii("alice_new"));
    });

    it("should allow another user to claim released username", () => {
      // Register
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-username",
        [Cl.stringAscii("alice")],
        wallet1
      );

      // Release
      simnet.callPublicFn(
        CONTRACT_NAME,
        "release-username",
        [Cl.stringAscii("alice")],
        wallet1
      );

      // Another user registers the same username
      const result = simnet.callPublicFn(
        CONTRACT_NAME,
        "register-username",
        [Cl.stringAscii("alice")],
        wallet2
      );

      expect(result.result).toBeOk(Cl.stringAscii("alice"));
    });
  });
});
