"use client";
import { useState, useEffect, useMemo } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet, useAnchorWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram, Connection } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import Image from 'next/image';
import { APRBanner } from './components/APRBanner';
import { RewardPreview } from './components/RewardPreview';
import { LockStatus } from './components/LockStatus';
import { useStakingInfo } from './hooks/useStakingInfo';
import { useLockTimer } from './hooks/useLockTimer';
import { PROGRAM_ID, RPC_ENDPOINT, DECIMALS, MIN_LOCK_DAYS, TESTIMONIALS } from './lib/constants';
import { IDL } from './lib/idl';
import { calculateEstimatedRewards, parseFormattedBalance, formatTimeRemaining } from './lib/utils';
import type { DakyProgram, EstimatedRewards, ActivityLog } from './lib/types';
import '@/styles/globals.css';

export default function Home() {
  const { publicKey } = useWallet();
  const wallet = useAnchorWallet();
  const connection = useMemo(() => new Connection(RPC_ENDPOINT, 'confirmed'), []);

  const [activeTab, setActiveTab] = useState<'stake' | 'unstake'>('stake');
  const [amount, setAmount] = useState<string>("");
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [estimatedRewards, setEstimatedRewards] = useState<EstimatedRewards>({
    daily: 0,
    weekly: 0,
    monthly: 0,
    yearly: 0
  });

  const {
    walletBalance,
    stakedBalance,
    rewardBalance,
    activities,
    isFetching,
    errorMessage,
    lastUpdateTime,
    refetch
  } = useStakingInfo();

  const { lockTimeRemaining, canUnstake } = useLockTimer(lastUpdateTime);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (amount && !isNaN(Number(amount)) && Number(amount) > 0) {
      const rewards = calculateEstimatedRewards(parseFloat(amount));
      setEstimatedRewards(rewards);
    } else {
      setEstimatedRewards({ daily: 0, weekly: 0, monthly: 0, yearly: 0 });
    }
  }, [amount]);

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
      setTimeout(() => refetch(), 2000);
    } catch (err: any) {
      console.error("Transaction error:", err);
      let errorMsg = "Transaction failed.";
      if (err.message?.includes("User rejected")) errorMsg = "Transaction was cancelled.";
      else if (err.message?.includes("insufficient")) errorMsg = "Insufficient balance.";
      else if (err.message?.includes("LockPeriodNotMet")) errorMsg = `Minimum lock period not met.\n\nPlease wait ${formatTimeRemaining(lockTimeRemaining)} before unstaking.`;
      alert(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaim = () => {
    alert("Claim function coming soon!");
  };

  const handleMaxClick = () => {
    const balance = activeTab === 'stake' ? walletBalance : stakedBalance;
    setAmount(parseFormattedBalance(balance).toString());
  };

  if (!mounted) return null;

  return (
    <main style={{ backgroundColor: '#050505', minHeight: '100vh', fontFamily: '"Inter", sans-serif', color: 'white', overflowX: 'hidden' }}>
      
      <div className="bg-gradient-purple"></div>
      <div className="bg-gradient-blue"></div>
      <div className="bg-grid"></div>

      <div style={{ zIndex: 1, position: 'relative', width: '100%', maxWidth: '1000px', margin: '0 auto', padding: '60px 20px' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px', animation: 'fadeInDown 0.8s ease-out' }}>
          <h1 style={{ fontSize: '4rem', fontWeight: '800', background: 'linear-gradient(to right, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: '0', letterSpacing: '-0.02em' }}>
            $DAKY <span style={{ color: '#A855F7', WebkitTextFillColor: '#A855F7' }}>VAULT</span>
          </h1>
          <p style={{ color: '#64748b', letterSpacing: '0.3em', fontSize: '0.9rem', marginTop: '10px', textTransform: 'uppercase' }}>Identity to Equity v2</p>
        </div>

        <APRBanner />

        {errorMessage && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', padding: '15px', marginBottom: '20px', color: '#FCA5A5', textAlign: 'center' }}>
            {errorMessage}
          </div>
        )}

        {/* Dashboard */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px', marginBottom: '80px' }}>
          
          {/* Staking Card */}
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 className="card-title" style={{ marginBottom: 0, paddingBottom: 0, border: 'none' }}>STAKING</h2>
              {isFetching && <div className="loading-spinner"></div>}
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
                disabled={isLoading}
                step="any"
              />
              <span className="unit-label">DAKY</span>
            </div>

            {amount && parseFloat(amount) > 0 && <RewardPreview rewards={estimatedRewards} />}

            <button onClick={handleMaxClick} className="max-btn" disabled={isLoading || !wallet}>MAX</button>

            {activeTab === 'unstake' && stakedBalance !== "0" && (
              <LockStatus canUnstake={canUnstake} lockTimeRemaining={lockTimeRemaining} />
            )}

            <button 
              onClick={handleAction} 
              disabled={isLoading || !wallet || (activeTab === 'unstake' && !canUnstake)} 
              className={`action-btn ${activeTab}`}
              style={{ marginTop: '15px' }}
            >
              {isLoading ? 'PROCESSING...' : 
               activeTab === 'stake' ? 'STAKE TOKENS' : 
               !canUnstake ? `LOCKED (${formatTimeRemaining(lockTimeRemaining)})` :
               'WITHDRAW TOKENS'}
            </button>
            
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
              <WalletMultiButton />
            </div>
          </div>

          {/* Right Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Rewards */}
            <div className="glass-card">
              <h2 className="card-title">REWARDS</h2>
              <div style={{ marginBottom: '20px' }}>
                <p className="label" style={{ marginBottom: '5px' }}>Pending Rewards</p>
                <p className="reward-value">{rewardBalance} <span style={{ fontSize: '1rem', color: '#64748b' }}>DAKY</span></p>
              </div>
              <button onClick={handleClaim} className="claim-btn">CLAIM REWARDS</button>
            </div>
            
            {/* Activity */}
            <div className="glass-card" style={{ flex: 1 }}>
              <h2 className="card-title">ACTIVITY</h2>
              <div className="activity-list">
                {activities.length === 0 ? (
                  <p className="no-activity">No recent activity</p>
                ) : (
                  activities.map((log: ActivityLog, i: number) => (
                    <div key={i} className="activity-item">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className={`status-dot ${log.status}`}></div>
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

      {/* Sections (省略版 - 必要に応じてコンポーネント化) */}
      <section style={{ padding: '80px 20px', background: 'rgba(0,0,0,0.5)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
          <h3 className="section-title">OUR VISION</h3>
          <h2 style={{ fontSize: '2.5rem', fontWeight: '700', marginBottom: '20px', color: 'white' }}>MeFi: Identity to Equity</h2>
          <p style={{ fontSize: '1.2rem', lineHeight: '1.6', color: '#94a3b8' }}>
            Me (Me) + DeFi (Decentralized Finance).<br/>
            A social experiment to tokenize and visualize personal "credibility" and "brand."
          </p>
        </div>
      </section>

      <footer style={{ textAlign: 'center', padding: '40px', color: '#475569', fontSize: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        &copy; 2024 DAKY VAULT. SECURED BY SOLANA & ANCHOR.
      </footer>
    </main>
  );
}