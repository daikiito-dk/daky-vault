import * as anchor from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';

export type ActivityLog = {
  signature: string;
  slot: number;
  blockTime: number;
  status: 'success' | 'fail';
};

export type GlobalStateAccount = {
  maxStake: anchor.BN;
  rewardRate: anchor.BN;
};

export type UserStateAccount = {
  stakedAmount: anchor.BN;
  lastStakeTime: anchor.BN;
};

export interface DakyProgram extends anchor.Program {
  account: {
    globalState: {
      fetch: (address: PublicKey) => Promise<GlobalStateAccount>;
    };
    userState: {
      fetch: (address: PublicKey) => Promise<UserStateAccount>;
    };
  };
}

export type EstimatedRewards = {
  daily: number;
  weekly: number;
  monthly: number;
  yearly: number;
};

export type Testimonial = {
  name: string;
  role: string;
  comment: string;
};