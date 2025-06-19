use anchor_lang::prelude::*;
use crate::state::DurationMap;

#[event]
pub struct LockupInitialized {
    pub name: String,
    pub creator: Pubkey,
    pub lockup: Pubkey,
    pub fee_vault: Pubkey,
    pub reward_vault: Pubkey,
    pub duration_map: Vec<DurationMap>,
}

#[event]
pub struct Staked {
    pub staker: Pubkey,
    pub stake_amount: u64,
    pub nonce: u64,
    pub lock_period: i64,
}

#[event]
pub struct Unstaked {
    pub staker: Pubkey,
    pub unstake_amount: u64,
    pub reward_amount: u64,
    pub lock_period: i64,
}

#[event]
pub struct StakerWhitelisted {
    pub staker: Pubkey,
    pub amount: u64,
    pub nonce: u64,
    pub lock_period: i64,
    pub claimed: bool,
    pub created_time: i64,
}