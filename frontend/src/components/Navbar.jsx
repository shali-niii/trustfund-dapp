import React from "react";
import { ShieldCheck, Plus, Wallet, AlertCircle } from "lucide-react";
import { useWeb3 } from "../context/Web3Context";
import { formatAddress } from "../utils/helpers";

export function Navbar({ onOpenCreateModal }) {
  const { account, chainId, isConnecting, errorMessage, connectWallet, switchToLocalhost } = useWeb3();

  const isLocalhost = chainId === "31337";
  const isSepolia = chainId === "11155111";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="text-xl font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              TrustFund
            </span>
            <span className="hidden sm:inline-block ml-2 text-xs font-medium px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Escrow DApp
            </span>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Network Indicator */}
          {account && (
            <div className="hidden md:flex items-center gap-2">
              {isLocalhost ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Hardhat Localhost
                </span>
              ) : isSepolia ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                  Sepolia Testnet
                </span>
              ) : (
                <button
                  onClick={switchToLocalhost}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-colors"
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  Switch to Localhost
                </button>
              )}
            </div>
          )}

          {/* Create Campaign Button */}
          {account && (
            <button
              onClick={onOpenCreateModal}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium shadow-md shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>New Campaign</span>
            </button>
          )}

          {/* Wallet Connect Button */}
          {account ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-sm">
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
              <span className="font-mono text-xs">{formatAddress(account)}</span>
            </div>
          ) : (
            <button
              onClick={connectWallet}
              disabled={isConnecting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-sm font-semibold shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Wallet className="w-4 h-4" />
              <span>{isConnecting ? "Connecting..." : "Connect MetaMask"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Wallet error feedback (rejected request, MetaMask missing, wrong network, ...) */}
      {errorMessage && (
        <div role="alert" className="border-t border-rose-500/30 bg-rose-500/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-2 text-xs text-rose-300">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        </div>
      )}
    </header>
  );
}
