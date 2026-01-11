use crate::{
    constants::LOCKUP, Lockup, UpdateLockupParams, events::LockupUpdated,
    error::ZbcnStakeError,
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(args: UpdateLockupParams)]
pub struct UpdateLockup<'info> {
    #[account(mut)]
    pub updater: Signer<'info>,
    #[account(
        mut,
        seeds = [LOCKUP.as_bytes(), lockup.stake_info.name.as_bytes()],
        bump
    )]
    pub lockup: Box<Account<'info, Lockup>>,
}

pub fn handler(ctx: Context<UpdateLockup>, params: UpdateLockupParams) -> Result<()> {
    let lockup = &mut ctx.accounts.lockup;

    // Validate updater is the lockup creator
    require!(lockup.stake_info.creator == ctx.accounts.updater.key(), ZbcnStakeError::UnAuthorized);

    lockup.stake_info.minimum_stake = params.minimum_stake;
    lockup.fee_info.fee = params.fee;
    lockup.fee_info.fee_vault = params.fee_vault;
    lockup.stake_info.duration_map = params.duration_map;

    emit!(LockupUpdated {
        fee: lockup.fee_info.fee,
        fee_vault: lockup.fee_info.fee_vault,
        minimum_stake: lockup.stake_info.minimum_stake,
        duration_map: lockup.stake_info.duration_map.clone(),
    });

    Ok(())
}