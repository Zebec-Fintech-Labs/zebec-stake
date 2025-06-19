use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token},
};
use crate::{
    constants::REWARD_VAULT, 
    events::LockupInitialized,
    InitConfigParams, 
    Lockup, 
    LOCKUP, 
    STAKE_VAULT
};

#[derive(Accounts)]
#[instruction(args: InitConfigParams)]
pub struct InitLockup<'info> {
    #[account(mut)]
    creator: Signer<'info>,
    #[account(
        init,
        payer = creator,
        space = 8 + Lockup::INIT_SPACE,
        seeds = [LOCKUP.as_bytes(), args.name.as_bytes()],
        bump
    )]
    pub lockup: Box<Account<'info, Lockup>>,
    #[account(
        init,
        payer = creator,
        space = 0,
        seeds = [STAKE_VAULT.as_bytes(), lockup.key().as_ref()],
        bump
    )]
    /// CHECK: seeds has been checked
    pub stake_vault: AccountInfo<'info>,
    #[account(
        init,
        payer = creator,
        space = 0,
        seeds = [REWARD_VAULT.as_bytes(), lockup.key().as_ref()],
        bump
    )]
    /// CHECK: seeds has been checked
    pub reward_vault: AccountInfo<'info>,
    pub stake_token: Account<'info, Mint>,
    pub reward_token: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(ctx: Context<InitLockup>, params: InitConfigParams) -> Result<()> {
    let lockup = &mut ctx.accounts.lockup;
    let creator: Pubkey = ctx.accounts.creator.key();
    let reward_token = ctx.accounts.reward_token.key();
    let staked_token = ctx.accounts.stake_token.key();
    let reward_vault = &ctx.accounts.reward_vault;
    lockup.init(params, creator, reward_token, staked_token)?;

    emit!(LockupInitialized {
        name: lockup.stake_info.name.clone(),
        creator,
        lockup: lockup.key(),
        fee_vault: lockup.fee_info.fee_vault,
        reward_vault: reward_vault.key(),
        duration_map: lockup.stake_info.duration_map.clone(),
    });

    Ok(())
}
