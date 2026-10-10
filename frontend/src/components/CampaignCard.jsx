import React, { useState } from "react";
import { ethers } from "ethers";
import { Users, Clock, ArrowRight, Loader2, DollarSign, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { CampaignStatusBadge } from "./StatusBadge";
import { MilestoneList } from "./MilestoneList";
import { formatEther, formatAddress, getRemainingDays } from "../utils/helpers";
import { useWeb3 } from "../context/Web3Context";

export function CampaignCard({ campaign, milestones = [], userContribution = 0n, onActionSuccess }) {
  const { contract, account } = useWeb3();

  const [isExpanded, setIsExpanded] = useState(false);
  const [contributionInput, setContributionInput] = useState("");
  const [isContributing, setIsContributing] = useState(false);
  const [isClaimingRefund, setIsClaimingRefund] = useState(false);
  const [cardError, setCardError] = useState("");

  const campaignId = campaign.id;
  const isCreator = account && campaign.creator && account.toLowerCase() === campaign.creator.toLowerCase();
  const isBacker = userContribution > 0n;

  const targetEth = parseFloat(ethers.formatEther(campaign.targetAmount.toString()));
  const raisedEth = parseFloat(ethers.formatEther(campaign.totalRaised.toString()));
  const percentFunded = targetEth > 0 ? Math.min(100, Math.round((raisedEth / targetEth) * 100)) : 0;
  const remainingDays = getRemainingDays(campaign.deadline);

  // Contribute ETH
  const handleContribute = async (e) => {
    e.preventDefault();
    setCardError("");

    const val = parseFloat(contributionInput);
    if (isNaN(val) || val <= 0) {
      setCardError("Please enter a valid ETH amount.");
      return;
    }

    try {
      setIsContributing(true);
      const tx = await contract.contribute(campaignId, {
        value: ethers.parseEther(contributionInput.trim()),
      });
      await tx.wait();
      setContributionInput("");
      onActionSuccess();
    } catch (err) {
      console.error("Contribution failed:", err);
      setCardError(err.reason || err.message || "Contribution transaction failed");
    } finally {
      setIsContributing(false);
    }
  };

  // Claim Refund
  const handleClaimRefund = async () => {
    try {
      setIsClaimingRefund(true);
      setCardError("");
      const tx = await contract.claimRefund(campaignId);
      await tx.wait();
      onActionSuccess();
    } catch (err) {
      console.error("Refund claim failed:", err);
      setCardError(err.reason || err.message || "Refund claim failed");
    } finally {
      setIsClaimingRefund(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl hover:border-slate-700 transition-all">
      {/* Banner Image */}
      <div className="relative h-48 w-full bg-slate-950 overflow-hidden">
        <img
          src={campaign.imageCid || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80"}
          alt={campaign.title}
          className="w-full h-full object-cover opacity-80"
          onError={(e) => {
            e.target.src = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80";
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
        <div className="absolute top-4 left-4">
          <CampaignStatusBadge state={campaign.state} />
        </div>
        <div className="absolute top-4 right-4 bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-mono text-slate-300 border border-slate-800">
          Created by: {formatAddress(campaign.creator)}
        </div>
      </div>

      {/* Body Content */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-lg font-bold text-white hover:text-indigo-400 transition-colors">
            {campaign.title}
          </h3>
        </div>

        <p className="text-slate-400 text-xs line-clamp-2 mb-4">{campaign.description}</p>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-bold text-white">{percentFunded}% funded</span>
            <span className="text-slate-400 font-mono">
              {formatEther(campaign.totalRaised)} / {formatEther(campaign.targetAmount)} ETH
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
              style={{ width: `${percentFunded}%` }}
            />
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-2 py-3 px-3 rounded-xl bg-slate-950 border border-slate-800/80 mb-4 text-center">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-slate-500 block">Days Left</span>
            <span className="text-xs font-semibold text-white flex items-center justify-center gap-1 mt-0.5">
              <Clock className="w-3 h-3 text-slate-400" />
              {remainingDays}d
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-slate-500 block">Milestones</span>
            <span className="text-xs font-semibold text-indigo-400 block mt-0.5">
              {Number(campaign.currentMilestoneIndex) + 1}/{Number(campaign.milestoneCount)}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-slate-500 block">My Stake</span>
            <span className="text-xs font-semibold text-emerald-400 block mt-0.5">
              {formatEther(userContribution)} ETH
            </span>
          </div>
        </div>

        {cardError && (
          <div className="mb-4 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {cardError}
          </div>
        )}

        {/* Action Bar (Contribution or Refund) */}
        {Number(campaign.state) === 0 && account && (
          <form onSubmit={handleContribute} className="flex items-center gap-2 mb-4">
            <div className="relative flex-1">
              <input
                type="number"
                step="0.01"
                min="0.001"
                placeholder="Amount in ETH"
                value={contributionInput}
                onChange={(e) => setContributionInput(e.target.value)}
                className="w-full pl-3 pr-8 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <span className="absolute right-2.5 top-2.5 text-xs text-slate-500 font-mono">ETH</span>
            </div>
            <button
              type="submit"
              disabled={isContributing}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white text-xs font-bold transition-all shadow"
            >
              {isContributing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <DollarSign className="w-3.5 h-3.5" />
              )}
              <span>Back Project</span>
            </button>
          </form>
        )}

        {/* Refund Action if Failed */}
        {Number(campaign.state) === 3 && isBacker && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-rose-300 block">Campaign Inactive/Failed</span>
              <span className="text-[11px] text-slate-400">You are eligible to claim a refund.</span>
            </div>
            <button
              onClick={handleClaimRefund}
              disabled={isClaimingRefund}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors"
            >
              {isClaimingRefund ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              <span>Claim Refund</span>
            </button>
          </div>
        )}

        {/* Milestone Expand Toggle */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-semibold text-slate-300 hover:text-white transition-colors"
        >
          <span>Milestones & Escrow Governance ({milestones.length})</span>
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {/* Expanded Milestone List */}
        {isExpanded && (
          <div className="mt-4 pt-3 border-t border-slate-800/80">
            <MilestoneList
              campaign={campaign}
              milestones={milestones}
              isCreator={isCreator}
              isBacker={isBacker}
              onActionSuccess={onActionSuccess}
            />
          </div>
        )}
      </div>
    </div>
  );
}
