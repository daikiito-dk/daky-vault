interface LockStatusProps {
  canUnstake: boolean;
  lockTimeRemaining: number;
}

export const LockStatus = ({ canUnstake, lockTimeRemaining }: LockStatusProps) => {
  return (
    <div>
      <h3>Lock Status</h3>
      <p>Can Unstake: {canUnstake ? 'Yes' : 'No'}</p>
      <p>Time Remaining: {lockTimeRemaining} seconds</p>
    </div>
  );
};