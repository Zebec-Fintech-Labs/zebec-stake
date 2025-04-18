use anchor_lang::prelude::*;

#[error_code]
pub enum ZbcnStakeError {
    #[msg("Invalid time")]
    InvalidTime,
    #[msg("Invalid stake token")]
    InvalidStakeToken,
    #[msg("Invalid reward token")]
    InvalidRewardToken,
    #[msg("Invalid stake Period")]
    InvalidStakePeriod,
    #[msg("Invalid staker")]
    InvalidStaker,
    #[msg("Invalid nonce")]
    InvaildNonce,

    RewardAlreadyClaimed,
    StakeRewardNotClaimable,
    RewardIsZero,
}

#[error_code]
pub enum ZbcnUnstakeError {
    #[msg("Stake Already Claimed")]
    StakeAlreadyClaimed,
    #[msg("Stake Not Claimable")]
    StakeNotClaimable,
}
