"use client";
import { useState, useEffect, useMemo } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet, useAnchorWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram, Connection, clusterApiUrl } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import * as anchor from '@coral-xyz/anchor';
import Image from 'next/image'; // Imageコンポーネントのインポート

// --- 設定値 ---
const PROGRAM_ID = new PublicKey("6SVBFPT8bLcbp8eDud9ECSoVYJhzmXxgHm9iU5FviKAs");
const DAKY_MINT = new PublicKey("CzLeDd7qrK8Y4XREpsb4uc5xVX9ktYcryGw3zXRSpump");
const RPC_ENDPOINT = clusterApiUrl('devnet');

// --- IDL (省略なし) ---
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
      "discriminator": [169, 23, 133, 108, 236, 202, 188, 148],
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
    { "code": 6000, "name": "OverMaxStake", "msg": "預け入れ上限を超えています。" },
    { "code": 6001, "name": "InsufficientFunds", "msg": "引き出し額が預け入れ額を超えています。" }
  ]
};

// 型定義
type ActivityLog = {
  signature: string;
  slot: number;
  blockTime: number;
  status: 'success' | 'fail';
};

// モックデータ: 有識者コメント
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

  useEffect(() => { setMounted(true); }, []);
  
  useEffect(() => {
    if (!publicKey) return;
    fetchInfo();
    const interval = setInterval(fetchInfo, 10000);
    return () => clearInterval(interval);
  }, [publicKey, connection]);

  const fetchInfo = async () => {
    if (!publicKey) return;
    try {
      const ata = await getAssociatedTokenAddress(DAKY_MINT, publicKey);
      const account = await getAccount(connection, ata);
      setWalletBalance((Number(account.amount) / 1_000_000).toLocaleString());
    } catch (e) { setWalletBalance("0"); }

    try {
      const provider = new anchor.AnchorProvider(connection, (window as any).solana, {});
      const program = new anchor.Program(IDL, provider) as any;
      const [userState] = PublicKey.findProgramAddressSync([new TextEncoder().encode("user"), publicKey.toBuffer()], PROGRAM_ID);
      
      const data: any = await program.account.userState.fetch(userState);
      const staked = data.stakedAmount.toNumber() / 1_000_000;
      setStakedBalance(staked.toLocaleString());

      const lastStakeTime = data.lastStakeTime.toNumber();
      const now = Math.floor(Date.now() / 1000);
      const elapsed = Math.max(0, now - lastStakeTime);
      const estimatedReward = staked > 0 ? (elapsed * 0.0001 * staked) : 0;
      setRewardBalance(estimatedReward.toFixed(4));

      const signatures = await connection.getSignaturesForAddress(userState, { limit: 5 });
      const logs: ActivityLog[] = signatures.map(sig => ({
        signature: sig.signature,
        slot: sig.slot,
        blockTime: sig.blockTime || 0,
        status: (sig.err ? 'fail' : 'success') as 'success' | 'fail'
      }));
      setActivities(logs);
    } catch (e) { }
  };

  const handleAction = async () => {
    if (!wallet) return alert("Please connect wallet");
    if (!amount || isNaN(Number(amount))) return alert("Enter amount");
    setIsLoading(true);

    try {
      const provider = new anchor.AnchorProvider(connection, wallet, anchor.AnchorProvider.defaultOptions());
      const program = new anchor.Program(IDL, provider) as any;
      const amountBN = new anchor.BN(Math.floor(parseFloat(amount) * 1_000_000));
      
      const [globalState] = PublicKey.findProgramAddressSync([new TextEncoder().encode("global")], PROGRAM_ID);
      const [userState] = PublicKey.findProgramAddressSync([new TextEncoder().encode("user"), wallet.publicKey.toBuffer()], PROGRAM_ID);

      let tx;
      if (activeTab === 'stake') {
        tx = await program.methods.stake(amountBN).accounts({
            globalState, userState, user: wallet.publicKey, systemProgram: SystemProgram.programId,
          }).rpc();
      } else {
        tx = await program.methods.unstake(amountBN).accounts({
            userState, user: wallet.publicKey,
          }).rpc();
      }
      alert("Success!\nTX: " + tx);
      setAmount("");
      fetchInfo();
    } catch (err: any) {
      console.error(err);
      alert("Error: " + (err.msg || err.message));
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaim = () => alert("Claim function is coming soon!");

  if (!mounted) return null;

  return (
    <main style={{ backgroundColor: '#050505', minHeight: '100vh', fontFamily: '"Inter", sans-serif', color: 'white', overflowX: 'hidden' }}>
      
      {/* Background Ambience */}
      <div className="bg-gradient-purple"></div>
      <div className="bg-gradient-blue"></div>
      <div className="bg-grid"></div>

      {/* --- HERO SECTION --- */}
      <div style={{ zIndex: 1, position: 'relative', width: '100%', maxWidth: '1000px', margin: '0 auto', padding: '60px 20px' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px', animation: 'fadeInDown 0.8s ease-out' }}>
          <h1 style={{ fontSize: '4rem', fontWeight: '800', background: 'linear-gradient(to right, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: '0', letterSpacing: '-0.02em' }}>
            $DAKY <span style={{ color: '#A855F7', WebkitTextFillColor: '#A855F7' }}>VAULT</span>
          </h1>
          <p style={{ color: '#64748b', letterSpacing: '0.3em', fontSize: '0.9rem', marginTop: '10px', textTransform: 'uppercase' }}>Identity to Equity</p>
        </div>

        {/* Dashboard Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px', marginBottom: '80px' }}>
          
          {/* Staking Card */}
          <div className="glass-card">
            <h2 className="card-title">STAKING</h2>
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
                <button key={tab} onClick={() => setActiveTab(tab as any)}
                  className={`tab-btn ${activeTab === tab ? 'active' : ''}`}>
                  {tab.toUpperCase()}
                </button>
              ))}
            </div>
            <div style={{ position: 'relative', marginBottom: '20px' }}>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="input-field" />
              <span className="unit-label">DAKY</span>
            </div>
            <button onClick={handleAction} disabled={isLoading} className={`action-btn ${activeTab}`}>
              {isLoading ? 'PROCESSING...' : (activeTab === 'stake' ? 'STAKE TOKENS' : 'WITHDRAW TOKENS')}
            </button>
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}><WalletMultiButton /></div>
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
                {activities.length === 0 ? <p className="no-activity">No recent activity</p> : activities.map((log, i) => (
                  <div key={i} className="activity-item">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className={`status-dot ${log.status}`}></div>
                      <span className="tx-hash">{log.signature.slice(0, 8)}...</span>
                    </div>
                    <span className="tx-time">{log.blockTime ? new Date(log.blockTime * 1000).toLocaleTimeString() : 'Pending'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* --- SECTIONS BELOW --- */}
      
      {/* 1. VISION (MeFi Concept) */}
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

      {/* ✨ NEW: FOUNDER'S VOICE ✨ */}
      <section style={{ padding: '80px 20px', background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(0,0,0,0) 100%)' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '50px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <div className="founder-image-container">
            {/* ⚠️ publicフォルダに daiki.png を配置してください */}
            <Image src="/daiki.png" alt="Based Dev" width={250} height={250} className="founder-img" />
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

      {/* 2. ROADMAP (Based on Strategy Doc) */}
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

      {/* 3. COMMUNITY & NFT */}
      <section style={{ padding: '80px 20px', background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(168, 85, 247, 0.05) 100%)' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '40px' }}>
          
          {/* NFT Promo */}
          <div className="glass-card promo-card nft-bg">
            <div className="content">
              <h3>Visual Evolution of Credibility</h3>
              <p>Turn your staking rewards into limited edition NFTs. Visualize the core identity etched into the blockchain.</p>
              <button className="promo-btn">VIEW COLLECTION (Coming Soon)</button>
            </div>
          </div>

          {/* Telegram Community */}
          <div className="glass-card promo-card telegram-bg">
            <div className="content">
              <h3>Join the Family</h3>
              <p>Be Honest. Be Kind. Connect with other "Witnesses of Trust" and stay updated with the latest announcements.</p>
              <button className="promo-btn telegram" onClick={() => window.open('https://t.me/DAKY_Official', '_blank')}>
                JOIN TELEGRAM
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 4. TESTIMONIALS (Marquee) */}
      <section style={{ padding: '60px 0', borderTop: '1px solid rgba(255,255,255,0.05)', background: '#000' }}>
        <h3 className="section-title" style={{ textAlign: 'center', marginBottom: '40px' }}>WITNESSES OF TRUST</h3>
        <div className="marquee-container">
          <div className="marquee-content">
            {[...TESTIMONIALS, ...TESTIMONIALS].map((item, i) => (
              <div key={i} className="testimonial-card">
                <p className="comment">"{item.comment}"</p>
                <div className="author">
                  <div className="avatar"></div>
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

      {/* CSS STYLES */}
      <style jsx global>{`
        * { box-sizing: border-box; }
        body { margin: 0; background: #050505; }
        
        /* Typography */
        .section-title { font-size: 0.9rem; letter-spacing: 0.2em; color: #94a3b8; margin-bottom: 20px; font-weight: 700; text-transform: uppercase; }
        .card-title { font-size: 1.1rem; font-weight: 700; margin-bottom: 20px; color: #fff; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 15px; letter-spacing: 0.05em; }
        
        /* Glass Cards */
        .glass-card { padding: 30px; border-radius: 24px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); backdrop-filter: blur(20px); }
        
        /* Founder Section */
        .founder-image-container { position: relative; width: 250px; height: 250px; display: flex; justify-content: center; align-items: center; }
        .founder-img { border-radius: 50%; border: 4px solid rgba(168, 85, 247, 0.5); z-index: 2; object-fit: cover; }
        .founder-glow { position: absolute; width: 100%; height: 100%; background: radial-gradient(circle, rgba(168, 85, 247, 0.4) 0%, transparent 70%); filter: blur(20px); z-index: 1; animation: pulse 3s infinite; }
        @keyframes pulse { 0% { transform: scale(1); opacity: 0.6; } 50% { transform: scale(1.1); opacity: 0.8; } 100% { transform: scale(1); opacity: 0.6; } }

        /* Dashboard Elements */
        .stat-box { background: rgba(0,0,0,0.3); padding: 15px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); }
        .stat-box.active { background: rgba(168, 85, 247, 0.1); border-color: rgba(168, 85, 247, 0.3); }
        .label { color: #94a3b8; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; margin: 0 0 5px 0; }
        .value { color: white; font-size: 1.25rem; font-weight: 700; font-family: monospace; margin: 0; }
        .value.active-text { color: #d8b4fe; }
        .reward-value { font-size: 2.5rem; font-weight: 800; color: #10B981; font-family: monospace; margin: 0; text-shadow: 0 0 20px rgba(16, 185, 129, 0.3); }
        
        /* Inputs & Buttons */
        .tab-btn { flex: 1; padding: 10px; border-radius: 8px; border: none; cursor: pointer; font-weight: 600; background: transparent; color: #64748b; transition: all 0.3s; }
        .tab-btn.active { background: rgba(255,255,255,0.1); color: white; }
        .input-field { width: 100%; padding: 16px; padding-right: 60px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; color: white; font-size: 1.5rem; outline: none; font-family: monospace; }
        .unit-label { position: absolute; right: 20px; top: 22px; color: #64748b; font-weight: bold; font-size: 0.8rem; }
        .action-btn { width: 100%; padding: 18px; border-radius: 16px; border: none; font-weight: 700; cursor: pointer; color: white; transition: transform 0.1s; }
        .action-btn.stake { background: linear-gradient(135deg, #3B82F6, #A855F7); }
        .action-btn.unstake { background: linear-gradient(135deg, #EF4444, #F59E0B); }
        .claim-btn { width: 100%; padding: 14px; border-radius: 12px; border: 1px solid #10B981; background: rgba(16, 185, 129, 0.1); color: #10B981; font-weight: 700; cursor: pointer; transition: all 0.2s; }
        .claim-btn:hover { background: rgba(16, 185, 129, 0.2); }

        /* Activity List */
        .activity-list { display: flex; flex-direction: column; gap: 10px; max-height: 200px; overflow-y: auto; }
        .activity-item { display: flex; justify-content: space-between; align-items: center; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px; }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; }
        .status-dot.success { background: #10B981; }
        .status-dot.fail { background: #EF4444; }
        .tx-hash { font-size: 0.9rem; color: #e2e8f0; font-family: monospace; }
        .tx-time { font-size: 0.8rem; color: #64748b; }
        .no-activity { color: #64748b; text-align: center; font-size: 0.9rem; padding: 20px; }

        /* Roadmap Grid */
        .roadmap-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; }
        .roadmap-card { padding: 30px; border-radius: 16px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); }
        .roadmap-card.done { border-color: #10B981; opacity: 0.6; }
        .roadmap-card.active { border-color: #A855F7; background: rgba(168, 85, 247, 0.05); transform: scale(1.02); box-shadow: 0 0 30px rgba(168, 85, 247, 0.1); }
        .phase { font-size: 0.7rem; font-weight: 700; color: #64748b; letter-spacing: 0.1em; }
        .roadmap-card h4 { margin: 10px 0 20px 0; font-size: 1.1rem; color: #fff; }
        .roadmap-card ul { list-style: none; padding: 0; margin: 0; color: #94a3b8; font-size: 0.9rem; line-height: 1.6; }
        .roadmap-card ul li:before { content: "•"; color: #475569; margin-right: 10px; }

        /* Promo Cards */
        .promo-card { min-height: 250px; display: flex; align-items: center; position: relative; overflow: hidden; transition: transform 0.3s; }
        .promo-card:hover { transform: translateY(-5px); }
        .promo-card .content { position: relative; z-index: 2; }
        .promo-card h3 { font-size: 1.8rem; margin: 0 0 15px 0; color: white; }
        .promo-card p { color: #cbd5e1; margin-bottom: 25px; line-height: 1.5; max-width: 80%; }
        .promo-btn { padding: 12px 24px; border-radius: 8px; border: none; font-weight: 700; cursor: pointer; background: white; color: black; font-size: 0.9rem; }
        .promo-btn.telegram { background: #0088cc; color: white; }

        /* Marquee Animation */
        .marquee-container { width: 100%; overflow: hidden; position: relative; }
        .marquee-content { display: flex; gap: 30px; width: max-content; animation: scroll 40s linear infinite; }
        .testimonial-card { width: 350px; background: rgba(255,255,255,0.03); padding: 25px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); flex-shrink: 0; }
        .comment { color: #e2e8f0; font-size: 1rem; line-height: 1.5; margin-bottom: 20px; font-style: italic; }
        .author { display: flex; align-items: center; gap: 15px; }
        .avatar { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #3B82F6, #A855F7); }
        .name { color: white; font-weight: 700; font-size: 0.9rem; margin: 0; }
        .role { color: #64748b; font-size: 0.8rem; margin: 0; }
        @keyframes scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }

        /* Backgrounds */
        .bg-gradient-purple { position: fixed; top: -20%; left: -10%; width: 600px; height: 600px; background: radial-gradient(circle, rgba(168,85,247,0.15) 0%, rgba(0,0,0,0) 70%); filter: blur(100px); z-index: 0; }
        .bg-gradient-blue { position: fixed; bottom: -20%; right: -10%; width: 500px; height: 500px; background: radial-gradient(circle, rgba(59,130,246,0.15) 0%, rgba(0,0,0,0) 70%); filter: blur(100px); z-index: 0; }
        .bg-grid { position: fixed; width: 100%; height: 100%; background-image: linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px); background-size: 50px 50px; z-index: 0; opacity: 0.3; }

        /* Wallet Adapter Overrides */
        .wallet-adapter-button { background-color: transparent !important; border: 1px solid rgba(255,255,255,0.2) !important; font-family: "Inter", sans-serif !important; height: 40px !important; }
        .wallet-adapter-button:hover { background-color: rgba(255,255,255,0.1) !important; }
      `}</style>
    </main>
  );
}