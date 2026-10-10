import React, { useState } from "react";
import { ethers } from "ethers";
import { CheckCircle2, XCircle, ArrowUpRight, Loader2, Send, ThumbsUp, ThumbsDown, DollarSign } from "lucide-react";
import { MilestoneStatusBadge } from "./StatusBadge";
import { formatEther, formatTimestamp } from "../utils/helpers";
import { useWeb3 } from "../context/Web3Context";

export function MilestoneList({ campaign, milestones, isCreator, isBacker, onActionSuccess }) {
  const { contract, account } = useWeb3();

  const [proofInputs, setProofInputs] = useState({});
  const [loadingAction, setLoadingAction] = useState("");
  const [actionError, setActionError] = useState("");

  const handleProofInputChange = (index, value) => {
    setProofInputs((prev) => ({ ...prev, [index]: value }));
  };

  // 1. Creator submits proof
  const handleSubmitProof = async (milestoneIndex) => {
    const proofUrl = proofInputs[milestoneIndex];
    if (!proofUrl || !proofUrl.trim()) return;

    try {
      setLoadingAction(`submit-${milestoneIndex}`);
      setActionError("");
      const tx = await contract.submitMilestoneProof(campaign.id, milestoneIndex, proofUrl.trim());
      await tx.wait();
      onActionSuccess();
    } catch (err) {
      console.error("Proof submission failed:", err);
      setActionError(err.reason || err.message || "Failed to submit milestone proof");
    } finally {
      setLoadingAction("");
    }
  };

  // 2. Backer votes on milestone
  const handleVote = async (milestoneIndex, approve) => {
    try {
      setLoadingAction(`vote-${milestoneIndex}-${approve}`);
      setActionError("");
      const tx = await contract.voteOnMilestone(campaign.id, milestoneIndex, approve);
      await tx.wait();
      onActionSuccess();
    } catch (err) {
      console.error("Voting failed:", err);
      setActionError(err.reason || err.message || "Failed to cast vote");
    } finally {
      setLoadingAction("");
    }
  };

  // 3. Creator withdraws funds
  const handleWithdraw = async (milestoneIndex) => {
    try {
      setLoadingAction(`withdraw-${milestoneIndex}`);
      setActionError("");
      const tx = await contract.withdrawMilestoneFunds(campaign.id, milestoneIndex);
      await tx.wait();
      onActionSuccess();
    } catch (err) {
      console.error("Withdrawal failed:", err);
      setActionError(err.reason || err.message || "Failed to withdraw payout");
    } finally {
      setLoadingAction("");
    }
  };

  // 4. Finalize voting if time elapsed
  const handleFinalize = async (milestoneIndex) => {
    try {
      setLoadingAction(`finalize-${milestoneIndex}`);
      setActionError("");
      const tx = await contract.finalizeMilestoneVoting(campaign.id, milestoneIndex);
      await tx.wait();
      onActionSuccess();
    } catch (err) {
      console.error("Finalization failed:", err);
      setActionError(err.reason || err.message || "Failed to finalize voting");
    } finally {
      setLoadingAction("");
    }
  };

  const totalRaisedWei = campaign.totalRaised || 0n;

  return (
    <div className="space-y-4">
      {actionError && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
          {actionError}
        </div>
      )}

      {milestones.map((m, idx) => {
        const milestoneState = Number(m.state);
        const milestonePercentage = Number(m.percentage);
        const trancheEth = (parseFloat(ethers.formatEther(totalRaisedWei.toString())) * milestonePercentage) / 100;

        const isCurrentActive = Number(campaign.currentMilestoneIndex) === idx && Number(campaign.state) === 1;
        const votesFor = m.votesFor || 0n;
        const votesAgainst = m.votesAgainst || 0n;
        const totalVotes = votesFor + votesAgainst;
        const approvalThreshold = totalRaisedWei > 0n ? totalRaisedWei / 2n : 1n;

        const forPercent = totalVotes > 0n ? Math.min(100, Math.round((Number(votesFor) / Number(totalVotes)) * 100)) : 0;

        return (
          <div
            key={idx}
            className={`p-4 rounded-xl border transition-all ${
              isCurrentActive
                ? "bg-slate-900/90 border-indigo-500/40 shadow-lg shadow-indigo-500/5"
                : "bg-slate-950/60 border-slate-800"
            }`}
          >
            {/* Top row */}
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 text-xs font-mono flex items-center justify-center font-bold">
                  {idx + 1}
                </span>
                <h5 className="text-sm font-semibold text-white">{m.description}</h5>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-mono text-indigo-400 font-semibold">
                  {milestonePercentage}% (~{trancheEth.toFixed(2)} ETH)
                </span>
                <MilestoneStatusBadge state={milestoneState} />
              </div>
            </div>

            {/* Proof URL if exists */}
            {m.proofUrl && (
              <div className="mt-2 text-xs flex items-center gap-1.5 text-slate-400">
                <span>Deliverable Proof:</span>
                <a
                  href={m.proofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-0.5 underline font-mono truncate max-w-xs"
                >
                  {m.proofUrl}
                  <ArrowUpRight className="w-3 h-3" />
                </a>
              </div>
            )}

            {/* Voting Metrics (if submitted or approved) */}
            {milestoneState >= 1 && (
              <div className="mt-3 pt-3 border-t border-slate-800/80">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>Backer Consensus ({forPercent}% Yes)</span>
                  <span>
                    Approval Threshold: &gt;50% ({formatEther(approvalThreshold)} ETH)
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden flex">
                  <div className="bg-emerald-500 h-full transition-all" style={{ width: `${forPercent}%` }} />
                  <div className="bg-rose-500 h-full transition-all" style={{ width: `${100 - forPercent}%` }} />
                </div>
              </div>
            )}

            {/* Actions Panel */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {/* Creator: Submit proof for PENDING milestone */}
              {isCreator && isCurrentActive && milestoneState === 0 && (
                <div className="flex items-center gap-2 w-full">
                  <input
                    type="text"
                    value={proofInputs[idx] || ""}
                    onChange={(e) => handleProofInputChange(idx, e.target.value)}
                    placeholder="Enter proof link (IPFS CID, GitHub PR, video demo)"
                    className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={() => handleSubmitProof(idx)}
                    disabled={loadingAction === `submit-${idx}` || !proofInputs[idx]}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition-colors"
                  >
                    {loadingAction === `submit-${idx}` ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>Submit Proof</span>
                  </button>
                </div>
              )}

              {/* Backer: Vote on SUBMITTED milestone */}
              {isBacker && milestoneState === 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleVote(idx, true)}
                    disabled={loadingAction.startsWith(`vote-${idx}`)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 text-xs font-semibold transition-colors"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span>Approve (Yes)</span>
                  </button>
                  <button
                    onClick={() => handleVote(idx, false)}
                    disabled={loadingAction.startsWith(`vote-${idx}`)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/20 text-rose-300 border border-rose-500/30 hover:bg-rose-600/30 text-xs font-semibold transition-colors"
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                    <span>Reject (No)</span>
                  </button>
                </div>
              )}

              {/* Creator: Withdraw funds for APPROVED milestone */}
              {isCreator && isCurrentActive && milestoneState === 2 && (
                <button
                  onClick={() => handleWithdraw(idx)}
                  disabled={loadingAction === `withdraw-${idx}`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-colors"
                >
                  {loadingAction === `withdraw-${idx}` ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <DollarSign className="w-3.5 h-3.5" />
                  )}
                  <span>Withdraw Payout ({trancheEth.toFixed(2)} ETH)</span>
                </button>
              )}

              {/* Finalize voting button if voting deadline has passed */}
              {milestoneState === 1 && m.votingDeadline && Number(m.votingDeadline) * 1000 < Date.now() && (
                <button
                  onClick={() => handleFinalize(idx)}
                  disabled={loadingAction === `finalize-${idx}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-medium border border-slate-700 transition-colors"
                >
                  <span>Finalize Voting</span>
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
