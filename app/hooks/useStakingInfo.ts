import { useState, useEffect, useMemo } from 'react';
import { useWallet, useAnchorWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Connection } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import * as anchor from '@coral-xyz/anchor';
import { PROGRAM_ID, DAKY_MINT, RPC_ENDPOINT, DECIMALS, FETCH_INTERVAL, DAILY_REWARD_RATE } from '@/lib/constants';
import { IDL } from '@/lib/idl';
import { formatLargeNumber } from '@/lib/utils';
import type { ActivityLog, DakyProgram } from '@/lib/types';

export function useStakingInfo() {
  const { publicKey } = useWallet();
  const wallet = useAnchorWallet();
  const connection = useMemo(() => new Connection(RPC_ENDPOINT, 'confirmed'), []);

  const [walletBalance, setWalletBalance] = useState<string>("0");
  const [stakedBalance, setStakedBalance] = useState<string>("0");
  const [rewardBalance, setRewardBalance] = useState<string>("0.0000");
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [rewardRate, setRewardRate] = useState<number>(DAILY_REWARD_RATE);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);

  const fetchInfo = async () => {
    if (!publicKey || !wallet) return;
    setIsFetching(true);
    setErrorMessage("");

    try {
      // ウォレット残高の取得
      try {
        const ata = await getAssociatedTokenAddress(DAKY_MINT, publicKey);
        const account = await getAccount(connection, ata);
        setWalletBalance(formatLargeNumber(Number(account.amount) / Math.pow(10, DECIMALS)));
      } catch (e) {
        console.warn("Failed to fetch wallet balance:", e);
        setWalletBalance("0");
      }

      // プログラムデータの取得
      try {
        const provider = new anchor.AnchorProvider(
          connection, 
          wallet, 
          anchor.AnchorProvider.defaultOptions()
        );
        const program = new anchor.Program(IDL, provider) as unknown as DakyProgram;
        
        const [globalState] = PublicKey.findProgramAddressSync(
          [new TextEncoder().encode("global")], 
          PROGRAM_ID
        );
        
        try {
          const globalData = await program.account.globalState.fetch(globalState);
          setRewardRate(Number(globalData.rewardRate.toString()) / Math.pow(10, DECIMALS));
        } catch (e) {
          console.warn("GlobalState not found");
        }

        const [userState] = PublicKey.findProgramAddressSync(
          [new TextEncoder().encode("user"), publicKey.toBuffer()], 
          PROGRAM_ID
        );
        
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

  useEffect(() => {
    if (!publicKey || !wallet) return;
    fetchInfo();
    const interval = setInterval(fetchInfo, FETCH_INTERVAL);
    return () => clearInterval(interval);
  }, [publicKey, wallet]);

  return {
    walletBalance,
    stakedBalance,
    rewardBalance,
    activities,
    isFetching,
    errorMessage,
    rewardRate,
    lastUpdateTime,
    refetch: fetchInfo,
  };
}