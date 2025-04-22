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
pub mod zebec_stake {
    use super::*;

    pub fn init_lockup(ctx: Context<InitLockup>, params: InitConfigParams) -> Result<()> {
        init_lockup::handler(ctx, params)
    }

    pub fn stake_zbcn(ctx: Context<Stake>, params: StakeParams) -> Result<()> {
        stake::handler(ctx, params)
    }

    pub fn unstake_zbcn(ctx: Context<Unstake>, nonce: u64) -> Result<()> {
        unstake::handler(ctx, nonce)
    }
}
