import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { ethers } from "ethers";
import contractArtifact from "../contracts/TrustFundContract.json";

const Web3Context = createContext();

// Turns the different error shapes MetaMask / ethers can produce into a message a user can act on.
// 4001 = user rejected the request, -32002 = a request is already waiting in the MetaMask popup.
function describeWalletError(err, rejectedMessage, fallback) {
  const codes = [err?.code, err?.error?.code, err?.info?.error?.code];
  if (codes.includes(4001) || codes.includes("ACTION_REJECTED")) return rejectedMessage;
  if (codes.includes(-32002)) {
    return "A MetaMask request is already pending. Open the MetaMask extension to approve or reject it.";
  }
  return err?.shortMessage || err?.message || fallback;
}

export function Web3Provider({ children }) {
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState("");
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contract, setContract] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Refs hold values that async callbacks need but that must NOT trigger re-renders / effect re-runs.
  const providerRef = useRef(null);
  const accountRef = useRef(""); // lower-cased account currently reflected in state
  const syncSeqRef = useRef(0); // lets a newer account update cancel an older in-flight one
  const isConnectingRef = useRef(false); // blocks double-clicks before state has updated

  const contractAddress = contractArtifact.address;
  const contractAbi = contractArtifact.abi;

  // Single place that turns "the accounts MetaMask exposes" into account / signer / contract state.
  // Used by initial load, the accountsChanged event and the Connect button.
  const applyAccounts = useCallback(
    async (browserProvider, accounts) => {
      const next = accounts.length > 0 ? accounts[0].toLowerCase() : "";
      if (next && next === accountRef.current) return; // already reflected, avoid a redundant refetch

      const seq = ++syncSeqRef.current;

      if (!next) {
        // Disconnected: fall back to a read-only contract so campaigns stay visible
        accountRef.current = "";
        setAccount("");
        setSigner(null);
        setContract(new ethers.Contract(contractAddress, contractAbi, browserProvider));
        return;
      }

      const activeSigner = await browserProvider.getSigner(accounts[0]);
      if (seq !== syncSeqRef.current) return; // superseded by a newer update (or unmounted)

      accountRef.current = next;
      setAccount(accounts[0]);
      setSigner(activeSigner);
      setContract(new ethers.Contract(contractAddress, contractAbi, activeSigner));
    },
    [contractAddress, contractAbi]
  );

  // Set up the provider and wallet listeners ONCE (applyAccounts is stable, so this does not re-run).
  // NOTE: this effect must never depend on `provider`/`contract`/`signer` state, because it sets them.
  useEffect(() => {
    const ethereum = typeof window !== "undefined" ? window.ethereum : undefined;
    if (!ethereum) return undefined;

    let cancelled = false;
    const browserProvider = new ethers.BrowserProvider(ethereum);
    providerRef.current = browserProvider;
    setProvider(browserProvider);

    (async () => {
      try {
        const network = await browserProvider.getNetwork();
        if (cancelled) return;
        setChainId(network.chainId.toString());

        // Check if user is already connected (does not open a MetaMask popup)
        const accounts = await browserProvider.send("eth_accounts", []);
        if (cancelled) return;
        await applyAccounts(browserProvider, accounts);
      } catch (err) {
        if (!cancelled) console.error("Error initializing Web3 provider:", err);
      }
    })();

    const handleAccountsChanged = (accounts) => {
      applyAccounts(browserProvider, accounts).catch((err) =>
        console.error("Failed to handle account change:", err)
      );
    };

    // MetaMask recommends a full reload when the network changes
    const handleChainChanged = () => {
      window.location.reload();
    };

    ethereum.on("accountsChanged", handleAccountsChanged);
    ethereum.on("chainChanged", handleChainChanged);

    return () => {
      cancelled = true;
      // Generation counter (not a DOM ref): bump it so any in-flight account update is discarded
      syncSeqRef.current++;
      ethereum.removeListener("accountsChanged", handleAccountsChanged);
      ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, [applyAccounts]);

  // Connect MetaMask Wallet
  const connectWallet = async () => {
    if (!window.ethereum) {
      setErrorMessage("MetaMask not found. Please install the MetaMask browser extension.");
      return;
    }
    if (isConnectingRef.current) return; // a request is already open in MetaMask
    isConnectingRef.current = true;

    try {
      setIsConnecting(true);
      setErrorMessage("");

      const browserProvider = providerRef.current ?? new ethers.BrowserProvider(window.ethereum);
      providerRef.current = browserProvider;

      const accounts = await browserProvider.send("eth_requestAccounts", []);
      if (!accounts || accounts.length === 0) {
        throw new Error("MetaMask did not return any accounts. Unlock MetaMask and try again.");
      }
      const network = await browserProvider.getNetwork();

      await applyAccounts(browserProvider, accounts);
      setProvider(browserProvider);
      setChainId(network.chainId.toString());
    } catch (err) {
      console.error("MetaMask connection failed:", err);
      setErrorMessage(
        describeWalletError(
          err,
          "Connection request was rejected in MetaMask. Click \u201cConnect MetaMask\u201d to try again.",
          "Failed to connect wallet."
        )
      );
    } finally {
      isConnectingRef.current = false;
      setIsConnecting(false);
    }
  };

  // Switch network to Hardhat Localhost (31337)
  const switchToLocalhost = async () => {
    if (!window.ethereum) return;
    setErrorMessage("");
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x7a69" }], // 31337 in hex
      });
    } catch (switchError) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: "0x7a69",
                chainName: "Hardhat Localhost",
                nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
                rpcUrls: ["http://127.0.0.1:8545"],
              },
            ],
          });
        } catch (addError) {
          setErrorMessage(
            describeWalletError(addError, "Adding the Hardhat Localhost network was rejected.", "Failed to add network.")
          );
        }
      } else {
        setErrorMessage(
          describeWalletError(switchError, "Network switch was rejected in MetaMask.", "Failed to switch network.")
        );
      }
    }
  };

  return (
    <Web3Context.Provider
      value={{
        account,
        chainId,
        provider,
        signer,
        contract,
        contractAddress,
        isConnecting,
        errorMessage,
        connectWallet,
        switchToLocalhost,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3() {
  return useContext(Web3Context);
}
