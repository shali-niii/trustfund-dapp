import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import contractArtifact from "../contracts/TrustFundContract.json";

const Web3Context = createContext();

export function Web3Provider({ children }) {
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState("");
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contract, setContract] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const contractAddress = contractArtifact.address;
  const contractAbi = contractArtifact.abi;

  // Initialize Web3 provider & read-only contract instance
  const initProvider = useCallback(async () => {
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        const browserProvider = new ethers.BrowserProvider(window.ethereum);
        setProvider(browserProvider);

        const network = await browserProvider.getNetwork();
        setChainId(network.chainId.toString());

        // Check if user is already connected
        const accounts = await browserProvider.send("eth_accounts", []);
        if (accounts.length > 0) {
          const activeSigner = await browserProvider.getSigner();
          setAccount(accounts[0]);
          setSigner(activeSigner);
          const contractInstance = new ethers.Contract(contractAddress, contractAbi, activeSigner);
          setContract(contractInstance);
        } else {
          // Fallback to read-only contract instance
          const readOnlyContract = new ethers.Contract(contractAddress, contractAbi, browserProvider);
          setContract(readOnlyContract);
        }
      } catch (err) {
        console.error("Error initializing Web3 provider:", err);
      }
    }
  }, [contractAddress, contractAbi]);

  useEffect(() => {
    initProvider();

    if (window.ethereum) {
      const handleAccountsChanged = async (accounts) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          if (provider) {
            const activeSigner = await provider.getSigner();
            setSigner(activeSigner);
            setContract(new ethers.Contract(contractAddress, contractAbi, activeSigner));
          }
        } else {
          setAccount("");
          setSigner(null);
          if (provider) {
            setContract(new ethers.Contract(contractAddress, contractAbi, provider));
          }
        }
      };

      const handleChainChanged = () => {
        window.location.reload();
      };

      window.ethereum.on("accountsChanged", handleAccountsChanged);
      window.ethereum.on("chainChanged", handleChainChanged);

      return () => {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
        window.ethereum.removeListener("chainChanged", handleChainChanged);
      };
    }
  }, [initProvider, provider, contractAddress, contractAbi]);

  // Connect MetaMask Wallet
  const connectWallet = async () => {
    if (!window.ethereum) {
      setErrorMessage("MetaMask not found. Please install the MetaMask browser extension.");
      return;
    }

    try {
      setIsConnecting(true);
      setErrorMessage("");

      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await browserProvider.send("eth_requestAccounts", []);
      const activeSigner = await browserProvider.getSigner();
      const network = await browserProvider.getNetwork();

      setAccount(accounts[0]);
      setProvider(browserProvider);
      setSigner(activeSigner);
      setChainId(network.chainId.toString());
      setContract(new ethers.Contract(contractAddress, contractAbi, activeSigner));
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
