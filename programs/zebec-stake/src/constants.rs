use anchor_lang::prelude::*;

#[constant]
pub const LOCKUP: &str = "zebec_lockup";

#[constant]
pub const STAKE_VAULT: &str = "stake_vault";

#[constant]
pub const REWARD_VAULT: &str = "reward_vault";

pub const SECONDS_PER_YEAR: f64 = 365.0 * 24.0 * 60.0 * 60.0;
