use anchor_lang::prelude::*;

#[account]
#[derive(Default, InitSpace)]
pub struct UserStakeData {
    pub nonce: u64,
    pub staker: Pubkey,
    pub created_time: i64,
    pub staked_amount: u64,
    pub reward_amount: u64,
    pub reward_claimed: bool,
    pub stake_claimed: bool,
    pub lock_period: i64,
}

#[account]
#[derive(Default, InitSpace)]
pub struct UserNonce {
    pub nonce: u64,
}

impl UserStakeData {
    pub fn is_ended(&self) -> Result<bool> {
        let current_time = Clock::get()?.unix_timestamp;
        Ok(self.lock_period * 86400 + self.created_time < current_time)
    }
}

impl UserNonce {
    pub fn get_nonce(&self) -> u64 {
        return self.nonce;
    }
}
