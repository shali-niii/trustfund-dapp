const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("TrustFund Smart Contract", function () {
  let trustFund;
  let owner, creator, backer1, backer2, backer3, outsider;

  const ONE_ETHER = ethers.parseEther("1.0");
  const TWO_ETHER = ethers.parseEther("2.0");
  const FIVE_ETHER = ethers.parseEther("5.0");

  const TITLE = "Decentralized Clean Water Sensor";
  const DESCRIPTION = "IoT-based water monitoring nodes with cryptographic tamper detection.";
  const IMAGE_CID = "ipfs://QmWaterSensorDemo123";
  const TARGET_AMOUNT = FIVE_ETHER;
  const DURATION_DAYS = 30;

  // 3 Milestones: 30%, 40%, 30% = 100%
  const MILESTONE_PERCENTAGES = [30, 40, 30];
  const MILESTONE_DESCRIPTIONS = [
    "Milestone 1: Hardware Prototype & Lab Testing",
    "Milestone 2: Pilot Deployment (10 Sensor Nodes)",
    "Milestone 3: Production Scale & Open Source Release",
  ];

  beforeEach(async function () {
    [owner, creator, backer1, backer2, backer3, outsider] = await ethers.getSigners();

    const TrustFundFactory = await ethers.getContractFactory("TrustFund");
    trustFund = await TrustFundFactory.deploy();
    await trustFund.waitForDeployment();
  });

  // ===========================================================================
  // 1. DEPLOYMENT & CAMPAIGN CREATION
  // ===========================================================================
  describe("1. Campaign Creation", function () {
    it("should deploy with campaign count initialized to 0", async function () {
      expect(await trustFund.campaignCount()).to.equal(0);
    });

    it("should successfully create a campaign with valid inputs", async function () {
      const tx = await trustFund.connect(creator).createCampaign(
        TITLE,
        DESCRIPTION,
        IMAGE_CID,
        TARGET_AMOUNT,
        DURATION_DAYS,
        MILESTONE_PERCENTAGES,
        MILESTONE_DESCRIPTIONS
      );

      await expect(tx)
        .to.emit(trustFund, "CampaignCreated")
        .withArgs(1, creator.address, TITLE, TARGET_AMOUNT, (val) => val > 0, 3);

      expect(await trustFund.campaignCount()).to.equal(1);

      const campaign = await trustFund.campaigns(1);
      expect(campaign.id).to.equal(1);
      expect(campaign.creator).to.equal(creator.address);
      expect(campaign.title).to.equal(TITLE);
      expect(campaign.targetAmount).to.equal(TARGET_AMOUNT);
      expect(campaign.state).to.equal(0); // CampaignState.FUNDING

      const milestones = await trustFund.getMilestones(1);
      expect(milestones.length).to.equal(3);
      expect(milestones[0].percentage).to.equal(30);
      expect(milestones[1].percentage).to.equal(40);
      expect(milestones[2].percentage).to.equal(30);
    });

    it("should revert if target amount is zero", async function () {
      await expect(
        trustFund.connect(creator).createCampaign(
          TITLE,
          DESCRIPTION,
          IMAGE_CID,
          0,
          DURATION_DAYS,
          MILESTONE_PERCENTAGES,
          MILESTONE_DESCRIPTIONS
        )
      ).to.be.revertedWithCustomError(trustFund, "TrustFund__InvalidTargetAmount");
    });

    it("should revert if milestone percentages do not sum to 100", async function () {
      const invalidPercentages = [20, 40, 20]; // sums to 80
      await expect(
        trustFund.connect(creator).createCampaign(
          TITLE,
          DESCRIPTION,
          IMAGE_CID,
          TARGET_AMOUNT,
          DURATION_DAYS,
          invalidPercentages,
          MILESTONE_DESCRIPTIONS
        )
      ).to.be.revertedWithCustomError(trustFund, "TrustFund__PercentagesMustSumTo100");
    });

    it("should revert if percentages and descriptions count mismatch", async function () {
      const mismatchedDescriptions = ["Only one description"];
      await expect(
        trustFund.connect(creator).createCampaign(
          TITLE,
          DESCRIPTION,
          IMAGE_CID,
          TARGET_AMOUNT,
          DURATION_DAYS,
          MILESTONE_PERCENTAGES,
          mismatchedDescriptions
        )
      ).to.be.revertedWithCustomError(trustFund, "TrustFund__InvalidMilestones");
    });
  });

  // ===========================================================================
  // 2. CONTRIBUTIONS & FUNDING GOAL REACHED
  // ===========================================================================
  describe("2. Contributions", function () {
    beforeEach(async function () {
      await trustFund.connect(creator).createCampaign(
        TITLE,
        DESCRIPTION,
        IMAGE_CID,
        TARGET_AMOUNT,
        DURATION_DAYS,
        MILESTONE_PERCENTAGES,
        MILESTONE_DESCRIPTIONS
      );
    });

    it("should record contributions accurately and emit event", async function () {
      await expect(
        trustFund.connect(backer1).contribute(1, { value: TWO_ETHER })
      )
        .to.emit(trustFund, "ContributionReceived")
        .withArgs(1, backer1.address, TWO_ETHER, TWO_ETHER);

      expect(await trustFund.contributions(1, backer1.address)).to.equal(TWO_ETHER);
      const campaign = await trustFund.campaigns(1);
      expect(campaign.totalRaised).to.equal(TWO_ETHER);
      expect(await trustFund.getBackerCount(1)).to.equal(1);
    });

    it("should revert zero ETH contribution", async function () {
      await expect(
        trustFund.connect(backer1).contribute(1, { value: 0 })
      ).to.be.revertedWithCustomError(trustFund, "TrustFund__ContributionMustBeGreaterThanZero");
    });

    it("should transition state from FUNDING (0) to ACTIVE (1) when target is hit", async function () {
      // backer1 sends 2 ETH
      await trustFund.connect(backer1).contribute(1, { value: TWO_ETHER });
      let campaign = await trustFund.campaigns(1);
      expect(campaign.state).to.equal(0); // Still FUNDING

      // backer2 sends 3 ETH -> total 5 ETH (matches target)
      await expect(trustFund.connect(backer2).contribute(1, { value: ethers.parseEther("3.0") }))
        .to.emit(trustFund, "CampaignStateChanged")
        .withArgs(1, 1); // 1 = ACTIVE

      campaign = await trustFund.campaigns(1);
      expect(campaign.state).to.equal(1); // ACTIVE
      expect(campaign.totalRaised).to.equal(FIVE_ETHER);
      expect(await trustFund.getBackerCount(1)).to.equal(2);
    });
  });

  // ===========================================================================
  // 3. MILESTONE SUBMISSION & VOTING GOVERNANCE
  // ===========================================================================
  describe("3. Milestone Proof Submission & Weighted Voting", function () {
    beforeEach(async function () {
      await trustFund.connect(creator).createCampaign(
        TITLE,
        DESCRIPTION,
        IMAGE_CID,
        TARGET_AMOUNT,
        DURATION_DAYS,
        MILESTONE_PERCENTAGES,
        MILESTONE_DESCRIPTIONS
      );

      // Backers fully fund the campaign: backer1 (3 ETH = 60%), backer2 (2 ETH = 40%)
      await trustFund.connect(backer1).contribute(1, { value: ethers.parseEther("3.0") });
      await trustFund.connect(backer2).contribute(1, { value: TWO_ETHER });
    });

    it("should only allow creator to submit milestone proof", async function () {
      const proofUrl = "ipfs://QmDeliverableProof1";

      await expect(
        trustFund.connect(outsider).submitMilestoneProof(1, 0, proofUrl)
      ).to.be.revertedWithCustomError(trustFund, "TrustFund__NotCampaignCreator");

      // Creator successfully submits Milestone 0
      await expect(trustFund.connect(creator).submitMilestoneProof(1, 0, proofUrl))
        .to.emit(trustFund, "MilestoneProofSubmitted")
        .withArgs(1, 0, proofUrl, (deadline) => deadline > 0);

      const milestones = await trustFund.getMilestones(1);
      expect(milestones[0].state).to.equal(1); // MilestoneState.SUBMITTED
      expect(milestones[0].proofUrl).to.equal(proofUrl);
    });

    it("should revert if creator attempts to submit milestones out of order", async function () {
      await expect(
        trustFund.connect(creator).submitMilestoneProof(1, 1, "ipfs://QmSkip")
      ).to.be.revertedWithCustomError(trustFund, "TrustFund__InvalidMilestoneIndex");
    });

    it("should allow verified backers to vote and auto-approve when >50% capital approves", async function () {
      await trustFund.connect(creator).submitMilestoneProof(1, 0, "ipfs://QmProof0");

      // Outsider cannot vote
      await expect(
        trustFund.connect(outsider).voteOnMilestone(1, 0, true)
      ).to.be.revertedWithCustomError(trustFund, "TrustFund__NotABacker");

      // backer1 holds 3 ETH out of 5 ETH total (>50%)
      // Voting YES should immediately trigger MilestoneState.APPROVED (2)
      await expect(trustFund.connect(backer1).voteOnMilestone(1, 0, true))
        .to.emit(trustFund, "MilestoneStateChanged")
        .withArgs(1, 0, 2); // 2 = APPROVED

      const milestones = await trustFund.getMilestones(1);
      expect(milestones[0].state).to.equal(2); // APPROVED
    });

    it("should prevent double-voting by the same backer", async function () {
      await trustFund.connect(creator).submitMilestoneProof(1, 0, "ipfs://QmProof0");

      await trustFund.connect(backer2).voteOnMilestone(1, 0, true);

      await expect(
        trustFund.connect(backer2).voteOnMilestone(1, 0, true)
      ).to.be.revertedWithCustomError(trustFund, "TrustFund__AlreadyVoted");
    });
  });

  // ===========================================================================
  // 4. MILESTONE WITHDRAWAL & COMPLETION
  // ===========================================================================
  describe("4. Fund Withdrawal (Pull-Payment)", function () {
    beforeEach(async function () {
      await trustFund.connect(creator).createCampaign(
        TITLE,
        DESCRIPTION,
        IMAGE_CID,
        TARGET_AMOUNT,
        DURATION_DAYS,
        MILESTONE_PERCENTAGES,
        MILESTONE_DESCRIPTIONS
      );

      // backer1 funds 5 ETH
      await trustFund.connect(backer1).contribute(1, { value: FIVE_ETHER });

      // Creator submits milestone 0 (30% = 1.5 ETH)
      await trustFund.connect(creator).submitMilestoneProof(1, 0, "ipfs://QmProof0");

      // backer1 approves milestone 0
      await trustFund.connect(backer1).voteOnMilestone(1, 0, true);
    });

    it("should only allow creator to withdraw approved milestone funds", async function () {
      await expect(
        trustFund.connect(outsider).withdrawMilestoneFunds(1, 0)
      ).to.be.revertedWithCustomError(trustFund, "TrustFund__NotCampaignCreator");

      const expectedPayout = ethers.parseEther("1.5"); // 30% of 5 ETH

      const creatorBalanceBefore = await ethers.provider.getBalance(creator.address);

      const tx = await trustFund.connect(creator).withdrawMilestoneFunds(1, 0);
      const receipt = await tx.wait();
      const gasSpent = receipt.gasUsed * receipt.gasPrice;

      const creatorBalanceAfter = await ethers.provider.getBalance(creator.address);

      // Verify ETH transferred matches expected payout minus gas
      expect(creatorBalanceAfter).to.equal(creatorBalanceBefore + expectedPayout - gasSpent);

      const campaign = await trustFund.campaigns(1);
      expect(campaign.totalWithdrawn).to.equal(expectedPayout);
      expect(campaign.currentMilestoneIndex).to.equal(1); // advanced to Milestone 1

      const milestones = await trustFund.getMilestones(1);
      expect(milestones[0].state).to.equal(4); // MilestoneState.WITHDRAWN
    });

    it("should complete entire campaign when all 3 milestones are withdrawn", async function () {
      // Milestone 0 (30%)
      await trustFund.connect(creator).withdrawMilestoneFunds(1, 0);

      // Milestone 1 (40%)
      await trustFund.connect(creator).submitMilestoneProof(1, 1, "ipfs://QmProof1");
      await trustFund.connect(backer1).voteOnMilestone(1, 1, true);
      await trustFund.connect(creator).withdrawMilestoneFunds(1, 1);

      // Milestone 2 (30%)
      await trustFund.connect(creator).submitMilestoneProof(1, 2, "ipfs://QmProof2");
      await trustFund.connect(backer1).voteOnMilestone(1, 2, true);

      await expect(trustFund.connect(creator).withdrawMilestoneFunds(1, 2))
        .to.emit(trustFund, "CampaignStateChanged")
        .withArgs(1, 2); // 2 = COMPLETED

      const campaign = await trustFund.campaigns(1);
      expect(campaign.state).to.equal(2); // COMPLETED
      expect(campaign.totalWithdrawn).to.equal(FIVE_ETHER);
    });
  });

  // ===========================================================================
  // 5. REFUND MECHANICS
  // ===========================================================================
  describe("5. Capital Protection & Automated Refunds", function () {
    it("should grant 100% refund if campaign fails to reach target by deadline", async function () {
      await trustFund.connect(creator).createCampaign(
        TITLE,
        DESCRIPTION,
        IMAGE_CID,
        TARGET_AMOUNT,
        DURATION_DAYS,
        MILESTONE_PERCENTAGES,
        MILESTONE_DESCRIPTIONS
      );

      // backer1 deposits 2 ETH (target is 5 ETH)
      await trustFund.connect(backer1).contribute(1, { value: TWO_ETHER });

      // Fast-forward time past the 30-day deadline
      await time.increase(DURATION_DAYS * 24 * 60 * 60 + 1);

      const balanceBefore = await ethers.provider.getBalance(backer1.address);

      // backer1 claims refund
      const tx = await trustFund.connect(backer1).claimRefund(1);
      const receipt = await tx.wait();
      const gasSpent = receipt.gasUsed * receipt.gasPrice;

      const balanceAfter = await ethers.provider.getBalance(backer1.address);

      // Received full 2 ETH back minus gas
      expect(balanceAfter).to.equal(balanceBefore + TWO_ETHER - gasSpent);

      // Cannot claim refund a second time
      await expect(
        trustFund.connect(backer1).claimRefund(1)
      ).to.be.revertedWithCustomError(trustFund, "TrustFund__RefundAlreadyClaimed");
    });

    it("should grant proportional refund of remaining escrow if milestone is rejected", async function () {
      await trustFund.connect(creator).createCampaign(
        TITLE,
        DESCRIPTION,
        IMAGE_CID,
        TARGET_AMOUNT,
        DURATION_DAYS,
        MILESTONE_PERCENTAGES,
        MILESTONE_DESCRIPTIONS
      );

      // backer1 contributed 3 ETH (60%), backer2 contributed 2 ETH (40%)
      await trustFund.connect(backer1).contribute(1, { value: ethers.parseEther("3.0") });
      await trustFund.connect(backer2).contribute(1, { value: TWO_ETHER });

      // Milestone 0 (30% = 1.5 ETH) is submitted, approved, and withdrawn
      await trustFund.connect(creator).submitMilestoneProof(1, 0, "ipfs://QmProof0");
      await trustFund.connect(backer1).voteOnMilestone(1, 0, true);
      await trustFund.connect(creator).withdrawMilestoneFunds(1, 0);

      // Remaining in contract escrow = 5 ETH - 1.5 ETH = 3.5 ETH (70%)

      // Milestone 1 (40%) is submitted
      await trustFund.connect(creator).submitMilestoneProof(1, 1, "ipfs://QmProof1");

      // Backers reject milestone 1 (both vote against)
      await trustFund.connect(backer1).voteOnMilestone(1, 1, false);
      await trustFund.connect(backer2).voteOnMilestone(1, 1, false);

      // Fast forward past the 3-day voting window and finalize
      await time.increase(3 * 24 * 60 * 60 + 1);
      await trustFund.finalizeMilestoneVoting(1, 1);

      const campaign = await trustFund.campaigns(1);
      expect(campaign.state).to.equal(3); // FAILED

      // Backer 2 contributed 40% of funds.
      // Proportional refund for backer2 = 40% of remaining 3.5 ETH = 1.4 ETH
      const expectedRefundBacker2 = ethers.parseEther("1.4");

      const balanceBefore = await ethers.provider.getBalance(backer2.address);
      const tx = await trustFund.connect(backer2).claimRefund(1);
      const receipt = await tx.wait();
      const gasSpent = receipt.gasUsed * receipt.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(backer2.address);

      expect(balanceAfter).to.equal(balanceBefore + expectedRefundBacker2 - gasSpent);
    });
  });
});
