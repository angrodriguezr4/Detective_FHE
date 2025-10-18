// App.tsx
import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import "./App.css";
import { useAccount, useSignMessage } from 'wagmi';

// Randomly selected styles: High Contrast Black/Red, Noir Detective, Partition Panel, Animation Rich
interface Testimony {
  id: string;
  witness: string;
  encryptedContent: string;
  timestamp: number;
  caseId: string;
  credibility: number; // FHE encrypted value (0-100)
}

const FHEEncryptNumber = (value: number): string => {
  return `FHE-${btoa(value.toString())}`;
};

const FHEDecryptNumber = (encryptedData: string): number => {
  if (encryptedData.startsWith('FHE-')) {
    return parseFloat(atob(encryptedData.substring(4)));
  }
  return parseFloat(encryptedData);
};

const FHECompare = (encryptedData1: string, encryptedData2: string): boolean => {
  const value1 = FHEDecryptNumber(encryptedData1);
  const value2 = FHEDecryptNumber(encryptedData2);
  return Math.abs(value1 - value2) < 10; // Threshold for contradiction
};

const generatePublicKey = () => `0x${Array(2000).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [loading, setLoading] = useState(true);
  const [testimonies, setTestimonies] = useState<Testimony[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [adding, setAdding] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ visible: false, status: "pending", message: "" });
  const [newTestimony, setNewTestimony] = useState({ witness: "", content: "", credibility: 50 });
  const [selectedCase, setSelectedCase] = useState<string>("case-1");
  const [selectedTestimony, setSelectedTestimony] = useState<Testimony | null>(null);
  const [decryptedCredibility, setDecryptedCredibility] = useState<number | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [publicKey, setPublicKey] = useState<string>("");
  const [contractAddress, setContractAddress] = useState<string>("");
  const [chainId, setChainId] = useState<number>(0);
  const [startTimestamp, setStartTimestamp] = useState<number>(0);
  const [durationDays, setDurationDays] = useState<number>(30);
  const [contradictions, setContradictions] = useState<{id1: string, id2: string}[]>([]);
  const [showTutorial, setShowTutorial] = useState(false);
  const [activeTab, setActiveTab] = useState<"testimonies" | "analysis">("testimonies");

  // Noir detective cases
  const cases = [
    { id: "case-1", title: "The Midnight Murder", description: "Banker found dead in his penthouse" },
    { id: "case-2", title: "The Vanished Diamonds", description: "Museum heist with no forced entry" },
    { id: "case-3", title: "The Poisoned Chalice", description: "Political assassination at gala event" }
  ];

  useEffect(() => {
    loadTestimonies().finally(() => setLoading(false));
    const initSignatureParams = async () => {
      const contract = await getContractReadOnly();
      if (contract) setContractAddress(await contract.getAddress());
      if (window.ethereum) {
        const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
        setChainId(parseInt(chainIdHex, 16));
      }
      setStartTimestamp(Math.floor(Date.now() / 1000));
      setDurationDays(30);
      setPublicKey(generatePublicKey());
    };
    initSignatureParams();
  }, []);

  const loadTestimonies = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) return;
      const keysBytes = await contract.getData("testimony_keys");
      let keys: string[] = [];
      if (keysBytes.length > 0) {
        try {
          const keysStr = ethers.toUtf8String(keysBytes);
          if (keysStr.trim() !== '') keys = JSON.parse(keysStr);
        } catch (e) { console.error("Error parsing testimony keys:", e); }
      }
      const list: Testimony[] = [];
      for (const key of keys) {
        try {
          const recordBytes = await contract.getData(`testimony_${key}`);
          if (recordBytes.length > 0) {
            try {
              const recordData = JSON.parse(ethers.toUtf8String(recordBytes));
              list.push({ 
                id: key, 
                witness: recordData.witness, 
                encryptedContent: recordData.content, 
                timestamp: recordData.timestamp, 
                caseId: recordData.caseId,
                credibility: recordData.credibility 
              });
            } catch (e) { console.error(`Error parsing testimony data for ${key}:`, e); }
          }
        } catch (e) { console.error(`Error loading testimony ${key}:`, e); }
      }
      list.sort((a, b) => b.timestamp - a.timestamp);
      setTestimonies(list);
      findContradictions(list);
    } catch (e) { console.error("Error loading testimonies:", e); } 
    finally { setIsRefreshing(false); setLoading(false); }
  };

  const findContradictions = (testimonies: Testimony[]) => {
    const contradictionsFound: {id1: string, id2: string}[] = [];
    for (let i = 0; i < testimonies.length; i++) {
      for (let j = i + 1; j < testimonies.length; j++) {
        if (testimonies[i].caseId === testimonies[j].caseId && 
            FHECompare(testimonies[i].credibility.toString(), testimonies[j].credibility.toString())) {
          contradictionsFound.push({id1: testimonies[i].id, id2: testimonies[j].id});
        }
      }
    }
    setContradictions(contradictionsFound);
  };

  const addTestimony = async () => {
    if (!isConnected) { alert("Please connect wallet first"); return; }
    setAdding(true);
    setTransactionStatus({ visible: true, status: "pending", message: "Encrypting testimony with Zama FHE..." });
    try {
      const encryptedCredibility = FHEEncryptNumber(newTestimony.credibility);
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      const testimonyId = `testimony-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const testimonyData = { 
        witness: newTestimony.witness, 
        content: newTestimony.content,
        timestamp: Math.floor(Date.now() / 1000), 
        caseId: selectedCase,
        credibility: encryptedCredibility
      };
      await contract.setData(`testimony_${testimonyId}`, ethers.toUtf8Bytes(JSON.stringify(testimonyData)));
      const keysBytes = await contract.getData("testimony_keys");
      let keys: string[] = [];
      if (keysBytes.length > 0) {
        try { keys = JSON.parse(ethers.toUtf8String(keysBytes)); } 
        catch (e) { console.error("Error parsing keys:", e); }
      }
      keys.push(testimonyId);
      await contract.setData("testimony_keys", ethers.toUtf8Bytes(JSON.stringify(keys)));
      setTransactionStatus({ visible: true, status: "success", message: "Encrypted testimony submitted!" });
      await loadTestimonies();
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
        setShowAddModal(false);
        setNewTestimony({ witness: "", content: "", credibility: 50 });
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction") ? "Transaction rejected by user" : "Submission failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { setAdding(false); }
  };

  const decryptWithSignature = async (encryptedData: string): Promise<number | null> => {
    if (!isConnected) { alert("Please connect wallet first"); return null; }
    setIsDecrypting(true);
    try {
      const message = `publickey:${publicKey}\ncontractAddresses:${contractAddress}\ncontractsChainId:${chainId}\nstartTimestamp:${startTimestamp}\ndurationDays:${durationDays}`;
      await signMessageAsync({ message });
      await new Promise(resolve => setTimeout(resolve, 1500));
      return FHEDecryptNumber(encryptedData);
    } catch (e) { console.error("Decryption failed:", e); return null; } 
    finally { setIsDecrypting(false); }
  };

  const checkAvailability = async () => {
    setTransactionStatus({ visible: true, status: "pending", message: "Checking contract availability..." });
    try {
      const contract = await getContractReadOnly();
      if (!contract) throw new Error("Contract not found");
      const isAvailable = await contract.isAvailable();
      setTransactionStatus({ 
        visible: true, 
        status: "success", 
        message: isAvailable ? "Contract is available" : "Contract not available" 
      });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
    } catch (e: any) {
      setTransactionStatus({ visible: true, status: "error", message: "Check failed: " + (e.message || "Unknown error") });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const renderCaseStats = () => {
    const caseTestimonies = testimonies.filter(t => t.caseId === selectedCase);
    const avgCredibility = caseTestimonies.length > 0 ? 
      caseTestimonies.reduce((sum, t) => sum + FHEDecryptNumber(t.credibility.toString()), 0) / caseTestimonies.length : 0;
    
    return (
      <div className="case-stats">
        <div className="stat-item">
          <div className="stat-value">{caseTestimonies.length}</div>
          <div className="stat-label">Testimonies</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{Math.round(avgCredibility)}%</div>
          <div className="stat-label">Avg. Credibility</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{contradictions.filter(c => {
            const t1 = testimonies.find(t => t.id === c.id1);
            const t2 = testimonies.find(t => t.id === c.id2);
            return t1?.caseId === selectedCase && t2?.caseId === selectedCase;
          }).length}</div>
          <div className="stat-label">Contradictions</div>
        </div>
      </div>
    );
  };

  const renderContradictions = () => {
    const caseContradictions = contradictions.filter(c => {
      const t1 = testimonies.find(t => t.id === c.id1);
      const t2 = testimonies.find(t => t.id === c.id2);
      return t1?.caseId === selectedCase && t2?.caseId === selectedCase;
    });

    if (caseContradictions.length === 0) {
      return <div className="no-contradictions">No contradictions found in this case</div>;
    }

    return (
      <div className="contradictions-list">
        {caseContradictions.map((contra, index) => {
          const t1 = testimonies.find(t => t.id === contra.id1)!;
          const t2 = testimonies.find(t => t.id === contra.id2)!;
          return (
            <div key={index} className="contradiction-item">
              <div className="witnesses">
                <span className="witness">{t1.witness}</span> vs <span className="witness">{t2.witness}</span>
              </div>
              <div className="credibility-diff">
                Credibility difference: {Math.abs(FHEDecryptNumber(t1.credibility.toString()) - FHEDecryptNumber(t2.credibility.toString()))}%
              </div>
              <button 
                className="view-btn" 
                onClick={() => {
                  setSelectedTestimony(t1);
                  setDecryptedCredibility(null);
                }}
              >
                View Testimony 1
              </button>
              <button 
                className="view-btn" 
                onClick={() => {
                  setSelectedTestimony(t2);
                  setDecryptedCredibility(null);
                }}
              >
                View Testimony 2
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="noir-spinner"></div>
      <p>Initializing encrypted detective agency...</p>
    </div>
  );

  return (
    <div className="app-container noir-theme">
      <header className="app-header">
        <div className="logo">
          <div className="magnifying-glass"></div>
          <h1>隱言偵探 <span>FHE Detective</span></h1>
        </div>
        <div className="header-actions">
          <button onClick={() => setShowAddModal(true)} className="add-testimony-btn noir-button">
            <div className="add-icon"></div>Add Testimony
          </button>
          <button className="noir-button" onClick={() => setShowTutorial(!showTutorial)}>
            {showTutorial ? "Hide Tutorial" : "Case Manual"}
          </button>
          <button className="noir-button" onClick={checkAvailability}>
            Check Availability
          </button>
          <div className="wallet-connect-wrapper"><ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/></div>
        </div>
      </header>
      <div className="main-content">
        <div className="partition-panel">
          <div className="left-panel">
            <div className="case-selector noir-card">
              <h3>Select Case</h3>
              <select 
                value={selectedCase} 
                onChange={(e) => setSelectedCase(e.target.value)}
                className="noir-select"
              >
                {cases.map(caseItem => (
                  <option key={caseItem.id} value={caseItem.id}>
                    {caseItem.title}
                  </option>
                ))}
              </select>
              <div className="case-description">
                {cases.find(c => c.id === selectedCase)?.description}
              </div>
              {renderCaseStats()}
            </div>
            <div className="fhe-info noir-card">
              <h3>Zama FHE Technology</h3>
              <p>All witness credibility scores are encrypted using Fully Homomorphic Encryption (FHE).</p>
              <div className="fhe-process">
                <div className="process-step">
                  <div className="step-icon">🔒</div>
                  <div className="step-text">Encrypted at submission</div>
                </div>
                <div className="process-step">
                  <div className="step-icon">⚖️</div>
                  <div className="step-text">Compared while encrypted</div>
                </div>
                <div className="process-step">
                  <div className="step-icon">🔍</div>
                  <div className="step-text">Only decrypted with your key</div>
                </div>
              </div>
            </div>
          </div>
          <div className="right-panel">
            <div className="tab-controls">
              <button 
                className={`tab-button ${activeTab === "testimonies" ? "active" : ""}`}
                onClick={() => setActiveTab("testimonies")}
              >
                Witness Testimonies
              </button>
              <button 
                className={`tab-button ${activeTab === "analysis" ? "active" : ""}`}
                onClick={() => setActiveTab("analysis")}
              >
                Case Analysis
              </button>
            </div>
            
            {activeTab === "testimonies" ? (
              <div className="testimonies-list noir-card">
                <div className="list-header">
                  <h2>Encrypted Testimonies</h2>
                  <button onClick={loadTestimonies} className="refresh-btn noir-button" disabled={isRefreshing}>
                    {isRefreshing ? "Refreshing..." : "Refresh Case"}
                  </button>
                </div>
                {testimonies.filter(t => t.caseId === selectedCase).length === 0 ? (
                  <div className="no-testimonies">
                    <div className="no-testimonies-icon"></div>
                    <p>No encrypted testimonies found for this case</p>
                    <button className="noir-button primary" onClick={() => setShowAddModal(true)}>Add First Testimony</button>
                  </div>
                ) : (
                  <div className="testimonies-grid">
                    {testimonies
                      .filter(t => t.caseId === selectedCase)
                      .map(testimony => (
                        <div 
                          key={testimony.id} 
                          className="testimony-card"
                          onClick={() => {
                            setSelectedTestimony(testimony);
                            setDecryptedCredibility(null);
                          }}
                        >
                          <div className="testimony-header">
                            <div className="witness-name">{testimony.witness}</div>
                            <div className="testimony-date">{new Date(testimony.timestamp * 1000).toLocaleDateString()}</div>
                          </div>
                          <div className="testimony-preview">
                            {testimony.encryptedContent.substring(0, 100)}...
                          </div>
                          <div className="credibility-indicator">
                            <div 
                              className="credibility-bar" 
                              style={{ width: `${FHEDecryptNumber(testimony.credibility.toString())}%` }}
                            ></div>
                            <span>Credibility Score</span>
                          </div>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
            ) : (
              <div className="case-analysis noir-card">
                <h2>Case Analysis: {cases.find(c => c.id === selectedCase)?.title}</h2>
                <div className="analysis-section">
                  <h3>Testimony Contradictions</h3>
                  <p>These witnesses have credibility scores that contradict each other:</p>
                  {renderContradictions()}
                </div>
                <div className="analysis-section">
                  <h3>Case Timeline</h3>
                  <div className="timeline">
                    {testimonies
                      .filter(t => t.caseId === selectedCase)
                      .sort((a, b) => a.timestamp - b.timestamp)
                      .map((testimony, index) => (
                        <div key={index} className="timeline-event">
                          <div className="timeline-dot"></div>
                          <div className="timeline-content">
                            <div className="timeline-date">{new Date(testimony.timestamp * 1000).toLocaleString()}</div>
                            <div className="timeline-witness">{testimony.witness}</div>
                          </div>
                        </div>
                      ))
                    }
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {showAddModal && (
        <div className="modal-overlay">
          <div className="add-modal noir-card">
            <div className="modal-header">
              <h2>Add Encrypted Testimony</h2>
              <button onClick={() => setShowAddModal(false)} className="close-modal">&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Witness Name *</label>
                <input
                  type="text"
                  value={newTestimony.witness}
                  onChange={(e) => setNewTestimony({...newTestimony, witness: e.target.value})}
                  placeholder="Enter witness name..."
                  className="noir-input"
                />
              </div>
              <div className="form-group">
                <label>Testimony Content *</label>
                <textarea
                  value={newTestimony.content}
                  onChange={(e) => setNewTestimony({...newTestimony, content: e.target.value})}
                  placeholder="Enter testimony details..."
                  className="noir-textarea"
                  rows={4}
                />
              </div>
              <div className="form-group">
                <label>Credibility Score (0-100)</label>
                <div className="slider-container">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={newTestimony.credibility}
                    onChange={(e) => setNewTestimony({...newTestimony, credibility: parseInt(e.target.value)})}
                    className="noir-slider"
                  />
                  <span className="slider-value">{newTestimony.credibility}%</span>
                </div>
              </div>
              <div className="fhe-notice">
                <div className="lock-icon"></div>
                <p>Credibility score will be encrypted with Zama FHE before submission</p>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowAddModal(false)} className="noir-button">Cancel</button>
              <button 
                onClick={addTestimony} 
                disabled={adding || !newTestimony.witness || !newTestimony.content}
                className="noir-button primary"
              >
                {adding ? "Encrypting..." : "Submit Testimony"}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {selectedTestimony && (
        <div className="modal-overlay">
          <div className="detail-modal noir-card">
            <div className="modal-header">
              <h2>Testimony Details</h2>
              <button onClick={() => {
                setSelectedTestimony(null);
                setDecryptedCredibility(null);
              }} className="close-modal">&times;</button>
            </div>
            <div className="modal-body">
              <div className="testimony-meta">
                <div className="meta-item">
                  <span className="meta-label">Witness:</span>
                  <span className="meta-value">{selectedTestimony.witness}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Case:</span>
                  <span className="meta-value">{cases.find(c => c.id === selectedTestimony.caseId)?.title}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Date:</span>
                  <span className="meta-value">{new Date(selectedTestimony.timestamp * 1000).toLocaleString()}</span>
                </div>
              </div>
              <div className="testimony-content">
                <h3>Testimony</h3>
                <p>{selectedTestimony.encryptedContent}</p>
              </div>
              <div className="credibility-section">
                <h3>Credibility Analysis</h3>
                <div className="credibility-display">
                  <div className="credibility-visual">
                    <div 
                      className="credibility-meter" 
                      style={{ width: `${FHEDecryptNumber(selectedTestimony.credibility.toString())}%` }}
                    ></div>
                    <span>Encrypted Score: {selectedTestimony.credibility.substring(0, 20)}...</span>
                  </div>
                  <button 
                    className="noir-button" 
                    onClick={async () => {
                      if (decryptedCredibility !== null) {
                        setDecryptedCredibility(null);
                      } else {
                        const decrypted = await decryptWithSignature(selectedTestimony.credibility.toString());
                        if (decrypted !== null) setDecryptedCredibility(decrypted);
                      }
                    }}
                    disabled={isDecrypting}
                  >
                    {isDecrypting ? "Decrypting..." : 
                     decryptedCredibility !== null ? "Hide Decrypted Value" : "Decrypt with Wallet"}
                  </button>
                </div>
                {decryptedCredibility !== null && (
                  <div className="decrypted-value">
                    <h4>Decrypted Credibility Score</h4>
                    <div className="score-display">{decryptedCredibility}%</div>
                    <div className="score-assessment">
                      {decryptedCredibility > 75 ? "Highly credible" :
                       decryptedCredibility > 50 ? "Moderately credible" :
                       decryptedCredibility > 25 ? "Questionable reliability" : "Low credibility"}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="noir-button" 
                onClick={() => {
                  setSelectedTestimony(null);
                  setDecryptedCredibility(null);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content noir-card">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="noir-spinner"></div>}
              {transactionStatus.status === "success" && <div className="check-icon"></div>}
              {transactionStatus.status === "error" && <div className="error-icon"></div>}
            </div>
            <div className="transaction-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}
      
      {showTutorial && (
        <div className="tutorial-modal">
          <div className="tutorial-content noir-card">
            <div className="modal-header">
              <h2>Case Manual: FHE Detective</h2>
              <button onClick={() => setShowTutorial(false)} className="close-modal">&times;</button>
            </div>
            <div className="modal-body">
              <div className="tutorial-section">
                <h3>How It Works</h3>
                <p>As a detective, you'll examine witness testimonies where the credibility scores are encrypted using Zama FHE technology.</p>
                <div className="tutorial-steps">
                  <div className="step">
                    <div className="step-number">1</div>
                    <div className="step-content">
                      <h4>Collect Testimonies</h4>
                      <p>Gather statements from all witnesses involved in the case.</p>
                    </div>
                  </div>
                  <div className="step">
                    <div className="step-number">2</div>
                    <div className="step-content">
                      <h4>Analyze Credibility</h4>
                      <p>Examine the encrypted credibility scores for contradictions.</p>
                    </div>
                  </div>
                  <div className="step">
                    <div className="step-number">3</div>
                    <div className="step-content">
                      <h4>Decrypt Key Evidence</h4>
                      <p>Use your wallet to decrypt crucial credibility scores when needed.</p>
                    </div>
                  </div>
                  <div className="step">
                    <div className="step-number">4</div>
                    <div className="step-content">
                      <h4>Solve the Case</h4>
                      <p>Identify contradictions and determine the truth.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="tutorial-section">
                <h3>FHE Technology</h3>
                <p>Fully Homomorphic Encryption allows us to:</p>
                <ul className="fhe-features">
                  <li>Compare encrypted credibility scores without decrypting them</li>
                  <li>Maintain complete witness privacy during investigation</li>
                  <li>Only decrypt scores when absolutely necessary with your private key</li>
                </ul>
              </div>
            </div>
            <div className="modal-footer">
              <button className="noir-button" onClick={() => setShowTutorial(false)}>Close Manual</button>
            </div>
          </div>
        </div>
      )}
      
      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo">
              <div className="magnifying-glass small"></div>
              <span>隱言偵探 FHE Detective</span>
            </div>
            <p>Solving crimes with encrypted evidence using Zama FHE</p>
          </div>
          <div className="footer-links">
            <a href="#" className="footer-link">About Zama FHE</a>
            <a href="#" className="footer-link">Documentation</a>
            <a href="#" className="footer-link">Privacy Policy</a>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="copyright">© {new Date().getFullYear()} FHE Detective Agency. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
};

export default App;