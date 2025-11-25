import { describe, it, expect } from "vitest";
import { Cl } from "@stacks/transactions";

// The `simnet` object is provided globally by vitest-environment-clarinet.
// It exposes Clarinet's Simnet API for calling contract functions in tests.

describe("quadratic-voting contract", () => {
  const accounts = simnet.getAccounts();
  const deployer = accounts.get("deployer")!;
  const voter1 = accounts.get("wallet_1")!;

  it("allows a user to deposit liquidity and mints matching credits", () => {
    const amount = 100_000_000n; // 100 STX in micro-STX

    const depositResult = simnet.callPublicFn(
      "quadratic-voting",
      "deposit-liquidity",
      [Cl.uint(amount)],
      voter1,
    );

    expect(depositResult.result).toBeOk(Cl.uint(amount));

    const userAfter = simnet.callReadOnlyFn(
      "quadratic-voting",
      "get-user",
      [Cl.standardPrincipal(voter1)],
      voter1,
    );

    expect(userAfter.result).toBeOk(
      Cl.tuple({
        deposited: Cl.uint(amount),
        credits: Cl.uint(amount),
      }),
    );

    const totalLiquidity = simnet.callReadOnlyFn(
      "quadratic-voting",
      "get-total-liquidity",
      [],
      deployer,
    );

    expect(totalLiquidity.result).toBeUint(amount);
  });

  it("enforces quadratic cost when voting and burns credits accordingly", () => {
    const initialDeposit = 10_000_000n; // 10 STX
    const votes = 5n;
    const expectedCost = votes * votes; // 25 credits

    simnet.callPublicFn(
      "quadratic-voting",
      "deposit-liquidity",
      [Cl.uint(initialDeposit)],
      voter1,
    );

    const createProposal = simnet.callPublicFn(
      "quadratic-voting",
      "create-proposal",
      [Cl.bufferFromUtf8("Fund public goods"),],
      voter1,
    );

    expect(createProposal.result).toBeOk(Cl.uint(1n));

    const voteResult = simnet.callPublicFn(
      "quadratic-voting",
      "vote",
      [Cl.uint(1n), Cl.uint(votes)],
      voter1,
    );

    expect(voteResult.result).toBeOk(
      Cl.tuple({
        cost: Cl.uint(expectedCost),
        "remaining-credits": Cl.uint(initialDeposit - expectedCost),
      }),
    );

    const userAfterVote = simnet.callReadOnlyFn(
      "quadratic-voting",
      "get-user",
      [Cl.standardPrincipal(voter1)],
      voter1,
    );

    expect(userAfterVote.result).toBeOk(
      Cl.tuple({
        deposited: Cl.uint(initialDeposit),
        credits: Cl.uint(initialDeposit - expectedCost),
      }),
    );

    const proposalAfter = simnet.callReadOnlyFn(
      "quadratic-voting",
      "get-proposal",
      [Cl.uint(1n)],
      voter1,
    );

    expect(proposalAfter.result).toBeOk(
      Cl.tuple({
        description: Cl.bufferFromUtf8("Fund public goods"),
        "total-votes": Cl.uint(votes),
      }),
    );
  });

  it("rejects votes when the user does not have enough credits", () => {
    const smallDeposit = 16n;

    simnet.callPublicFn(
      "quadratic-voting",
      "deposit-liquidity",
      [Cl.uint(smallDeposit)],
      voter1,
    );

    const createProposal = simnet.callPublicFn(
      "quadratic-voting",
      "create-proposal",
      [Cl.bufferFromUtf8("Over-spend test"),],
      voter1,
    );

    expect(createProposal.result).toBeOk(Cl.uint(2n));

    const voteResult = simnet.callPublicFn(
      "quadratic-voting",
      "vote",
      [Cl.uint(2n), Cl.uint(5n)],
      voter1,
    );

    // 5 votes cost 25 credits; user has only 16, so we expect ERR-INSUFFICIENT-CREDITS (u102)
    expect(voteResult.result).toBeErr(Cl.uint(102n));
  });

  it("lets a user withdraw unused liquidity but not more than they have", () => {
    const amount = 50_000_000n;

    simnet.callPublicFn(
      "quadratic-voting",
      "deposit-liquidity",
      [Cl.uint(amount)],
      voter1,
    );

    const withdrawOk = simnet.callPublicFn(
      "quadratic-voting",
      "withdraw-liquidity",
      [Cl.uint(10_000_000n)],
      voter1,
    );

    expect(withdrawOk.result).toBeOk(Cl.uint(40_000_000n));

    const overWithdraw = simnet.callPublicFn(
      "quadratic-voting",
      "withdraw-liquidity",
      [Cl.uint(50_000_000n)],
      voter1,
    );

    // Attempting to withdraw more than remaining liquidity should fail with ERR-INSUFFICIENT-LIQUIDITY (u103)
    expect(overWithdraw.result).toBeErr(Cl.uint(103n));
  });
});
