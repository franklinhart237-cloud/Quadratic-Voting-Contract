import { openContractCall } from "https://esm.sh/@stacks/connect@7.7.1";
import { StacksTestnet } from "https://esm.sh/@stacks/network@7.7.0";
import {
  uintCV,
  bufferCVFromString,
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
const costPreviewEl = document.getElementById("cost-preview");
const voteCountInput = document.getElementById("vote-count");
const logEl = document.getElementById("log");

function log(message, data) {
  const time = new Date().toISOString();
  const line = data ? `${time}  ${message}  ${JSON.stringify(data, null, 2)}` : `${time}  ${message}`;
  logEl.textContent = `${line}\n${logEl.textContent}`;
}

function updateCostPreview() {
  const raw = voteCountInput.value;
  const votes = BigInt(raw || "0");
  const cost = votes * votes;
  costPreviewEl.textContent = cost.toString();
}

async function connectWallet() {
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
  depositedEl.textContent = amount.toString();
  creditsEl.textContent = amount.toString();
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
  log("Requested withdrawal", { amount: amount.toString() });
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
voteCountInput?.addEventListener("input", updateCostPreview);

updateCostPreview();
log("UI v2 loaded. Configure CONTRACT_ADDRESS in main.js to point at your deployed contract.");
