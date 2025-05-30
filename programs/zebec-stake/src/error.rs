use anchor_lang::prelude::*;

#[error_code]
pub enum ZbcnStakeError {
    #[msg("Invalid Time")]
    InvalidTime,
    #[msg("Invalid Stake Token")]
    InvalidStakeToken,
    #[msg("Invalid Reward Token")]
    InvalidRewardToken,
    #[msg("Invalid Stake Period")]
    InvalidStakePeriod,
    #[msg("Invalid Staker")]
    InvalidStaker,
    #[msg("Invalid Nonce")]
    InvaildNonce,
    #[msg("UnAuthorized")]
    UnAuthorized,
    #[msg("Invalid Lock Period")]
    InvalidLockPeriod,
    #[msg("Invalid Amount")]
    InvalidAmount,
    #[msg("Reward Already Claimed")]
    RewardAlreadyClaimed,
    #[msg("Stake Reward Not Claimable")]
    StakeRewardNotClaimable,
    #[msg("Reward Is Zero")]
    RewardIsZero,
    #[msg("Stake Already Claimed")]
    StakeAlreadyClaimed,
    #[msg("Stake Not Claimable")]
    StakeNotClaimable,
    #[msg("Minimum Stake Not Met")]
    MinimumStakeNotMet
}
