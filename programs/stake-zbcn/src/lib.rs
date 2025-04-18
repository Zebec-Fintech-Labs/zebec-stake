mod constants;
mod error;
mod instructions;
mod state;

use anchor_lang::prelude::*;
use constants::*;
use instructions::*;
use state::*;

declare_id!("6S5tbu8jPJKFvpBMjaMPQbcwcrw8iHcuGnXH8ZwHgwaE");

#[program]
pub mod stake_zbcn {
    use super::*;

    pub fn init_lockup(ctx: Context<InitLockup>, params: InitConfigParams) -> Result<()> {
        init_lockup::handler(ctx, params)
    }

    pub fn stake_zbcn(ctx: Context<Stake>, params: StakeParams) -> Result<()> {
        stake::handler(ctx, params)
    }

    pub fn unstake_zbcn(ctx: Context<UnStake>) -> Result<()> {
        unstake::handler(ctx)
    }

    pub fn claim_reward(ctx: Context<ClaimReward>) -> Result<()> {
        claim_reward::handler(ctx)
    }
}
