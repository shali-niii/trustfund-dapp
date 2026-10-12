import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { ethers } from "ethers";
import contractArtifact from "../contracts/TrustFundContract.json";

const Web3Context = createContext();

const contractAddress = contractArtifact.address;
const contractAbi = contractArtifact.abi;

export function Web3Provider({ children }) {
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState("");
  const [signer, setSigner] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Created ONCE. A stable provider identity is what keeps every effect and
  // callback downstream from re-firing on each render.
  const provider = useMemo(() => {
    if (typeof window !== "undefined" && window.ethereum) {
      return new ethers.BrowserProvider(window.ethereum);
    }
    return null;
  }, []);

  // Derived, not stored: only changes when the provider or signer really changes.
  const contract = useMemo(() => {
    if (!provider) return null;
    return new ethers.Contract(contractAddress, contractAbi, signer ?? provider);
  }, [provider, signer]);

  // One-time init + wallet event listeners
  useEffect(() => {
    if (!provider) return;
    let cancelled = false;

    (async () => {
      try {
        const network = await provider.getNetwork();
        const accounts = await provider.send("eth_accounts", []);
        if (cancelled) return;

        setChainId(network.chainId.toString());
        if (accounts.length > 0) {
          const activeSigner = await provider.getSigner();
          if (cancelled) return;
          setAccount(accounts[0]);
          setSigner(activeSigner);
        }
      } catch (err) {
        console.error("Error initializing Web3 provider:", err);
      }
    })();

    const handleAccountsChanged = async (accounts) => {
      if (accounts.length > 0) {
        try {
          const activeSigner = await provider.getSigner();
          setAccount(accounts[0]);
          setSigner(activeSigner);
        } catch (err) {
          console.error("Error switching account:", err);
        }
      } else {
        setAccount("");
        setSigner(null);
      }
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      cancelled = true;
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, [provider]);

  // Connect MetaMask Wallet
  const connectWallet = async () => {
    if (!provider) {
      setErrorMessage("MetaMask not found. Please install the MetaMask browser extension.");
      return;
    }

    try {
      setIsConnecting(true);
      setErrorMessage("");

      const accounts = await provider.send("eth_requestAccounts", []);
      const activeSigner = await provider.getSigner();
      const network = await provider.getNetwork();

      setAccount(accounts[0]);
      setSigner(activeSigner);
      setChainId(network.chainId.toString());
    } catch (err) {
      console.error("MetaMask connection failed:", err);
      setErrorMessage(err.message || "Failed to connect wallet.");
    } finally {
      setIsConnecting(false);
    }
  };

  // Switch network to Hardhat Localhost (31337)
  const switchToLocalhost = async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x7a69" }], // 31337 in hex
      });
    } catch (switchError) {
      if (switchError.code === 4902) {
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
