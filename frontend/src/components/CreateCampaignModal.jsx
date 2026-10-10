import React, { useState } from "react";
import { ethers } from "ethers";
import { X, Plus, Trash2, Loader2, AlertCircle } from "lucide-react";
import { useWeb3 } from "../context/Web3Context";

export function CreateCampaignModal({ isOpen, onClose, onCreated }) {
  const { contract } = useWeb3();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageCid, setImageCid] = useState("");
  const [targetAmountEth, setTargetAmountEth] = useState("");
  const [durationDays, setDurationDays] = useState("30");

  const [milestones, setMilestones] = useState([
    { description: "Milestone 1: Prototype Development", percentage: "40" },
    { description: "Milestone 2: Security Audit & Beta Launch", percentage: "30" },
    { description: "Milestone 3: Production Rollout", percentage: "30" },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  if (!isOpen) return null;

  const totalPercentage = milestones.reduce((sum, m) => sum + (Number(m.percentage) || 0), 0);

  const handleMilestoneChange = (index, field, value) => {
    const updated = [...milestones];
    updated[index][field] = value;
    setMilestones(updated);
  };

  const addMilestone = () => {
    setMilestones([...milestones, { description: "", percentage: "" }]);
  };

  const removeMilestone = (index) => {
    if (milestones.length <= 1) return;
    setMilestones(milestones.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!contract) {
      setFormError("Smart contract instance not connected. Please connect MetaMask.");
      return;
    }

    if (!title.trim() || !description.trim()) {
      setFormError("Title and description are required.");
      return;
    }

    const ethValue = parseFloat(targetAmountEth);
    if (isNaN(ethValue) || ethValue <= 0) {
      setFormError("Target amount must be a positive number.");
      return;
    }

    const days = parseInt(durationDays, 10);
    if (isNaN(days) || days <= 0 || days > 365) {
      setFormError("Funding duration must be between 1 and 365 days.");
      return;
    }

    if (totalPercentage !== 100) {
      setFormError(`Milestone allocations must sum to exactly 100% (currently ${totalPercentage}%).`);
      return;
    }

    for (let i = 0; i < milestones.length; i++) {
      if (!milestones[i].description.trim()) {
        setFormError(`Milestone #${i + 1} is missing a description.`);
        return;
      }
    }

    try {
      setIsSubmitting(true);

      const targetAmountWei = ethers.parseEther(targetAmountEth.trim());
      const percentages = milestones.map((m) => BigInt(m.percentage));
      const descriptions = milestones.map((m) => m.description.trim());

      const tx = await contract.createCampaign(
        title.trim(),
        description.trim(),
        imageCid.trim() || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
        targetAmountWei,
        BigInt(days),
        percentages,
        descriptions
      );

      await tx.wait();
      onCreated();
      onClose();
    } catch (err) {
      console.error("Failed to create campaign:", err);
      setFormError(err.reason || err.message || "Transaction failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-white">Create New Campaign</h3>
            <p className="text-xs text-slate-400">Launch a milestone-governed fundraising escrow</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {formError && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Campaign Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Decentralized Clean Water Network"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Overview & Objectives
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Detailed description of your project and milestones..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Target (ETH)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.001"
                value={targetAmountEth}
                onChange={(e) => setTargetAmountEth(e.target.value)}
                placeholder="e.g. 5.0"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Funding Duration (Days)
              </label>
              <input
                type="number"
                min="1"
                max="365"
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Banner Image URL (or IPFS)
              </label>
              <input
                type="text"
                value={imageCid}
                onChange={(e) => setImageCid(e.target.value)}
                placeholder="https://... or ipfs://..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Milestone Partitioning */}
          <div className="pt-3 border-t border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-bold text-white">Milestone Tranches</h4>
                <p className="text-xs text-slate-400">
                  Escrow unlocks sequentially as backers approve each milestone
                </p>
              </div>
              <div
                className={`text-xs font-bold px-2.5 py-1 rounded-md border ${
                  totalPercentage === 100
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                }`}
              >
                Sum: {totalPercentage}% / 100%
              </div>
            </div>

            <div className="space-y-3">
              {milestones.map((m, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-6 text-xs text-slate-500 font-mono">#{idx + 1}</span>
                  <input
                    type="text"
                    value={m.description}
                    onChange={(e) => handleMilestoneChange(idx, "description", e.target.value)}
                    placeholder="Milestone deliverable goal"
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    required
                  />
                  <div className="w-24 relative">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={m.percentage}
                      onChange={(e) => handleMilestoneChange(idx, "percentage", e.target.value)}
                      placeholder="%"
                      className="w-full px-3 py-2 pr-6 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      required
                    />
                    <span className="absolute right-2 top-2 text-xs text-slate-500">%</span>
                  </div>
                  {milestones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMilestone(idx)}
                      className="p-2 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addMilestone}
              className="mt-3 inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Another Milestone
            </button>
          </div>

          {/* Footer Submit */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-800 text-slate-300 text-sm hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || totalPercentage !== 100}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/20 transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting to EVM...</span>
                </>
              ) : (
                <span>Deploy Campaign Escrow</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
