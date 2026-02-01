import { PublicKey } from '@solana/web3.js';
import { clusterApiUrl } from '@solana/web3.js';

// --- Program Configuration ---
export const PROGRAM_ID = new PublicKey("6SVBFPT8bLcbp8eDud9ECSoVYJhzmXxgHm9iU5FviKAs");
export const DAKY_MINT = new PublicKey("CzLeDd7qrK8Y4XREpsb4uc5xVX9ktYcryGw3zXRSpump");
export const RPC_ENDPOINT = clusterApiUrl('devnet');

// --- Token Configuration ---
export const DECIMALS = 6;
export const FETCH_INTERVAL = 15000; // 15 seconds

// --- Reward Configuration ---
export const DAILY_REWARD_RATE = 0.00015;  // 0.015% per day
export const APR = 5.48;  // Annual Percentage Rate
export const MIN_LOCK_DAYS = 7;
export const MIN_LOCK_SECONDS = 604800;  // 7 days in seconds

// --- Testimonials ---
export const TESTIMONIALS = [
  { 
    name: "Early_Witness", 
    role: "Holder", 
    comment: "This isn't just a token, it's a social experiment. 'MeFi' is the next big narrative." 
  },
  { 
    name: "Destinx", 
    role: "Right Hand", 
    comment: "We value long-term vision over short-term hype. The team is always cooking." 
  },
  { 
    name: "Based_Dev", 
    role: "Founder", 
    comment: "Be Honest. Be Kind. Trust is the ultimate currency." 
  },
  { 
    name: "Solana_Whale", 
    role: "Investor", 
    comment: "The concept of 'Identity to Equity' is fascinating. Finally, a project with a real face." 
  },
  { 
    name: "Community_Member", 
    role: "Witness", 
    comment: "From digital inscription to physical reality. Watching this evolution is incredible." 
  },
];