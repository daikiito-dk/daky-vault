export {};
import { useState, useEffect } from 'react';
import { MIN_LOCK_SECONDS } from '@/lib/constants';

export function useLockTimer(lastUpdateTime: number) {
  const [lockTimeRemaining, setLockTimeRemaining] = useState<number>(0);
  const [canUnstake, setCanUnstake] = useState<boolean>(true);

  useEffect(() => {
    if (!lastUpdateTime || lastUpdateTime === 0) {
      setCanUnstake(true);
      setLockTimeRemaining(0);
      return;
    }
    
    const interval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const lockEndTime = lastUpdateTime + MIN_LOCK_SECONDS;
      const remaining = Math.max(0, lockEndTime - now);
      
      setLockTimeRemaining(remaining);
      setCanUnstake(remaining === 0);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [lastUpdateTime]);

  return { lockTimeRemaining, canUnstake };
}