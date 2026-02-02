import type { EstimatedRewards } from '../lib/types';

interface RewardPreviewProps {
  rewards: EstimatedRewards;
}

export const RewardPreview = ({ rewards }: RewardPreviewProps) => {
  return (
    <div>
      <h3>Reward Preview</h3>
      <p>Daily: {rewards.daily}</p>
      <p>Weekly: {rewards.weekly}</p>
      <p>Monthly: {rewards.monthly}</p>
      <p>Yearly: {rewards.yearly}</p>
    </div>
  );
};