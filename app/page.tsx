"use client";
import { useState, useEffect, useMemo } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet, useAnchorWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram, Connection, clusterApiUrl } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import * as anchor from '@coral-xyz/anchor';
import Image from 'next/image';

// --- 設定値 ---
const PROGRAM_ID = new PublicKey("6SVBFPT8bLcbp8eDud9ECSoVYJhzmXxgHm9iU5FviKAs");
const DAKY_MINT = new PublicKey("CzLeDd7qrK8Y4XREpsb4uc5xVX9ktYcryGw3zXRSpump");
const RPC_ENDPOINT = clusterApiUrl('devnet');
const FETCH_INTERVAL = 15000;
const DECIMALS = 6;

// 報酬設定
const DAILY_REWARD_RATE = 0.00015;
const APR = 5.48;
const MIN_LOCK_DAYS = 7;
const MIN_LOCK_SECONDS = 604800;

// --- 型定義 ---
type ActivityLog = {
  signature: string;
  slot: number;
  blockTime: number;
  status: 'success' | 'fail';
};

type GlobalStateAccount = {
  maxStake: anchor.BN;
  rewardRate: anchor.BN;
};

type UserStateAccount = {
  stakedAmount: anchor.BN;
  lastStakeTime: anchor.BN;
};

interface DakyProgram extends anchor.Program {
  account: {
    globalState: {
      fetch: (address: PublicKey) => Promise<GlobalStateAccount>;
    };
    userState: {
      fetch: (address: PublicKey) => Promise<UserStateAccount>;
    };
  };
}

// --- IDL ---
const IDL: anchor.Idl = {
  "address": "6SVBFPT8bLcbp8eDud9ECSoVYJhzmXxgHm9iU5FviKAs",
  "metadata": { "name": "daky_contract", "version": "0.1.0", "spec": "0.1.0" },
  "instructions": [
    {
      "name": "initialize",
      "discriminator": [175, 175, 109, 31, 13, 152, 155, 237],
      "accounts": [
        { "name": "globalState", "writable": true },
        { "name": "user", "writable": true, "signer": true },
        { "name": "systemProgram", "writable": false }
      ],
      "args": [{ "name": "maxStake", "type": "u64" }, { "name": "rewardRate", "type": "u64" }]
    },
    {
      "name": "stake",
      "discriminator": [206, 176, 202, 18, 200, 209, 179, 108],
      "accounts": [
        { "name": "globalState", "writable": false },
        { "name": "userState", "writable": true },
        { "name": "user", "writable": true, "signer": true },
        { "name": "systemProgram", "writable": false }
      ],
      "args": [{ "name": "amount", "type": "u64" }]
    },
    {
      "name": "unstake",
      "discriminator": [191, 161, 103, 159, 64, 92, 14, 77],
      "accounts": [
        { "name": "userState", "writable": true },
        { "name": "user", "writable": true, "signer": true }
      ],
      "args": [{ "name": "amount", "type": "u64" }]
    }
  ],
  "accounts": [
    { "name": "GlobalState", "discriminator": [163, 46, 74, 6, 137, 4, 123, 226] },
    { "name": "UserState", "discriminator": [72, 177, 85, 249, 76, 167, 186, 126] }
  ],
  "types": [
    {
      "name": "GlobalState",
      "type": { "kind": "struct", "fields": [{ "name": "maxStake", "type": "u64" }, { "name": "rewardRate", "type": "u64" }] }
    },
    {
      "name": "UserState",
      "type": { "kind": "struct", "fields": [{ "name": "stakedAmount", "type": "u64" }, { "name": "lastStakeTime", "type": "i64" }] }
    }
  ],
  "errors": [
    { "code": 6000, "name": "OverMaxStake", "msg": "Exceeds maximum stake limit." },
    { "code": 6001, "name": "InsufficientFunds", "msg": "Insufficient staked amount." }
  ]
};

const formatLargeNumber = (num: number): string => {
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(2) + 'K';
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
};

function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return "Ready";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function calculateEstimatedRewards(stakedAmount: number) {
  return {
    daily: stakedAmount * DAILY_REWARD_RATE,
    weekly: stakedAmount * DAILY_REWARD_RATE * 7,
    monthly: stakedAmount * DAILY_REWARD_RATE * 30,
    yearly: stakedAmount * (APR / 100)
  };
}

const TESTIMONIALS = [
  { name: "Early_Witness", role: "Holder", comment: "This isn't just a token, it's a social experiment. 'MeFi' is the next big narrative." },
  { name: "Destinx", role: "Right Hand", comment: "We value long-term vision over short-term hype. The team is always cooking." },
  { name: "Based_Dev", role: "Founder", comment: "Be Honest. Be Kind. Trust is the ultimate currency." },
  { name: "Solana_Whale", role: "Investor", comment: "The concept of 'Identity to Equity' is fascinating. Finally, a project with a real face." },
  { name: "Community_Member", role: "Witness", comment: "From digital inscription to physical reality. Watching this evolution is incredible." },
];

export default function Home() {
  const { publicKey } = useWallet();
  const wallet = useAnchorWallet();
  const connection = useMemo(() => new Connection(RPC_ENDPOINT, 'confirmed'), []);

  const [activeTab, setActiveTab] = useState<'stake' | 'unstake'>('stake');
  const [walletBalance, setWalletBalance] = useState<string>("0");
  const [stakedBalance, setStakedBalance] = useState<string>("0");
  const [rewardBalance, setRewardBalance] = useState<string>("0.0000");
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [amount, setAmount] = useState<string>("");
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [rewardRate, setRewardRate] = useState<number>(DAILY_REWARD_RATE);
  const [lockTimeRemaining, setLockTimeRemaining] = useState<number>(0);
  const [canUnstake, setCanUnstake] = useState<boolean>(true);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);
  const [estimatedRewards, setEstimatedRewards] = useState({
    daily: 0,
    weekly: 0,
    monthly: 0,
    yearly: 0
  });

  useEffect(() => { setMounted(true); }, []);
  
  useEffect(() => {
    if (!publicKey || !wallet) return;
    fetchInfo();
    const interval = setInterval(fetchInfo, FETCH_INTERVAL);
    return () => clearInterval(interval);
  }, [publicKey, wallet, connection]);

  useEffect(() => {
    if (!lastUpdateTime || lastUpdateTime === 0) return;
    const interval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const lockEndTime = lastUpdateTime + MIN_LOCK_SECONDS;
      const remaining = Math.max(0, lockEndTime - now);
      setLockTimeRemaining(remaining);
      setCanUnstake(remaining === 0);
    }, 1000);
    return () => clearInterval(interval);
  }, [lastUpdateTime]);

  useEffect(() => {
    if (amount && !isNaN(Number(amount)) && Number(amount) > 0) {
      const rewards = calculateEstimatedRewards(parseFloat(amount));
      setEstimatedRewards(rewards);
    } else {
      setEstimatedRewards({ daily: 0, weekly: 0, monthly: 0, yearly: 0 });
    }
  }, [amount]);

  const fetchInfo = async () => {
    if (!publicKey || !wallet) return;
    setIsFetching(true);
    setErrorMessage("");

    try {
      try {
        const ata = await getAssociatedTokenAddress(DAKY_MINT, publicKey);
        const account = await getAccount(connection, ata);
        setWalletBalance(formatLargeNumber(Number(account.amount) / Math.pow(10, DECIMALS)));
      } catch (e) {
        console.warn("Failed to fetch wallet balance:", e);
        setWalletBalance("0");
      }

      try {
        const provider = new anchor.AnchorProvider(connection, wallet, anchor.AnchorProvider.defaultOptions());
        const program = new anchor.Program(IDL, provider) as unknown as DakyProgram;
        
        const [globalState] = PublicKey.findProgramAddressSync([new TextEncoder().encode("global")], PROGRAM_ID);
        
        try {
          const globalData = await program.account.globalState.fetch(globalState);
          setRewardRate(Number(globalData.rewardRate.toString()) / Math.pow(10, DECIMALS));
        } catch (e) {
          console.warn("GlobalState not found");
        }

        const [userState] = PublicKey.findProgramAddressSync([new TextEncoder().encode("user"), publicKey.toBuffer()], PROGRAM_ID);
        const userData = await program.account.userState.fetch(userState);
        
        const staked = Number(userData.stakedAmount.toString()) / Math.pow(10, DECIMALS);
        setStakedBalance(formatLargeNumber(staked));

        const lastStakeTime = Number(userData.lastStakeTime.toString());
        setLastUpdateTime(lastStakeTime);

        const now = Math.floor(Date.now() / 1000);
        const elapsed = Math.max(0, now - lastStakeTime);
        const estimatedReward = staked > 0 ? (elapsed * DAILY_REWARD_RATE * staked) : 0;
        setRewardBalance(formatLargeNumber(estimatedReward));

        const signatures = await connection.getSignaturesForAddress(userState, { limit: 5 });
        setActivities(signatures.map(sig => ({
          signature: sig.signature,
          slot: sig.slot,
          blockTime: sig.blockTime || 0,
          status: (sig.err ? 'fail' : 'success') as 'success' | 'fail'
        })));
      } catch (e) {
        console.warn("Failed to fetch program data:", e);
      }
    } catch (e) {
      console.error("Error fetching info:", e);
      setErrorMessage("Failed to fetch data. Please try again later.");
    } finally {
      setIsFetching(false);
    }
  };

  const handleAction = async () => {
    if (!wallet) {
      alert("Please connect your wallet");
      return;
    }
    
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    if (activeTab === 'unstake' && !canUnstake) {
      alert(`Please wait ${formatTimeRemaining(lockTimeRemaining)} before unstaking.\n\nMinimum lock period: ${MIN_LOCK_DAYS} days`);
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      const provider = new anchor.AnchorProvider(connection, wallet, anchor.AnchorProvider.defaultOptions());
      const program = new anchor.Program(IDL, provider) as unknown as DakyProgram;
      
      const amountBN = new anchor.BN(Math.floor(parseFloat(amount) * Math.pow(10, DECIMALS)));
      
      const [globalState] = PublicKey.findProgramAddressSync([new TextEncoder().encode("global")], PROGRAM_ID);
      const [userState] = PublicKey.findProgramAddressSync([new TextEncoder().encode("user"), wallet.publicKey.toBuffer()], PROGRAM_ID);

      let tx;
      if (activeTab === 'stake') {
        tx = await (program as any).methods
          .stake(amountBN)
          .accounts({
            globalState, 
            userState, 
            user: wallet.publicKey, 
            systemProgram: SystemProgram.programId,
          })
          .rpc();
      } else {
        tx = await (program as any).methods
          .unstake(amountBN)
          .accounts({
            userState, 
            user: wallet.publicKey,
          })
          .rpc();
      }
      
      alert(`Success!\nTransaction: ${tx.slice(0, 8)}...`);
      setAmount("");
      setTimeout(() => fetchInfo(), 2000);
    } catch (err: any) {
      console.error("Transaction error:", err);
      
      let errorMsg = "Transaction failed.";
      if (err.message?.includes("User rejected")) {
        errorMsg = "Transaction was cancelled.";
      } else if (err.message?.includes("insufficient")) {
        errorMsg = "Insufficient balance.";
      } else if (err.message?.includes("LockPeriodNotMet")) {
        errorMsg = `Minimum lock period not met.\n\nPlease wait ${formatTimeRemaining(lockTimeRemaining)} before unstaking.`;
      } else if (err.message?.includes("OverMaxStake")) {
        errorMsg = "Exceeds maximum stake limit.";
      } else if (err.message?.includes("InsufficientFunds")) {
        errorMsg = "Insufficient staked amount to withdraw.";
      }
      
      alert(errorMsg);
      setErrorMessage(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaim = () => {
    alert("Claim function coming soon!");
  };

  const handleMaxClick = () => {
    const balanceStr = (activeTab === 'stake' ? walletBalance : stakedBalance).replace(/[BKM,]/g, '');
    const multiplier = (activeTab === 'stake' ? walletBalance : stakedBalance).includes('B') ? 1_000_000_000 : 
                      (activeTab === 'stake' ? walletBalance : stakedBalance).includes('M') ? 1_000_000 : 
                      (activeTab === 'stake' ? walletBalance : stakedBalance).includes('K') ? 1_000 : 1;
    setAmount((parseFloat(balanceStr) * multiplier).toString());
  };

  if (!mounted) return null;

  return (
    <main style={{ backgroundColor: '#050505', minHeight: '100vh', fontFamily: '"Inter", sans-serif', color: 'white', overflowX: 'hidden' }}>
      
      <div className="bg-gradient-purple"></div>
      <div className="bg-gradient-blue"></div>
      <div className="bg-grid"></div>

      <div style={{ zIndex: 1, position: 'relative', width: '100%', maxWidth: '1000px', margin: '0 auto', padding: '60px 20px' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '40px', animation: 'fadeInDown 0.8s ease-out' }}>
          <h1 style={{ fontSize: '4rem', fontWeight: '800', background: 'linear-gradient(to right, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: '0', letterSpacing: '-0.02em' }}>
            $DAKY <span style={{ color: '#A855F7', WebkitTextFillColor: '#A855F7' }}>VAULT</span>
          </h1>
          <p style={{ color: '#64748b', letterSpacing: '0.3em', fontSize: '0.9rem', marginTop: '10px', textTransform: 'uppercase' }}>Identity to Equity v2</p>
        </div>

        <div className="apr-banner">
          <div className="apr-main">
            <span className="apr-label">Annual Percentage Rate</span>
            <span className="apr-value">{APR}% APR</span>
          </div>
          <div className="apr-details">
            <span>✨ {(DAILY_REWARD_RATE * 100).toFixed(3)}% daily</span>
            <span>🔒 {MIN_LOCK_DAYS} day minimum lock</span>
            <span>💎 NFT perks for top stakers</span>
          </div>
        </div>

        {errorMessage && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', padding: '15px', marginBottom: '20px', color: '#FCA5A5', textAlign: 'center' }}>
            {errorMessage}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px', marginBottom: '80px' }}>
          
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 className="card-title" style={{ marginBottom: 0, paddingBottom: 0, border: 'none' }}>STAKING</h2>
              {isFetching && <div className="loading-spinner" aria-label="Loading"></div>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '25px' }}>
              <div className="stat-box">
                <p className="label">Wallet Balance</p>
                <p className="value">{walletBalance}</p>
              </div>
              <div className="stat-box active">
                <p className="label">Staked Amount</p>
                <p className="value active-text">{stakedBalance}</p>
              </div>
            </div>
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.4)', borderRadius: '12px', padding: '4px', marginBottom: '20px' }}>
              {['stake', 'unstake'].map(tab => (
                <button 
                  key={tab} 
                  onClick={() => setActiveTab(tab as any)}
                  className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                  aria-label={`${tab} tab`}
                >
                  {tab.toUpperCase()}
                </button>
              ))}
            </div>
            <div style={{ position: 'relative', marginBottom: '10px' }}>
              <input 
                type="number" 
                value={amount} 
                onChange={(e) => setAmount(e.target.value)} 
                placeholder="0.00" 
                className="input-field"
                aria-label="Amount input"
                disabled={isLoading}
                step="any"
              />
              <span className="unit-label">DAKY</span>
            </div>

            {amount && parseFloat(amount) > 0 && (
              <div className="reward-preview">
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>ESTIMATED REWARDS</h4>
                <div className="reward-grid">
                  <div className="reward-item">
                    <span className="reward-period">Daily</span>
                    <span className="reward-amount">{estimatedRewards.daily.toFixed(2)}</span>
                  </div>
                  <div className="reward-item">
                    <span className="reward-period">Weekly</span>
                    <span className="reward-amount">{estimatedRewards.weekly.toFixed(2)}</span>
                  </div>
                  <div className="reward-item">
                    <span className="reward-period">Monthly</span>
                    <span className="reward-amount">{estimatedRewards.monthly.toFixed(2)}</span>
                  </div>
                  <div className="reward-item">
                    <span className="reward-period">Yearly</span>
                    <span className="reward-amount">{estimatedRewards.yearly.toFixed(0)}</span>
                  </div>
                </div>
              </div>
            )}

            <button onClick={handleMaxClick} className="max-btn" disabled={isLoading || !wallet} aria-label="Set maximum amount">MAX</button>

            {activeTab === 'unstake' && stakedBalance !== "0" && (
              <div className="lock-status">
                {canUnstake ? (
                  <div className="lock-ready">✅ Ready to unstake</div>
                ) : (
                  <div className="lock-waiting">⏰ Unlock in: {formatTimeRemaining(lockTimeRemaining)}</div>
                )}
              </div>
            )}

            <button 
              onClick={handleAction} 
              disabled={isLoading || !wallet || (activeTab === 'unstake' && !canUnstake)} 
              className={`action-btn ${activeTab}`}
              aria-label={activeTab === 'stake' ? 'Stake tokens' : 'Withdraw tokens'}
              style={{ marginTop: '15px' }}
            >
              {isLoading ? 'PROCESSING...' : 
               activeTab === 'stake' ? 'STAKE TOKENS' : 
               !canUnstake ? `LOCKED (${formatTimeRemaining(lockTimeRemaining)})` :
               'WITHDRAW TOKENS'}
            </button>
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}><WalletMultiButton /></div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="glass-card">
              <h2 className="card-title">REWARDS</h2>
              <div style={{ marginBottom: '20px' }}>
                <p className="label" style={{ marginBottom: '5px' }}>Pending Rewards</p>
                <p className="reward-value">{rewardBalance} <span style={{ fontSize: '1rem', color: '#64748b' }}>DAKY</span></p>
              </div>
              <button onClick={handleClaim} className="claim-btn" aria-label="Claim rewards">CLAIM REWARDS</button>
            </div>
            <div className="glass-card" style={{ flex: 1 }}>
              <h2 className="card-title">ACTIVITY</h2>
              <div className="activity-list">
                {activities.length === 0 ? (
                  <p className="no-activity">No recent activity</p>
                ) : (
                  activities.map((log, i) => (
                    <div key={i} className="activity-item">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className={`status-dot ${log.status}`} aria-label={log.status}></div>
                        <span className="tx-hash">{log.signature.slice(0, 8)}...</span>
                      </div>
                      <span className="tx-time">{log.blockTime ? new Date(log.blockTime * 1000).toLocaleTimeString() : 'Pending'}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

      </div>

      <section style={{ padding: '80px 20px', background: 'rgba(0,0,0,0.5)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
          <h3 className="section-title">OUR VISION</h3>
          <h2 style={{ fontSize: '2.5rem', fontWeight: '700', marginBottom: '20px', color: 'white' }}>MeFi: Identity to Equity</h2>
          <p style={{ fontSize: '1.2rem', lineHeight: '1.6', color: '#94a3b8' }}>
            Me (Me) + DeFi (Decentralized Finance).<br/>
            A social experiment to tokenize and visualize personal "credibility" and "brand."<br/>
            From a simple exchange among peers to a universal asset. The Identity Extension is complete.
          </p>
        </div>
      </section>

      <section style={{ padding: '80px 20px', background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(0,0,0,0) 100%)' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '50px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <div className="founder-image-container">
            <Image 
              src="/daiki.png" 
              alt="Based Dev - Founder of DAKY" 
              width={250} 
              height={250} 
              className="founder-img"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <div className="founder-glow"></div>
          </div>
          <div style={{ maxWidth: '600px' }}>
            <h3 className="section-title" style={{ textAlign: 'left', marginBottom: '10px' }}>FROM THE DEV</h3>
            <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '20px', color: 'white' }}>"Be Honest. Be Kind."</h2>
            <p style={{ fontSize: '1.1rem', lineHeight: '1.8', color: '#cbd5e1', marginBottom: '20px', fontStyle: 'italic' }}>
              "I'm not here for a quick pump, I'm here to build a legacy. The trenches are tough, but we are unstoppable. 
              Trust is the ultimate currency, and I am building it block by block."
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div style={{ height: '2px', width: '30px', background: '#A855F7' }}></div>
              <p style={{ fontWeight: '700', color: '#A855F7' }}>BASED DEV <span style={{ color: '#64748b', fontWeight: '400' }}>| FOUNDER</span></p>
            </div>
          </div>
        </div>
      </section>

      <section style={{ padding: '80px 20px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <h3 className="section-title" style={{ textAlign: 'center', marginBottom: '50px' }}>PROJECT ROADMAP</h3>
          <div className="roadmap-grid">
            <div className="roadmap-card done">
              <span className="phase">PHASE 0</span>
              <h4>The Trenches</h4>
              <ul><li>Launch on Pump.fun</li><li>Surviving the Chaos</li><li>Learning from Scams</li></ul>
            </div>
            <div className="roadmap-card done">
              <span className="phase">PHASE 1</span>
              <h4>Foundation of Trust</h4>
              <ul><li>Team Formation (Based Dev)</li><li>Revenue Reinvestment</li><li>Token Lock (3%)</li></ul>
            </div>
            <div className="roadmap-card active">
              <span className="phase">PHASE 2</span>
              <h4>Growth & Awareness</h4>
              <ul><li>Identity to Equity Narrative</li><li>Community Building (X, TG)</li><li>Professional Creative Assets</li></ul>
            </div>
            <div className="roadmap-card">
              <span className="phase">PHASE 3</span>
              <h4>The Physical Touch</h4>
              <ul><li>Manifestation in Reality</li><li>Physical Objects</li><li>Universal Asset Expansion</li></ul>
            </div>
          </div>
        </div>
      </section>

      <section style={{ padding: '80px 20px', background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(168, 85, 247, 0.05) 100%)' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '40px' }}>
          <div className="glass-card promo-card nft-bg">
            <div className="content">
              <h3>Visual Evolution of Credibility</h3>
              <p>Turn your staking rewards into limited edition NFTs. Visualize the core identity etched into the blockchain.</p>
              <button className="promo-btn" aria-label="View NFT collection">VIEW COLLECTION (Coming Soon)</button>
            </div>
          </div>
          <div className="glass-card promo-card telegram-bg">
            <div className="content">
              <h3>Join the Family</h3>
              <p>Be Honest. Be Kind. Connect with other "Witnesses of Trust" and stay updated with the latest announcements.</p>
              <button 
                className="promo-btn telegram" 
                onClick={() => window.open('https://t.me/DAKY_Official', '_blank')}
                aria-label="Join Telegram group"
              >
                JOIN TELEGRAM
              </button>
            </div>
          </div>
        </div>
      </section>

      <section style={{ padding: '60px 0', borderTop: '1px solid rgba(255,255,255,0.05)', background: '#000' }}>
        <h3 className="section-title" style={{ textAlign: 'center', marginBottom: '40px' }}>WITNESSES OF TRUST</h3>
        <div className="marquee-container">
          <div className="marquee-content">
            {[...TESTIMONIALS, ...TESTIMONIALS].map((item, i) => (
              <div key={i} className="testimonial-card">
                <p className="comment">"{item.comment}"</p>
                <div className="author">
                  <div className="avatar" aria-hidden="true"></div>
                  <div>
                    <p className="name">{item.name}</p>
                    <p className="role">{item.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer style={{ textAlign: 'center', padding: '40px', color: '#475569', fontSize: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        &copy; 2024 DAKY VAULT. SECURED BY SOLANA & ANCHOR.
      </footer>

      <style jsx global>{`
        * { box-sizing: border-box; }
        body { margin: 0; background: #050505; }
        .section-title { font-size: 0.9rem; letter-spacing: 0.2em; color: #94a3b8; margin-bottom: 20px; font-weight: 700; text-transform: uppercase; }
        .card-title { font-size: 1.1rem; font-weight: 700; margin-bottom: 20px; color: #fff; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 15px; letter-spacing: 0.05em; }
        .glass-card { padding: 30px; border-radius: 24px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); backdrop-filter: blur(20px); }
        .apr-banner { background: linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(59, 130, 246, 0.1)); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 16px; padding: 20px 30px; margin: 20px auto 40px; }
        .apr-main { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
        .apr-label { font-size: 0.9rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; }
        .apr-value { font-size: 2.5rem; font-weight: 800; background: linear-gradient(135deg, #A855F7, #3B82F6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .apr-details { display: flex; justify-content: space-around; gap: 20px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.1); flex-wrap: wrap; }
        .apr-details span { font-size: 0.9rem; color: #cbd5e1; }
        .reward-preview { background: rgba(168, 85, 247, 0.05); border: 1px solid rgba(168, 85, 247, 0.2); border-radius: 12px; padding: 15px; margin: 15px 0; }
        .reward-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
        .reward-item { display: flex; flex-direction: column; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 8px; }
        .reward-period { font-size: 0.7rem; color: #94a3b8; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.05em; }
        .reward-amount { font-size: 1.1rem; font-weight: 700; color: #10B981; font-family: monospace; }
        .lock-status { margin: 15px 0 10px; }
        .lock-ready { text-align: center; padding: 12px; border-radius: 8px; font-weight: 600; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); color: #10B981; }
        .lock-waiting { text-align: center; padding: 12px; border-radius: 8px; font-weight: 600; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); color: #F59E0B; }
        .loading-spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.1); border-top-color: #A855F7; border-radius: 50%; animation: spin 0.6s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .founder-image-container { position: relative; width: 250px; height: 250px; display: flex; justify-content: center; align-items: center; }
        .founder-img { border-radius: 50%; border: 4px solid rgba(168, 85, 247, 0.5); z-index: 2; object-fit: cover; }
        .founder-glow { position: absolute; width: 100%; height: 100%; background: radial-gradient(circle, rgba(168, 85, 247, 0.4) 0%, transparent 70%); filter: blur(20px); z-index: 1; animation: pulse 3s infinite; }
        @keyframes pulse { 0% { transform: scale(1); opacity: 0.6; } 50% { transform: scale(1.1); opacity: 0.8; } 100% { transform: scale(1); opacity: 0.6; } }
        .stat-box { background: rgba(0,0,0,0.3); padding: 15px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); }
        .stat-box.active { background: rgba(168, 85, 247, 0.1); border-color: rgba(168, 85, 247, 0.3); }
        .label { color: #94a3b8; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; margin: 0 0 5px 0; }
        .value { color: white; font-size: 1.25rem; font-weight: 700; font-family: monospace; margin: 0; }
        .value.active-text { color: #d8b4fe; }
        .reward-value { font-size: 2.5rem; font-weight: 800; color: #10B981; font-family: monospace; margin: 0; text-shadow: 0 0 20px rgba(16, 185, 129, 0.3); }
        .tab-btn { flex: 1; padding: 10px; border-radius: 8px; border: none; cursor: pointer; font-weight: 600; background: transparent; color: #64748b; transition: all 0.3s; }
        .tab-btn.active { background: rgba(255,255,255,0.1); color: white; }
        .tab-btn:hover:not(.active) { background: rgba(255,255,255,0.05); }
        .input-field { width: 100%; padding: 16px; padding-right: 60px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; color: white; font-size: 1.5rem; outline: none; font-family: monospace; transition: border-color 0.3s; }
        .input-field:focus { border-color: rgba(168, 85, 247, 0.5); }
        .input-field:disabled { opacity: 0.5; cursor: not-allowed; }
        .unit-label { position: absolute; right: 20px; top: 22px; color: #64748b; font-weight: bold; font-size: 0.8rem; }
        .max-btn { width: 100%; padding: 10px; border-radius: 8px; border: 1px solid rgba(168, 85, 247, 0.3); background: rgba(168, 85, 247, 0.1); color: #A855F7; font-weight: 700; cursor: pointer; transition: all 0.2s; font-size: 0.9rem; }
        .max-btn:hover:not(:disabled) { background: rgba(168, 85, 247, 0.2); transform: translateY(-1px); }
        .max-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .action-btn { width: 100%; padding: 18px; border-radius: 16px; border: none; font-weight: 700; cursor: pointer; color: white; transition: all 0.2s; }
        .action-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }
        .action-btn:not(:disabled):hover { transform: translateY(-2px); box-shadow: 0 4px 20px rgba(168, 85, 247, 0.3); }
        .action-btn:not(:disabled):active { transform: translateY(0); }
        .action-btn.stake { background: linear-gradient(135deg, #3B82F6, #A855F7); }
        .action-btn.unstake { background: linear-gradient(135deg, #EF4444, #F59E0B); }
        .claim-btn { width: 100%; padding: 14px; border-radius: 12px; border: 1px solid #10B981; background: rgba(16, 185, 129, 0.1); color: #10B981; font-weight: 700; cursor: pointer; transition: all 0.2s; }
        .claim-btn:hover { background: rgba(16, 185, 129, 0.2); transform: translateY(-2px); }
        .activity-list { display: flex; flex-direction: column; gap: 10px; max-height: 200px; overflow-y: auto; }
        .activity-list::-webkit-scrollbar { width: 6px; }
        .activity-list::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 3px; }
        .activity-list::-webkit-scrollbar-thumb { background: rgba(168, 85, 247, 0.5); border-radius: 3px; }
        .activity-item { display: flex; justify-content: space-between; align-items: center; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px; transition: background 0.2s; }
        .activity-item:hover { background: rgba(255,255,255,0.05); }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; }
        .status-dot.success { background: #10B981; box-shadow: 0 0 6px rgba(16, 185, 129, 0.5); }
        .status-dot.fail { background: #EF4444; box-shadow: 0 0 6px rgba(239, 68, 68, 0.5); }
        .tx-hash { font-size: 0.9rem; color: #e2e8f0; font-family: monospace; }
        .tx-time { font-size: 0.8rem; color: #64748b; }
        .no-activity { color: #64748b; text-align: center; font-size: 0.9rem; padding: 20px; }
        .roadmap-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; }
        .roadmap-card { padding: 30px; border-radius: 16px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); transition: all 0.3s; }
        .roadmap-card:hover { transform: translateY(-5px); }
        .roadmap-card.done { border-color: #10B981; opacity: 0.6; }
        .roadmap-card.active { border-color: #A855F7; background: rgba(168, 85, 247, 0.05); transform: scale(1.02); box-shadow: 0 0 30px rgba(168, 85, 247, 0.1); }
        .phase { font-size: 0.7rem; font-weight: 700; color: #64748b; letter-spacing: 0.1em; }
        .roadmap-card h4 { margin: 10px 0 20px 0; font-size: 1.1rem; color: #fff; }
        .roadmap-card ul { list-style: none; padding: 0; margin: 0; color: #94a3b8; font-size: 0.9rem; line-height: 1.6; }
        .roadmap-card ul li:before { content: "•"; color: #475569; margin-right: 10px; }
        .promo-card { min-height: 250px; display: flex; align-items: center; position: relative; overflow: hidden; transition: transform 0.3s; }
        .promo-card:hover { transform: translateY(-5px); }
        .promo-card .content { position: relative; z-index: 2; }
        .promo-card h3 { font-size: 1.8rem; margin: 0 0 15px 0; color: white; }
        .promo-card p { color: #cbd5e1; margin-bottom: 25px; line-height: 1.5; max-width: 80%; }
        .promo-btn { padding: 12px 24px; border-radius: 8px; border: none; font-weight: 700; cursor: pointer; background: white; color: black; font-size: 0.9rem; transition: all 0.2s; }
        .promo-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 15px rgba(255,255,255,0.3); }
        .promo-btn.telegram { background: #0088cc; color: white; }
        .marquee-container { width: 100%; overflow: hidden; position: relative; }
        .marquee-content { display: flex; gap: 30px; width: max-content; animation: scroll 40s linear infinite; }
        .marquee-content:hover { animation-play-state: paused; }
        .testimonial-card { width: 350px; background: rgba(255,255,255,0.03); padding: 25px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); flex-shrink: 0; transition: all 0.3s; }
        .testimonial-card:hover { background: rgba(255,255,255,0.05); transform: translateY(-3px); }
        .comment { color: #e2e8f0; font-size: 1rem; line-height: 1.5; margin-bottom: 20px; font-style: italic; }
        .author { display: flex; align-items: center; gap: 15px; }
        .avatar { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #3B82F6, #A855F7); }
        .name { color: white; font-weight: 700; font-size: 0.9rem; margin: 0; }
        .role { color: #64748b; font-size: 0.8rem; margin: 0; }
        @keyframes scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .bg-gradient-purple { position: fixed; top: -20%; left: -10%; width: 600px; height: 600px; background: radial-gradient(circle, rgba(168,85,247,0.15) 0%, rgba(0,0,0,0) 70%); filter: blur(100px); z-index: 0; }
        .bg-gradient-blue { position: fixed; bottom: -20%; right: -10%; width: 500px; height: 500px; background: radial-gradient(circle, rgba(59,130,246,0.15) 0%, rgba(0,0,0,0) 70%); filter: blur(100px); z-index: 0; }
        .bg-grid { position: fixed; width: 100%; height: 100%; background-image: linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px); background-size: 50px 50px; z-index: 0; opacity: 0.3; }
        .wallet-adapter-button { background-color: transparent !important; border: 1px solid rgba(255,255,255,0.2) !important; font-family: "Inter", sans-serif !important; height: 40px !important; transition: all 0.2s !important; }
        .wallet-adapter-button:hover:not([disabled]) { background-color: rgba(255,255,255,0.1) !important; border-color: rgba(168, 85, 247, 0.5) !important; }
        @keyframes fadeInDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 768px) {
          h1 { font-size: 2.5rem !important; }
          .apr-value { font-size: 2rem !important; }
          .apr-details { flex-direction: column; gap: 10px; text-align: center; }
          .promo-card p { max-width: 100%; }
          .roadmap-grid { grid-template-columns: 1fr; }
          .reward-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </main>
  );
}