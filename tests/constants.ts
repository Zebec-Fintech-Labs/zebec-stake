import * as anchor from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';

export const SEEDS = {
	lockup: "zebec_lockup",
	stakeVault: "stake_vault",
	rewardVault: "reward_vault",
};

export type DurationMap = {
    duration: anchor.BN;
    reward: anchor.BN;
  }
  
export type InitConfigParams = {
    name: string;
    fee: anchor.BN;
    feeVault: PublicKey;
    durationMap: DurationMap[];
    minimumStake: anchor.BN;
  };

export const rewardSchemes: DurationMap[] = [
    {
        duration: new anchor.BN(2592000), // 30 days
        reward: new anchor.BN(800), // 8%
    },
    {
        duration: new anchor.BN(7776000), // 90 days
        reward: new anchor.BN(1200), // 12%
    },
    {
        duration: new anchor.BN(10368000), // 120 days
        reward: new anchor.BN(1500), // 15%
    },
];

// export const FEE_VAULT =  new PublicKey("2Nz9xczcGaWvu5pZNzzXundLEdP5tf2aCAoWy4CGrjxD")