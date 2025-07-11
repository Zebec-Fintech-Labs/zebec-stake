mod constants;
mod error;
mod instructions;
mod state;
mod events;

use anchor_lang::prelude::*;
use constants::*;
use instructions::*;
use state::*;

declare_id!("zSTKzGLiN6T6EVzhBiL6sjULXMahDavAS2p4R62afGv");

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

    pub fn whitelist_staker(
        ctx: Context<WhitelistStaker>,
        params: WhitelistStakerParams,
    ) -> Result<()> {
        whitelist_staker::handler(ctx, params)
    }
}
