# TrustFund: Milestone-Based Escrow Crowdfunding DApp

[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636?logo=solidity)](https://soliditylang.org/)
[![Hardhat](https://img.shields.io/badge/Hardhat-2.22.x-FFF100?logo=ethereum)](https://hardhat.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![Ethers.js](https://img.shields.io/badge/Ethers.js-v6-2535A0?logo=javascript)](https://docs.ethers.org/v6/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

> A decentralized, trustless crowdfunding protocol that eliminates project abandonment ("rug pulls") by holding campaign funds in an Ethereum smart contract escrow. Capital is disbursed sequentially in tranches only after backer consensus approves verified milestone deliverables.

---

## 1. Project Overview

### 1.1 Problem Statement
Conventional crowdfunding platforms (Kickstarter, GoFundMe, Indiegogo) suffer from severe structural shortcomings:
1. **Lump-Sum Capital Risk:** 100% of collected funds are paid upfront to project creators upon target achievement. If creators mismanage funds or abandon projects, backers have zero financial or technical recourse.
2. **Absence of Governance:** Contributors have no oversight or voting rights over whether milestones are genuinely achieved.
3. **Centralized Intermediary Extortion:** Centralized platforms deduct 5% to 8% in platform fees plus 3% payment processing cuts, and retain unilateral authority to censor or freeze funds.
4. **Opaque Spending:** Backers cannot track where or when their capital is deployed.

### 1.2 Proposed Solution: TrustFund
**TrustFund** replaces trusted middlemen with an immutable, deterministic smart contract:
* **Escrowed Milestone Tranches:** Funding targets are divided into custom percentage allocations (e.g., Phase 1: 30%, Phase 2: 40%, Phase 3: 30%).
* **Democratic Backer Consensus:** Creators submit on-chain milestone deliverables (IPFS hashes, demo links). Funds unlock only if verified backers vote to approve the milestone.
* **Sybil-Resistant Voting:** Voting power scales linearly with the amount of ETH contributed, ensuring that small throwaway accounts cannot overpower major backers.
* **Automated Capital Protection:** If a campaign fails to reach its goal by the deadline, or if a milestone is rejected by backers, contributors can claim a pull-payment refund for all remaining unspent escrow funds.

---

## 2. System Architecture

```
+-----------------------------------------------------------------------------------+
|                                  USER LAYER                                       |
|     +-------------------------+                 +---------------------------+     |
|     |     Project Creator     |                 |          Backer           |     |
|     +-------------------------+                 +---------------------------+     |
+--------------------|------------------------------------------|-------------------+
                     |                                          |
                     v                                          v
+-----------------------------------------------------------------------------------+
|                        FRONTEND CLIENT (React + Vite + Tailwind)                  |
|                                                                                   |
|   +-------------------+  +---------------------+  +---------------------------+   |
|   | Campaign Explorer |  | Campaign Creation UI|  | Milestone & Voting Panel  |   |
|   +-------------------+  +---------------------+  +---------------------------+   |
|                                       |                                           |
|                      Ethers.js v6 (Contract / Provider / Signer)                  |
+---------------------------------------|-------------------------------------------+
                                        | (RPC Calls / Signed Transactions)
                                        v
+-----------------------------------------------------------------------------------+
|                        WALLET LAYER: MetaMask Extension                           |
|        - Manages Private Keys               - Signs Transactions                  |
|        - Estimates Gas & Prompts User       - Relays to Ethereum Node             |
+---------------------------------------|-------------------------------------------+
                                        | JSON-RPC (eth_sendRawTransaction)
                                        v
+-----------------------------------------------------------------------------------+
|                        BLOCKCHAIN LAYER: EVM (Hardhat / Sepolia)                  |
|                                                                                   |
|   +---------------------------------------------------------------------------+   |
|   |                            TrustFund.sol                                  |   |
|   |                                                                           |   |
|   |  - State Storage: Mappings (Campaigns, Contributions, Milestone Votes)   |   |
|   |  - Modifiers: nonReentrant, onlyCreator, onlyBacker                       |   |
|   |  - Core Functions:                                                        |   |
|   |      * createCampaign()         * contribute() {payable}                  |   |
|   |      * submitMilestoneProof()   * voteOnMilestone()                       |   |
|   |      * withdrawMilestoneFunds() * claimRefund()                           |   |
|   |  - Event Dispatcher: (CampaignCreated, ContributionReceived, etc.)        |   |
|   +---------------------------------------------------------------------------+   |
+-----------------------------------------------------------------------------------+
```

---

## 3. Smart Contract Security & Engineering Patterns

1. **Checks-Effects-Interactions (CEI):** In both `withdrawMilestoneFunds()` and `claimRefund()`, internal state mutations (e.g. marking `hasClaimedRefund = true` or `milestone.state = WITHDRAWN`) occur **before** native ETH transfers.
2. **Reentrancy Protection:** All functions executing external value transfers inherit OpenZeppelin's battle-tested `ReentrancyGuard` modifier (`nonReentrant`).
3. **Pull-over-Push Payments:** Funds are never pushed in bulk loops to creators or backers (which could cause out-of-gas Denial of Service). Each party individually pulls their allocated payout or refund.
4. **Proportional Refund Math:** If a project fails at Milestone $i$ after Milestone $i-1$ has been disbursed, refunds are calculated proportionally based on the remaining unspent escrow pool:
   $$\text{Refund Amount} = \frac{\text{Backer Contribution} \times (\text{Total Raised} - \text{Total Withdrawn})}{\text{Total Raised}}$$
5. **EVM Gas Optimizations:**
   * Custom errors (`error TrustFund__InvalidAmount()`) rather than expensive string revert messages.
   * Direct storage pointer assignments bypassing stack limits.
   * `viaIR: true` optimizer enabled in compiler configurations.

---

## 4. Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Smart Contracts** | Solidity `^0.8.24` | Core business logic, escrow state machine, voting rules |
| **Development Framework** | Hardhat `2.22.x` | Compilation, unit tests, local testnet node |
| **Security Library** | OpenZeppelin Contracts `v5.6` | `ReentrancyGuard` standard implementation |
| **Client Frontend** | React 18 with Vite | Fast single-page application dashboard |
| **Styling** | Tailwind CSS `3.4` | Responsive dark-mode Web3 design system |
| **Blockchain Client** | Ethers.js `v6` | Provider/Signer abstraction and contract communication |
| **Wallet** | MetaMask | Key management, signature requests, and network switching |

---

## 5. Local Setup & Execution Guide

### 5.1 Prerequisites
* [Node.js](https://nodejs.org/) (v18, v20, or v22+ recommended)
* [MetaMask Extension](https://metamask.io/) installed in your browser

### 5.2 Step-by-Step Execution

Open **three terminal windows** in the project directory:

#### Terminal 1: Start the Local Ethereum Blockchain
```bash
npm run node
```
*Starts a local JSON-RPC Ethereum node at `http://127.0.0.1:8545` (Chain ID: `31337`) with 20 test accounts funded with 10,000 ETH each.*

#### Terminal 2: Deploy and Seed the Smart Contract
```bash
npm run seed:local
```
*Deploys `TrustFund.sol`, automatically synchronizes the ABI and contract address to the frontend, and seeds two sample campaigns (one in funding, one active with backer votes).*

#### Terminal 3: Launch the Frontend Web Application
```bash
cd frontend
npm run dev
```
*Opens the web dashboard at `http://localhost:5173`.*

---

## 6. Configuring MetaMask for Localhost

1. In MetaMask, open **Settings** $\rightarrow$ **Networks** $\rightarrow$ **Add Network Manually**:
   * **Network Name:** `Hardhat Localhost`
   * **New RPC URL:** `http://127.0.0.1:8545`
   * **Chain ID:** `31337`
   * **Currency Symbol:** `ETH`
2. **Import Pre-Funded Test Accounts:**
   * Click your profile picture $\rightarrow$ **Import Account** $\rightarrow$ paste any of these private keys:
   * **Creator Account (Account #1):**
     * Address: `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`
     * Private Key: `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d`
   * **Backer Account (Account #3):**
     * Address: `0x90F79bf6EB2c4f870365E785982E1f101E93b906`
     * Private Key: `0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6`
3. Connect your wallet at `http://localhost:5173` and start creating campaigns, backing projects, voting, and claiming payouts!

---

## 7. Running Smart Contract Unit Tests

We have implemented a comprehensive test suite covering 16 distinct scenarios across campaign lifecycles, access control, weighted voting, and refund mathematics:

```bash
npm run test
```

### Test Suite Summary:
```text
  TrustFund Smart Contract
    1. Campaign Creation
      ✔ should deploy with campaign count initialized to 0
      ✔ should successfully create a campaign with valid inputs
      ✔ should revert if target amount is zero
      ✔ should revert if milestone percentages do not sum to 100
      ✔ should revert if percentages and descriptions count mismatch
    2. Contributions
      ✔ should record contributions accurately and emit event
      ✔ should revert zero ETH contribution
      ✔ should transition state from FUNDING (0) to ACTIVE (1) when target is hit
    3. Milestone Proof Submission & Weighted Voting
      ✔ should only allow creator to submit milestone proof
      ✔ should revert if creator attempts to submit milestones out of order
      ✔ should allow verified backers to vote and auto-approve when >50% capital approves
      ✔ should prevent double-voting by the same backer
    4. Fund Withdrawal (Pull-Payment)
      ✔ should only allow creator to withdraw approved milestone funds
      ✔ should complete entire campaign when all 3 milestones are withdrawn
    5. Capital Protection & Automated Refunds
      ✔ should grant 100% refund if campaign fails to reach target by deadline
      ✔ should grant proportional refund of remaining escrow if milestone is rejected

  16 passing (858ms)
```

---

## 8. Optional: Deploying to Ethereum Sepolia Testnet

1. Get a free RPC endpoint from [Alchemy](https://www.alchemy.com/) or [Infura](https://www.infura.io/).
2. Request free Sepolia test ETH from a faucet (e.g. [sepoliafaucet.com](https://sepoliafaucet.com/)).
3. Duplicate `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
4. Fill in your credentials:
   ```env
   SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY
   PRIVATE_KEY=your_wallet_private_key_without_0x
   ```
5. Deploy to Sepolia:
   ```bash
   npm run deploy:sepolia
   ```

---

## 9. Academic Evaluation & Viva Defense Guide

Here are answers to common questions asked by university examiners during project evaluation:

### Q1: What makes this superior to traditional crowdfunding platforms?
**Answer:** Traditional platforms give 100% of the funds upfront to creators upon goal completion. If the creator disappears or mismanages the funds, backers lose everything. TrustFund locks the money in a smart contract escrow. Capital is disbursed in tranches only after backers vote to approve verifiable milestone proof.

### Q2: How does the contract prevent Reentrancy attacks?
**Answer:** By applying two defensive layers:
1. **Checks-Effects-Interactions (CEI):** State variables (such as updating milestone status to `WITHDRAWN` or marking `hasClaimedRefund[backer] = true`) are updated **before** calling `.call{value: amount}("")`.
2. **OpenZeppelin `ReentrancyGuard`:** Functions are guarded by the `nonReentrant` modifier, which locks the execution context during the external call.

### Q3: Why use Pull-over-Push payments for refunds?
**Answer:** If the contract attempted to iterate over an array of 500 backers to automatically transfer refunds, two vulnerabilities would arise:
1. **Denial-of-Service (DoS) via Gas Limit:** The transaction could exceed the block gas limit and fail permanently.
2. **Malicious Fallback Reverts:** If one backer address is a contract that reverts on receipt, the entire bulk refund loop would fail for all other backers. Pull payments isolate risk to individual transactions.

### Q4: How is Sybil voting prevented?
**Answer:** Instead of 1-account-1-vote (which is vulnerable to Sybil attacks, where an attacker creates 1,000 empty wallets), TrustFund weighs each backer's vote by `contributions[campaignId][msg.sender]`. The vote weight is directly proportional to actual economic stake.

---

## 10. License

This project is licensed under the [MIT License](LICENSE).
