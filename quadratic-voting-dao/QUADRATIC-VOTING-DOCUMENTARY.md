# Quadratic Voting DAO – Project Documentary

## 1. The problem: whale dominance in DAO voting

Most DAOs today use one-token-one-vote governance. If you have more tokens, you get more power, linearly. That sounds fair, but it creates a problem: a single large holder – a "whale" – can easily dominate outcomes even when most smaller holders disagree.

Quadratic voting is a response to this problem. Instead of buying votes linearly, the cost of extra votes grows quadratically. The first vote on a proposal is cheap, but the tenth vote is very expensive. This makes it economically harder for one actor to overwhelm everyone else, and it lets participants express not just what they prefer, but how strongly they care.

This project implements a simple quadratic voting DAO on Stacks using a Clarity smart contract, Clarinet tests, and a browser UI wired to those contract calls.

Spoken out loud, this intro section is designed to take about one minute.

## 2. Contract design: liquidity-backed quadratic voting

In this design, participants deposit STX liquidity into a DAO treasury. Each micro-STX becomes one "credit" they can later burn to cast quadratic votes.

Key ideas:

- **Liquidity as skin in the game** – Users must deposit STX to gain voting credits. This avoids free, spammy voting.
- **Credits instead of raw token balances** – The contract keeps track of each account's deposited amount and their remaining credits, so voting can consume credits over time.
- **Quadratic cost function** – Casting `v` votes on a proposal costs `v²` credits. Two votes cost `4`, three votes cost `9`, ten votes cost `100`, and so on.

### 2.1 Core state

The `quadratic-voting.clar` contract keeps the following on-chain state:

- `total-liquidity` – all STX held by the DAO.
- `user-liquidity` map – for each `principal`, store `{ deposited, credits }`.
- `next-proposal-id` – monotonically increasing id for proposals, starting at `1`.
- `proposals` map – from `id` to `{ description, total-votes }`.
- `user-votes` map – how many votes each `principal` has cast on a given proposal id.

### 2.2 Public functions

The main public entrypoints are:

- `deposit-liquidity(amount)`
  - Transfers `amount` STX from the caller into the contract using `stx-transfer?`.
  - Increases both `deposited` and `credits` for that caller by `amount`.
  - Increases `total-liquidity` and returns the new credit balance.

- `withdraw-liquidity(amount)`
  - Checks that the caller has at least `amount` deposited and at least `amount` credits left.
  - Transfers that many STX back from the contract to the caller.
  - Decreases `deposited`, `credits`, and `total-liquidity` accordingly.

- `create-proposal(description)`
  - Mints a new proposal id using `next-proposal-id`.
  - Stores a short description and initial `total-votes = 0`.
  - Returns the new proposal id so the UI and tests can reference it.

- `vote(proposal-id, votes)`
  - Requires `votes > 0` and that the proposal exists.
  - Computes `cost = votes * votes`.
  - Checks the caller has at least `cost` credits.
  - Burns those credits, increases the proposal's `total-votes` by `votes`, and updates the caller's per-proposal vote tally.
  - Returns a tuple `{ cost, remaining-credits }` so a client can update its display immediately.

There are also read-only helpers like `get-user`, `get-proposal`, `get-total-liquidity`, and `get-user-votes` that are convenient for tests or off-chain UIs.

Spoken, this design section is about one and a half minutes.

## 3. Clarinet tests: proving the mechanism works

The project uses Clarinet with Vitest and the `simnet` testing environment. Instead of talking to a real blockchain, tests call the contract directly in a simulated chain and inspect the results.

The main test file is `tests/quadratic-voting.test.ts`. It covers four core behaviors:

1. **Depositing liquidity**
   - A wallet deposits `100_000_000` micro-STX.
   - The contract returns an OK result with the new credit balance.
   - `get-user` shows matching `deposited` and `credits`.
   - `get-total-liquidity` shows the same total STX in the treasury.

2. **Quadratic voting cost**
   - A wallet deposits STX, creates a proposal, and casts 5 votes.
   - The cost is `5² = 25` credits.
   - After voting, `credits` has been reduced by 25, but `deposited` stays the same.
   - The proposal's `total-votes` is 5, and the stored description matches the one we passed in.

3. **Rejecting over-spending**
   - A wallet deposits only 16 credits worth of STX.
   - It tries to cast 5 votes on a new proposal, which would cost 25 credits.
   - The call fails with the `ERR-INSUFFICIENT-CREDITS` error code.

4. **Withdrawing liquidity safely**
   - A user deposits 50 million micro-STX and then successfully withdraws 10 million.
   - Attempting to withdraw more than they have left fails with `ERR-INSUFFICIENT-LIQUIDITY`.

Together, these tests act as an executable specification: they show that liquidity and credits move exactly how you would expect in a quadratic voting DAO.

Spoken, this testing section takes about one minute.

## 4. UI: from basic controls to a guided UX

The repository contains two UIs that both connect to the same Clarity contract via Stacks Connect:

- `ui-v1` is a straightforward, card-based dashboard.
- `ui-v2` is a redesigned, guided flow that makes the quadratic mechanics more obvious.

Both versions:

- Let the user paste a Stacks address (standing in for a full wallet connection flow).
- Call the `deposit-liquidity`, `withdraw-liquidity`, `create-proposal`, and `vote` functions via `openContractCall` from `@stacks/connect`.
- Log submitted transactions and human-readable actions in an on-page activity log.

### 4.1 UI v1 – direct control surface

The first version, under `ui-v1/`, focuses on exposing each contract function with minimal friction:

- A "Your Position" card showing deposited STX and credits (intended to be wired to read-only calls).
- Separate panels for depositing, withdrawing, creating proposals, and voting.
- A small hint under the vote form reminding users that cost grows as `votes²`.

This is useful for developers and power users who already understand quadratic voting and just want to exercise the contract quickly.

### 4.2 UI v2 – redesigned guided flow

The redesigned UI, under `ui-v2/`, is aimed at less technical DAO participants. It changes the experience in a few important ways:

- **Step-by-step layout** – Four numbered steps: fund credits, pick or create a proposal, cast votes, and optionally withdraw. Each step explains what is happening in plain language.
- **Inline cost preview** – As you type the number of votes, the UI live-updates the estimated quadratic cost, so it’s easy to see that doubling votes is much more expensive.
- **Inline stats instead of separate cards** – Deposited amount and credits sit right below the deposit form, reducing scrolling and making it obvious that deposits are what power your votes.
- **Consistent activity log** – A dedicated log panel at the bottom narrates key events in plain English, like "Casting quadratic vote" or "Requested withdrawal".

From a UX perspective, this redesign shifts the interface from a raw control panel to a narrative flow that explains quadratic voting as you go.

Spoken out loud, this UI section is roughly one and a half minutes.

## 5. How to run and extend the project

To explore the project locally:

1. **Install dependencies for tests**
   - From the `quadratic-voting-dao` directory, run `npm install` to install Vitest, the Clarinet SDK, and TypeScript types.

2. **Run Clarinet tests**
   - Run `npm test` to execute the Vitest suite. This will spin up the Clarinet simnet, deploy the contract from `Clarinet.toml`, and run all tests in `tests/`.

3. **Open the UIs**
   - Serve `ui-v1` or `ui-v2` using any static file server (for example, `npx serve ui-v2`).
   - Replace `CONTRACT_ADDRESS` in the corresponding `main.js` file with the address where you’ve deployed `quadratic-voting`.
   - Use a Stacks wallet that supports `openContractCall` to sign the transactions initiated from the UI.

### Ideas for future work

If you wanted to keep pushing this project further, some natural extensions would be:

- Add a proper wallet connection flow using `showConnect` and session state.
- Implement proposal lifecycles: creation windows, quorum checks, execution hooks.
- Introduce per-topic budgets or caps so certain proposal categories cannot drain the entire treasury.
- Visualize the distribution of votes per proposal in the UI (e.g. bar charts or time-series graphs).

Spoken, this closing section is around 30–45 seconds.

---

Overall, if you read this documentary script at a normal pace of ~130–160 words per minute, it should come out comfortably under five minutes. It is structured so that each section can also be recorded as its own short segment if you want to cut a simple project video together.
