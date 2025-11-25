// Minimal browser UI that connects to the quadratic-voting contract using Stacks Connect.
// This is written as a standalone module that can be opened directly in the browser.

import { openContractCall } from "https://esm.sh/@stacks/connect@7.7.1";
import { StacksTestnet } from "https://esm.sh/@stacks/network@7.7.0";
import {
  uintCV,
  bufferCVFromString,
  standardPrincipalCV,
} from "https://esm.sh/@stacks/transactions@7.7.0";

const CONTRACT_ADDRESS = "STXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"; // replace with deployed contract address
const CONTRACT_NAME = "quadratic-voting";

const network = new StacksTestnet();

let currentPrincipal = null;

const connectButton = document.getElementById("connect-button");
const depositForm = document.getElementById("deposit-form");
const withdrawForm = document.getElementById("withdraw-form");
const proposalForm = document.getElementById("proposal-form");
const voteForm = document.getElementById("vote-form");

const depositedEl = document.getElementById("deposited");
const creditsEl = document.getElementById("credits");
const logEl = document.getElementById("log");

function log(message, data) {
  const time = new Date().toISOString();
  const line = data ? `${time}  ${message}  ${JSON.stringify(data, null, 2)}` : `${time}  ${message}`;
  logEl.textContent = `${line}\n${logEl.textContent}`;
}

async function connectWallet() {
  // In a real app you would use `showConnect` from @stacks/connect to
  // request a user's Stacks address. Here we assume the user pastes it
  // manually to keep the example self-contained.
  const principal = window.prompt("Enter your Stacks address (testnet)");
  if (!principal) return;
  currentPrincipal = principal.trim();
  connectButton.textContent = `Connected: ${currentPrincipal.slice(0, 6)}…${currentPrincipal.slice(-4)}`;
  log("Connected principal", { principal: currentPrincipal });
}

async function callContract(functionName, functionArgs) {
  if (!currentPrincipal) {
    alert("Connect your Stacks address first.");
    return;
  }

  const options = {
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName,
    functionArgs,
    network,
    appDetails: {
      name: "Quadratic Voting DAO",
      icon: window.location.origin + "/favicon.ico",
    },
    onFinish: (data) => {
      log(`Tx submitted for ${functionName}`, data);
    },
    onCancel: () => {
      log(`User cancelled ${functionName} call`);
    },
  };

  await openContractCall(options);
}

async function handleDeposit(event) {
  event.preventDefault();
  const raw = document.getElementById("deposit-amount").value;
  const amount = BigInt(raw || "0");
  if (amount <= 0n) {
    alert("Enter a positive amount in µSTX.");
    return;
  }
  await callContract("deposit-liquidity", [uintCV(amount)]);
}

async function handleWithdraw(event) {
  event.preventDefault();
  const raw = document.getElementById("withdraw-amount").value;
  const amount = BigInt(raw || "0");
  if (amount <= 0n) {
    alert("Enter a positive amount in µSTX.");
    return;
  }
  await callContract("withdraw-liquidity", [uintCV(amount)]);
}

async function handleCreateProposal(event) {
  event.preventDefault();
  const description = document.getElementById("proposal-description").value.trim();
  if (!description) {
    alert("Description is required.");
    return;
  }
  await callContract("create-proposal", [bufferCVFromString(description)]);
}

async function handleVote(event) {
  event.preventDefault();
  const proposalIdRaw = document.getElementById("vote-proposal-id").value;
  const votesRaw = document.getElementById("vote-count").value;
  const proposalId = BigInt(proposalIdRaw || "0");
  const votes = BigInt(votesRaw || "0");
  if (proposalId <= 0n || votes <= 0n) {
    alert("Enter a positive proposal id and vote count.");
    return;
  }
  const cost = votes * votes;
  log("Casting quadratic vote", { proposalId: proposalId.toString(), votes: votes.toString(), cost: cost.toString() });
  await callContract("vote", [uintCV(proposalId), uintCV(votes)]);
}

connectButton?.addEventListener("click", connectWallet);
depositForm?.addEventListener("submit", handleDeposit);
withdrawForm?.addEventListener("submit", handleWithdraw);
proposalForm?.addEventListener("submit", handleCreateProposal);
voteForm?.addEventListener("submit", handleVote);

// In a production app you would poll a read-only endpoint (e.g. via a custom
// API or a Stacks node) to keep the "Your Position" cards up to date. Here we
// simply leave them as display-only fields and log transactions to the debug
// panel, because wiring a full node RPC client would add a lot of boilerplate
// for this example.

log("UI v1 loaded. Configure CONTRACT_ADDRESS in main.js to point at your deployed contract.");
