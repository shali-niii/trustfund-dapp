import React, { useState, useEffect, useCallback, useRef } from "react";
import { ethers } from "ethers";
import { Navbar } from "./components/Navbar";
import { CampaignCard } from "./components/CampaignCard";
import { CreateCampaignModal } from "./components/CreateCampaignModal";
import { useWeb3 } from "./context/Web3Context";
import { formatEther } from "./utils/helpers";
import {
  TrendingUp,
  ShieldCheck,
  Layers,
  Sparkles,
  Search,
  Filter,
  Loader2,
  FolderOpen,
  CheckCircle,
} from "lucide-react";

export default function App() {
  const { contract, account, provider, contractAddress } = useWeb3();

  const [campaigns, setCampaigns] = useState([]);
  const [milestonesMap, setMilestonesMap] = useState({});
  const [userContributionsMap, setUserContributionsMap] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  // Guards against overlapping fetches: only the most recent request may update state
  const requestIdRef = useRef(0);
  // Once campaigns have been shown, background refreshes must not swap the grid for the spinner
  // (that unmounts every card and resets its expanded/input state)
  const hasLoadedRef = useRef(false);

  // Fetch all campaigns and their data from blockchain
  const loadBlockchainData = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    const isStale = () => requestId !== requestIdRef.current;

    if (!contract) {
      setIsLoading(false);
      return;
    }

    try {
      if (!hasLoadedRef.current) setIsLoading(true);
      setLoadError("");
      const totalCount = await contract.campaignCount();
      const count = Number(totalCount);

      const loadedCampaigns = [];
      const loadedMilestones = {};
      const loadedContributions = {};

      for (let i = 1; i <= count; i++) {
        const c = await contract.campaigns(i);
        const mList = await contract.getMilestones(i);

        loadedCampaigns.push(c);
        loadedMilestones[i] = mList;

        if (account) {
          const userContrib = await contract.contributions(i, account);
          loadedContributions[i] = userContrib;
        } else {
          loadedContributions[i] = 0n;
        }
      }

      if (isStale()) return; // a newer fetch started while this one was running
      hasLoadedRef.current = true;
      setCampaigns(loadedCampaigns);
      setMilestonesMap(loadedMilestones);
      setUserContributionsMap(loadedContributions);
    } catch (err) {
      console.error("Error loading blockchain data:", err);
      if (isStale()) return;
      // BAD_DATA means "0x" came back: no contract at this address on the connected network
      setLoadError(
        err?.code === "BAD_DATA"
          ? `No TrustFund contract found at ${contractAddress} on the connected network. Make sure your Hardhat node is running, the contract is deployed (npm run seed:local), and MetaMask is on the matching network.`
          : `Could not load campaigns: ${err?.shortMessage || err?.message || "unknown error"}`
      );
    } finally {
      if (!isStale()) setIsLoading(false);
    }
  }, [contract, account, contractAddress]);

  useEffect(() => {
    loadBlockchainData();
    // When contract/account change (or on unmount) this invalidates the fetch that is still running
    return () => {
      // Generation counter (not a DOM ref): bump it so the superseded fetch is discarded
      requestIdRef.current++;
    };
  }, [loadBlockchainData]);

  // Global aggregate metrics
  const totalRaisedWei = campaigns.reduce((sum, c) => sum + (c.totalRaised || 0n), 0n);
  const activeCount = campaigns.filter((c) => Number(c.state) === 1).length;
  const completedCount = campaigns.filter((c) => Number(c.state) === 2).length;

  // Filtered campaigns
  const filteredCampaigns = campaigns.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeFilter === "all") return true;
    if (activeFilter === "funding") return Number(c.state) === 0;
    if (activeFilter === "active") return Number(c.state) === 1;
    if (activeFilter === "completed") return Number(c.state) === 2;
    if (activeFilter === "failed") return Number(c.state) === 3;
    if (activeFilter === "my") {
      const isCreator = account && c.creator && c.creator.toLowerCase() === account.toLowerCase();
      const isBacker = userContributionsMap[c.id] && userContributionsMap[c.id] > 0n;
      return isCreator || isBacker;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Navigation */}
      <Navbar onOpenCreateModal={() => setIsModalOpen(true)} />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        {/* Hero Banner & Value Proposition */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 p-8 sm:p-10 shadow-2xl">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Decentralized Escrow with Backer Governance</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Crowdfunding Protected by <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
                Milestone Escrow & Voting
              </span>
            </h1>
            <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
              No more blind upfront funding. Contributors lock funds in smart contract vaults, 
              unlocking payouts only as project creators verify completed milestones on-chain.
            </p>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-8 border-t border-slate-800/80">
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
              <span className="text-xs text-slate-400 flex items-center gap-1.5 mb-1 font-medium">
                <TrendingUp className="w-3.5 h-3.5 text-indigo-400" /> Total Volume
              </span>
              <span className="text-xl sm:text-2xl font-bold text-white font-mono">
                {formatEther(totalRaisedWei)} ETH
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
              <span className="text-xs text-slate-400 flex items-center gap-1.5 mb-1 font-medium">
                <Layers className="w-3.5 h-3.5 text-purple-400" /> Total Campaigns
              </span>
              <span className="text-xl sm:text-2xl font-bold text-white font-mono">
                {campaigns.length}
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
              <span className="text-xs text-slate-400 flex items-center gap-1.5 mb-1 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Active Milestones
              </span>
              <span className="text-xl sm:text-2xl font-bold text-emerald-400 font-mono">
                {activeCount}
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
              <span className="text-xs text-slate-400 flex items-center gap-1.5 mb-1 font-medium">
                <CheckCircle className="w-3.5 h-3.5 text-blue-400" /> Completed
              </span>
              <span className="text-xl sm:text-2xl font-bold text-blue-400 font-mono">
                {completedCount}
              </span>
            </div>
          </div>
        </section>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 sm:pb-0 scrollbar-none">
            {[
              { id: "all", label: "All Campaigns" },
              { id: "funding", label: "Funding" },
              { id: "active", label: "Milestones Active" },
              { id: "completed", label: "Completed" },
              { id: "failed", label: "Refundable / Failed" },
              { id: "my", label: "My Participations" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  activeFilter === tab.id
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                    : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search campaigns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Load failure (wrong network / contract not deployed / RPC down) */}
        {loadError && !isLoading && (
          <div role="alert" className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {loadError}
          </div>
        )}

        {/* Campaign Grid */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <span className="text-sm">Reading state from blockchain...</span>
          </div>
        ) : filteredCampaigns.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCampaigns.map((c) => (
              <CampaignCard
                key={c.id.toString()}
                campaign={c}
                milestones={milestonesMap[c.id] || []}
                userContribution={userContributionsMap[c.id] || 0n}
                onActionSuccess={loadBlockchainData}
              />
            ))}
          </div>
        ) : loadError ? null : (
          <div className="flex flex-col items-center justify-center py-16 px-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
              <FolderOpen className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-white mb-1">No Campaigns Found</h4>
            <p className="text-xs text-slate-400 max-w-sm mb-4">
              {searchQuery
                ? "No campaigns matched your search filter."
                : "There are currently no active campaigns on this network. Be the first to create one!"}
            </p>
            {account && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition-colors"
              >
                Launch First Campaign
              </button>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500">
        <p>
          TrustFund DApp &bull; Powered by Ethereum Smart Contracts &bull; Built with Solidity, Hardhat, React & Ethers.js
        </p>
        <p className="font-mono text-[11px] text-slate-600 mt-1">
          Contract: {contractAddress || "Deploying..."}
        </p>
      </footer>

      {/* Modal */}
      <CreateCampaignModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={loadBlockchainData}
      />
    </div>
  );
}
