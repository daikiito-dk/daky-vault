export {};
import { DAILY_REWARD_RATE, APR } from './constants';

/**
 * 大きな数字を読みやすくフォーマット (例: 1,500,000 → "1.5M")
 */
export function formatLargeNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(2) + 'B';
  }
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(2) + 'M';
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(2) + 'K';
  }
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/**
 * 残り時間をフォーマット (例: 432000秒 → "5d 0h")
 */
export function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return "Ready";
  
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * 予想報酬を計算
 */
export function calculateEstimatedRewards(stakedAmount: number) {
  const daily = stakedAmount * DAILY_REWARD_RATE;
  const weekly = daily * 7;
  const monthly = daily * 30;
  const yearly = stakedAmount * (APR / 100);
  
  return { daily, weekly, monthly, yearly };
}

/**
 * フォーマットされた残高文字列から数値に戻す
 * 例: "1.5M" → 1500000
 */
export function parseFormattedBalance(formattedBalance: string): number {
  const cleanStr = formattedBalance.replace(/,/g, '');
  
  if (cleanStr.includes('B')) {
    return parseFloat(cleanStr.replace('B', '')) * 1_000_000_000;
  }
  if (cleanStr.includes('M')) {
    return parseFloat(cleanStr.replace('M', '')) * 1_000_000;
  }
  if (cleanStr.includes('K')) {
    return parseFloat(cleanStr.replace('K', '')) * 1_000;
  }
  
  return parseFloat(cleanStr);
}