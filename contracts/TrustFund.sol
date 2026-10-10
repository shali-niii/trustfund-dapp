// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TrustFund - Milestone-Based Escrow Crowdfunding Platform
 * @author Senior Blockchain Developer
 * @notice Manages decentralized crowdfunding campaigns with milestone-governed escrow release,
 *         democratic backer voting, and automated pull-payment refunds.
 */
contract TrustFund is ReentrancyGuard {

    // =========================================================================
    // CUSTOM ERRORS (Gas-efficient alternative to revert strings)
    // =========================================================================
    error TrustFund__InvalidTargetAmount();
    error TrustFund__InvalidDuration();
    error TrustFund__InvalidMilestones();
    error TrustFund__PercentagesMustSumTo100(uint256 currentSum);
    error TrustFund__CampaignNotFound();
    error TrustFund__CampaignNotInFundingState();
    error TrustFund__CampaignDeadlinePassed();
    error TrustFund__ContributionMustBeGreaterThanZero();
    error TrustFund__NotCampaignCreator();
    error TrustFund__NotABacker();
    error TrustFund__AlreadyVoted();
    error TrustFund__CampaignNotActive();
    error TrustFund__InvalidMilestoneIndex();
    error TrustFund__MilestoneNotInSubmittedState();
    error TrustFund__MilestoneAlreadyProcessed();
    error TrustFund__MilestoneNotApproved();
    error TrustFund__VotingStillActive();
    error TrustFund__CampaignNotFailed();
    error TrustFund__RefundAlreadyClaimed();
    error TrustFund__NoEligibleRefund();
    error TrustFund__TransferFailed();

    // =========================================================================
    // ENUMS & STRUCTS
    // =========================================================================

    enum CampaignState {
        FUNDING,    // Accepting backer contributions
        ACTIVE,     // Funding goal reached; undergoing milestone execution
        COMPLETED,  // All milestones completed and funds fully disbursed
        FAILED      // Failed to reach goal or abandoned; refunds unlocked
    }

    enum MilestoneState {
        PENDING,    // Initial state before creator submits work proof
        SUBMITTED,  // Proof submitted by creator; open for backer voting
        APPROVED,   // Backer majority approved milestone release
        REJECTED,   // Backers rejected milestone proof
        WITHDRAWN   // Creator has withdrawn the milestone allocation
    }

    struct Milestone {
        string description;      // Goal of this specific milestone
        string proofUrl;         // IPFS hash or URL documenting deliverable proof
        uint256 percentage;      // Allocation percentage of total raised (sum of all = 100)
        MilestoneState state;    // Current state of this milestone
        uint256 votesFor;        // Cumulative weight of YES votes (measured in Wei contributed)
        uint256 votesAgainst;    // Cumulative weight of NO votes
        uint256 votingDeadline;  // Timestamp when backer voting closes
    }

    struct Campaign {
        uint256 id;
        address payable creator;
        string title;
        string description;
        string imageCid;             // IPFS hash or URL for project hero banner
        uint256 targetAmount;        // In Wei
        uint256 deadline;            // Timestamp
        uint256 totalRaised;         // In Wei
        uint256 totalWithdrawn;      // In Wei released to creator so far
        uint256 currentMilestoneIndex;
        uint256 milestoneCount;
        CampaignState state;
        uint256 createdAt;
    }

    // =========================================================================
    // STATE VARIABLES
    // =========================================================================

    uint256 public campaignCount;
    uint256 public constant VOTING_DURATION = 3 days;

    // campaignId => Campaign
    mapping(uint256 => Campaign) public campaigns;

    // campaignId => array of Milestones
    mapping(uint256 => Milestone[]) private campaignMilestones;

    // campaignId => backer address => amount contributed (in Wei)
    mapping(uint256 => mapping(address => uint256)) public contributions;

    // campaignId => milestoneIndex => backer address => voted (true/false)
    mapping(uint256 => mapping(uint256 => mapping(address => bool))) public hasVoted;

    // campaignId => backer address => claimed refund (true/false)
    mapping(uint256 => mapping(address => bool)) public hasClaimedRefund;

    // campaignId => list of unique backer addresses
    mapping(uint256 => address[]) private campaignBackers;

    // =========================================================================
    // EVENTS
    // =========================================================================

    event CampaignCreated(
        uint256 indexed campaignId,
        address indexed creator,
        string title,
        uint256 targetAmount,
        uint256 deadline,
        uint256 milestoneCount
    );

    event ContributionReceived(
        uint256 indexed campaignId,
        address indexed backer,
        uint256 amount,
        uint256 totalRaised
    );

    event CampaignStateChanged(
        uint256 indexed campaignId,
        CampaignState newState
    );

    event MilestoneProofSubmitted(
        uint256 indexed campaignId,
        uint256 indexed milestoneIndex,
        string proofUrl,
        uint256 votingDeadline
    );

    event MilestoneVoted(
        uint256 indexed campaignId,
        uint256 indexed milestoneIndex,
        address indexed backer,
        bool approval,
        uint256 voteWeight
    );

    event MilestoneStateChanged(
        uint256 indexed campaignId,
        uint256 indexed milestoneIndex,
        MilestoneState newState
    );

    event MilestoneFundsWithdrawn(
        uint256 indexed campaignId,
        uint256 indexed milestoneIndex,
        address indexed creator,
        uint256 amount
    );

    event RefundClaimed(
        uint256 indexed campaignId,
        address indexed backer,
        uint256 refundAmount
    );

    // =========================================================================
    // MODIFIERS
    // =========================================================================

    modifier onlyCreator(uint256 _campaignId) {
        if (msg.sender != campaigns[_campaignId].creator) {
            revert TrustFund__NotCampaignCreator();
        }
        _;
    }

    modifier onlyBacker(uint256 _campaignId) {
        if (contributions[_campaignId][msg.sender] == 0) {
            revert TrustFund__NotABacker();
        }
        _;
    }

    modifier campaignExists(uint256 _campaignId) {
        if (_campaignId == 0 || _campaignId > campaignCount) {
            revert TrustFund__CampaignNotFound();
        }
        _;
    }

    // =========================================================================
    // CORE FUNCTIONS
    // =========================================================================

    /**
     * @notice Launch a new crowdfunding campaign with milestone partitioning.
     * @param _title Campaign title
     * @param _description Campaign overview and roadmap
     * @param _imageCid IPFS CID or media URL
     * @param _targetAmount Funding target in Wei
     * @param _durationInDays Duration of funding phase in days
     * @param _percentages Array of milestone percentage allocations (sum must equal 100)
     * @param _descriptions Array of milestone deliverable descriptions
     * @return newCampaignId Identifier of created campaign
     */
    function createCampaign(
        string calldata _title,
        string calldata _description,
        string calldata _imageCid,
        uint256 _targetAmount,
        uint256 _durationInDays,
        uint256[] calldata _percentages,
        string[] calldata _descriptions
    ) external returns (uint256 newCampaignId) {
        if (_targetAmount == 0) revert TrustFund__InvalidTargetAmount();
        if (_durationInDays == 0 || _durationInDays > 365) revert TrustFund__InvalidDuration();
        if (_percentages.length == 0 || _percentages.length != _descriptions.length) {
            revert TrustFund__InvalidMilestones();
        }

        uint256 totalPercentage = 0;
        for (uint256 i = 0; i < _percentages.length; i++) {
            if (_percentages[i] == 0) revert TrustFund__InvalidMilestones();
            totalPercentage += _percentages[i];
        }

        if (totalPercentage != 100) {
            revert TrustFund__PercentagesMustSumTo100(totalPercentage);
        }

        campaignCount++;
        newCampaignId = campaignCount;

        uint256 deadlineTimestamp = block.timestamp + (_durationInDays * 1 days);

        Campaign storage c = campaigns[newCampaignId];
        c.id = newCampaignId;
        c.creator = payable(msg.sender);
        c.title = _title;
        c.description = _description;
        c.imageCid = _imageCid;
        c.targetAmount = _targetAmount;
        c.deadline = deadlineTimestamp;
        c.totalRaised = 0;
        c.totalWithdrawn = 0;
        c.currentMilestoneIndex = 0;
        c.milestoneCount = _percentages.length;
        c.state = CampaignState.FUNDING;
        c.createdAt = block.timestamp;

        // Initialize milestones
        for (uint256 i = 0; i < _percentages.length; i++) {
            campaignMilestones[newCampaignId].push(
                Milestone({
                    description: _descriptions[i],
                    proofUrl: "",
                    percentage: _percentages[i],
                    state: MilestoneState.PENDING,
                    votesFor: 0,
                    votesAgainst: 0,
                    votingDeadline: 0
                })
            );
        }

        emit CampaignCreated(
            newCampaignId,
            msg.sender,
            _title,
            _targetAmount,
            deadlineTimestamp,
            _percentages.length
        );
    }

    /**
     * @notice Contribute native ETH to an active crowdfunding campaign.
     * @dev Automatically updates state to ACTIVE if target reached before deadline.
     * @param _campaignId Identifier of campaign
     */
    function contribute(uint256 _campaignId) 
        external 
        payable 
        campaignExists(_campaignId) 
        nonReentrant 
    {
        Campaign storage campaign = campaigns[_campaignId];

        // Ensure funding stage is currently valid
        _evaluateFundingDeadline(campaign);

        if (campaign.state != CampaignState.FUNDING) {
            revert TrustFund__CampaignNotInFundingState();
        }
        if (msg.value == 0) {
            revert TrustFund__ContributionMustBeGreaterThanZero();
        }

        // Record backer contribution
        if (contributions[_campaignId][msg.sender] == 0) {
            campaignBackers[_campaignId].push(msg.sender);
        }

        contributions[_campaignId][msg.sender] += msg.value;
        campaign.totalRaised += msg.value;

        emit ContributionReceived(
            _campaignId, 
            msg.sender, 
            msg.value, 
            campaign.totalRaised
        );

        // Check if funding goal has been achieved
        if (campaign.totalRaised >= campaign.targetAmount) {
            campaign.state = CampaignState.ACTIVE;
            emit CampaignStateChanged(_campaignId, CampaignState.ACTIVE);
        }
    }

    /**
     * @notice Creator submits proof of milestone completion, opening backer voting.
     * @param _campaignId Identifier of campaign
     * @param _milestoneIndex Index of the milestone being submitted
     * @param _proofUrl IPFS hash or URL documenting completion proof
     */
    function submitMilestoneProof(
        uint256 _campaignId,
        uint256 _milestoneIndex,
        string calldata _proofUrl
    ) 
        external 
        campaignExists(_campaignId) 
        onlyCreator(_campaignId) 
    {
        Campaign storage campaign = campaigns[_campaignId];
        _evaluateFundingDeadline(campaign);

        if (campaign.state != CampaignState.ACTIVE) {
            revert TrustFund__CampaignNotActive();
        }
        if (_milestoneIndex != campaign.currentMilestoneIndex) {
            revert TrustFund__InvalidMilestoneIndex();
        }

        Milestone storage milestone = campaignMilestones[_campaignId][_milestoneIndex];
        if (milestone.state != MilestoneState.PENDING) {
            revert TrustFund__MilestoneAlreadyProcessed();
        }

        milestone.proofUrl = _proofUrl;
        milestone.state = MilestoneState.SUBMITTED;
        milestone.votingDeadline = block.timestamp + VOTING_DURATION;

        emit MilestoneProofSubmitted(
            _campaignId,
            _milestoneIndex,
            _proofUrl,
            milestone.votingDeadline
        );
        emit MilestoneStateChanged(
            _campaignId,
            _milestoneIndex,
            MilestoneState.SUBMITTED
        );
    }

    /**
     * @notice Backers vote on submitted milestone. Vote power is proportional to ETH contributed.
     * @dev If approval passes >50% threshold of total funds raised, milestone automatically approves.
     * @param _campaignId Identifier of campaign
     * @param _milestoneIndex Index of submitted milestone
     * @param _approve True for YES, False for NO
     */
    function voteOnMilestone(
        uint256 _campaignId,
        uint256 _milestoneIndex,
        bool _approve
    ) 
        external 
        campaignExists(_campaignId) 
        onlyBacker(_campaignId) 
    {
        Campaign storage campaign = campaigns[_campaignId];
        if (campaign.state != CampaignState.ACTIVE) {
            revert TrustFund__CampaignNotActive();
        }
        if (_milestoneIndex != campaign.currentMilestoneIndex) {
            revert TrustFund__InvalidMilestoneIndex();
        }

        Milestone storage milestone = campaignMilestones[_campaignId][_milestoneIndex];
        if (milestone.state != MilestoneState.SUBMITTED) {
            revert TrustFund__MilestoneNotInSubmittedState();
        }
        if (hasVoted[_campaignId][_milestoneIndex][msg.sender]) {
            revert TrustFund__AlreadyVoted();
        }

        uint256 weight = contributions[_campaignId][msg.sender];
        hasVoted[_campaignId][_milestoneIndex][msg.sender] = true;

        if (_approve) {
            milestone.votesFor += weight;
        } else {
            milestone.votesAgainst += weight;
        }

        emit MilestoneVoted(
            _campaignId,
            _milestoneIndex,
            msg.sender,
            _approve,
            weight
        );

        // Immediate approval if more than 50% of total capital supports it
        if (milestone.votesFor > (campaign.totalRaised / 2)) {
            milestone.state = MilestoneState.APPROVED;
            emit MilestoneStateChanged(
                _campaignId,
                _milestoneIndex,
                MilestoneState.APPROVED
            );
        }
    }

    /**
     * @notice Finalizes milestone voting if voting duration has elapsed.
     * @param _campaignId Identifier of campaign
     * @param _milestoneIndex Index of submitted milestone
     */
    function finalizeMilestoneVoting(
        uint256 _campaignId,
        uint256 _milestoneIndex
    ) 
        external 
        campaignExists(_campaignId) 
    {
        Campaign storage campaign = campaigns[_campaignId];
        if (campaign.state != CampaignState.ACTIVE) {
            revert TrustFund__CampaignNotActive();
        }

        Milestone storage milestone = campaignMilestones[_campaignId][_milestoneIndex];
        if (milestone.state != MilestoneState.SUBMITTED) {
            revert TrustFund__MilestoneNotInSubmittedState();
        }
        if (block.timestamp < milestone.votingDeadline) {
            revert TrustFund__VotingStillActive();
        }

        if (milestone.votesFor > milestone.votesAgainst) {
            milestone.state = MilestoneState.APPROVED;
            emit MilestoneStateChanged(
                _campaignId,
                _milestoneIndex,
                MilestoneState.APPROVED
            );
        } else {
            milestone.state = MilestoneState.REJECTED;
            campaign.state = CampaignState.FAILED;

            emit MilestoneStateChanged(
                _campaignId,
                _milestoneIndex,
                MilestoneState.REJECTED
            );
            emit CampaignStateChanged(_campaignId, CampaignState.FAILED);
        }
    }

    /**
     * @notice Creator pulls released funds for an approved milestone.
     * @dev Implements Checks-Effects-Interactions (CEI) and ReentrancyGuard.
     * @param _campaignId Identifier of campaign
     * @param _milestoneIndex Index of approved milestone
     */
    function withdrawMilestoneFunds(
        uint256 _campaignId,
        uint256 _milestoneIndex
    ) 
        external 
        campaignExists(_campaignId) 
        onlyCreator(_campaignId) 
        nonReentrant 
    {
        Campaign storage campaign = campaigns[_campaignId];
        if (campaign.state != CampaignState.ACTIVE) {
            revert TrustFund__CampaignNotActive();
        }
        if (_milestoneIndex != campaign.currentMilestoneIndex) {
            revert TrustFund__InvalidMilestoneIndex();
        }

        Milestone storage milestone = campaignMilestones[_campaignId][_milestoneIndex];
        if (milestone.state != MilestoneState.APPROVED) {
            revert TrustFund__MilestoneNotApproved();
        }

        // Calculate milestone allocation: (totalRaised * percentage) / 100
        uint256 payoutAmount = (campaign.totalRaised * milestone.percentage) / 100;

        // EFFECTS: Update state before transferring funds
        milestone.state = MilestoneState.WITHDRAWN;
        campaign.totalWithdrawn += payoutAmount;

        // Check if all milestones have been completed
        if (campaign.currentMilestoneIndex + 1 == campaign.milestoneCount) {
            campaign.state = CampaignState.COMPLETED;
            emit CampaignStateChanged(_campaignId, CampaignState.COMPLETED);
        } else {
            campaign.currentMilestoneIndex++;
        }

        emit MilestoneStateChanged(
            _campaignId,
            _milestoneIndex,
            MilestoneState.WITHDRAWN
        );
        emit MilestoneFundsWithdrawn(
            _campaignId,
            _milestoneIndex,
            msg.sender,
            payoutAmount
        );

        // INTERACTIONS: Transfer native ETH to creator
        (bool success, ) = campaign.creator.call{value: payoutAmount}("");
        if (!success) {
            revert TrustFund__TransferFailed();
        }
    }

    /**
     * @notice Backer claims a pull-payment refund if a campaign fails.
     * @dev Handles both:
     *      1. Unsuccessful funding phase: 100% refund.
     *      2. Mid-campaign failure/milestone rejection: proportional share of remaining escrow.
     * @param _campaignId Identifier of failed campaign
     */
    function claimRefund(uint256 _campaignId) 
        external 
        campaignExists(_campaignId) 
        onlyBacker(_campaignId) 
        nonReentrant 
    {
        Campaign storage campaign = campaigns[_campaignId];
        _evaluateFundingDeadline(campaign);

        if (campaign.state != CampaignState.FAILED) {
            revert TrustFund__CampaignNotFailed();
        }
        if (hasClaimedRefund[_campaignId][msg.sender]) {
            revert TrustFund__RefundAlreadyClaimed();
        }

        uint256 backerContribution = contributions[_campaignId][msg.sender];
        if (backerContribution == 0) {
            revert TrustFund__NoEligibleRefund();
        }

        // Calculate refund share:
        // remainingEscrow = totalRaised - totalWithdrawn
        // backerRefund = (backerContribution * remainingEscrow) / totalRaised
        uint256 remainingEscrow = campaign.totalRaised - campaign.totalWithdrawn;
        uint256 refundAmount = (backerContribution * remainingEscrow) / campaign.totalRaised;

        if (refundAmount == 0) {
            revert TrustFund__NoEligibleRefund();
        }

        // EFFECTS: Mark refund claimed before transfer
        hasClaimedRefund[_campaignId][msg.sender] = true;

        emit RefundClaimed(_campaignId, msg.sender, refundAmount);

        // INTERACTIONS: Transfer native ETH to backer
        (bool success, ) = payable(msg.sender).call{value: refundAmount}("");
        if (!success) {
            revert TrustFund__TransferFailed();
        }
    }

    // =========================================================================
    // VIEW / GETTER FUNCTIONS (Designed for frontend integration)
    // =========================================================================

    /**
     * @notice Returns all milestones for a campaign.
     * @param _campaignId Identifier of campaign
     */
    function getMilestones(uint256 _campaignId) 
        external 
        view 
        campaignExists(_campaignId) 
        returns (Milestone[] memory) 
    {
        return campaignMilestones[_campaignId];
    }

    /**
     * @notice Returns total number of unique backers for a campaign.
     * @param _campaignId Identifier of campaign
     */
    function getBackerCount(uint256 _campaignId) 
        external 
        view 
        campaignExists(_campaignId) 
        returns (uint256) 
    {
        return campaignBackers[_campaignId].length;
    }

    /**
     * @notice Returns array of all backers for a campaign.
     * @param _campaignId Identifier of campaign
     */
    function getBackers(uint256 _campaignId) 
        external 
        view 
        campaignExists(_campaignId) 
        returns (address[] memory) 
    {
        return campaignBackers[_campaignId];
    }

    /**
     * @notice Returns remaining escrow balance held in contract for a campaign.
     * @param _campaignId Identifier of campaign
     */
    function getRemainingEscrow(uint256 _campaignId) 
        external 
        view 
        campaignExists(_campaignId) 
        returns (uint256) 
    {
        return campaigns[_campaignId].totalRaised - campaigns[_campaignId].totalWithdrawn;
    }

    // =========================================================================
    // INTERNAL HELPERS
    // =========================================================================

    /**
     * @dev Automatically updates campaign state if funding deadline has expired.
     */
    function _evaluateFundingDeadline(Campaign storage _campaign) internal {
        if (_campaign.state == CampaignState.FUNDING && block.timestamp >= _campaign.deadline) {
            if (_campaign.totalRaised >= _campaign.targetAmount) {
                _campaign.state = CampaignState.ACTIVE;
                emit CampaignStateChanged(_campaign.id, CampaignState.ACTIVE);
            } else {
                _campaign.state = CampaignState.FAILED;
                emit CampaignStateChanged(_campaign.id, CampaignState.FAILED);
            }
        }
    }
}
