import { ethers } from "ethers";

/**
 * Shortens an Ethereum address for display (e.g. 0x1234...5678)
 */
export function formatAddress(address) {
  if (!address) return "";
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

/**
 * Converts Wei (BigInt or string) to ETH string with fixed decimals
 */
export function formatEther(weiValue, decimals = 3) {
  if (!weiValue) return "0";
  try {
    const eth = ethers.formatEther(weiValue.toString());
    const parsed = parseFloat(eth);
    return parsed.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    });
  } catch (err) {
    return "0";
  }
}

/**
 * Formats unix timestamp to readable date
 */
export function formatTimestamp(timestamp) {
  if (!timestamp) return "";
  const date = new Date(Number(timestamp) * 1000);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Calculates remaining days from deadline timestamp
 */
export function getRemainingDays(deadline) {
  if (!deadline) return 0;
  const now = Math.floor(Date.now() / 1000);
  const diffSeconds = Number(deadline) - now;
  if (diffSeconds <= 0) return 0;
  return Math.ceil(diffSeconds / (60 * 60 * 24));
}

/**
 * Returns human label and styling for CampaignState enum
 */
export function getCampaignStateMeta(stateIndex) {
  switch (Number(stateIndex)) {
    case 0:
      return {
        label: "Funding",
        color: "bg-amber-500/10 text-amber-400 border-amber-500/30",
        dot: "bg-amber-400",
      };
    case 1:
      return {
        label: "Active",
        color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
        dot: "bg-emerald-400",
      };
    case 2:
      return {
        label: "Completed",
        color: "bg-blue-500/10 text-blue-400 border-blue-500/30",
        dot: "bg-blue-400",
      };
    case 3:
      return {
        label: "Failed",
        color: "bg-rose-500/10 text-rose-400 border-rose-500/30",
        dot: "bg-rose-400",
      };
    default:
      return {
        label: "Unknown",
        color: "bg-gray-500/10 text-gray-400 border-gray-500/30",
        dot: "bg-gray-400",
      };
  }
}

/**
 * Returns human label and styling for MilestoneState enum
 */
export function getMilestoneStateMeta(stateIndex) {
  switch (Number(stateIndex)) {
    case 0:
      return {
        label: "Pending",
        color: "bg-slate-700/50 text-slate-300 border-slate-600",
      };
    case 1:
      return {
        label: "Under Review",
        color: "bg-purple-500/20 text-purple-300 border-purple-500/40",
      };
    case 2:
      return {
        label: "Approved",
        color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
      };
    case 3:
      return {
        label: "Rejected",
        color: "bg-rose-500/20 text-rose-300 border-rose-500/40",
      };
    case 4:
      return {
        label: "Withdrawn",
        color: "bg-blue-500/20 text-blue-300 border-blue-500/40",
      };
    default:
      return {
        label: "Pending",
        color: "bg-slate-700/50 text-slate-300 border-slate-600",
      };
  }
}
