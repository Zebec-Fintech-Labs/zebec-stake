use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

use crate::{
    error::ZbcnStakeError,
    LOCKUP,
    state::{Lockup, UserNonce, UserStakeData},
};

#[derive(Accounts)]
#[instruction(args: WhitelistStakerParams)]
pub struct WhitelistStaker<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        mut,
        seeds = [LOCKUP.as_bytes(), lockup.stake_info.name.as_bytes()],
        bump
    )]
    pub lockup: Account<'info, Lockup>,
    #[account(
        init_if_needed,
        payer = admin,
        space = 8 + UserNonce::INIT_SPACE,
        seeds = [staker.key().as_ref(), lockup.key().as_ref()],
        bump
    )]
    pub user_nonce: Box<Account<'info, UserNonce>>,
    /// CHECK:
    pub staker: AccountInfo<'info>,
    #[account(
        init_if_needed,
        payer = admin,
        space = 8 + UserStakeData::INIT_SPACE,
        seeds = [staker.key().as_ref(), lockup.key().as_ref(), args.nonce.to_le_bytes().as_ref()],
        bump
    )]
    pub stake_pda: Box<Account<'info, UserStakeData>>,
    pub stake_token: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct WhitelistStakerParams {
    pub amount: u64,
    pub nonce: u64,
    pub lock_period: i64,
    pub created_time: i64,
    pub claimed: bool,
}

pub fn handler(ctx: Context<WhitelistStaker>, params: WhitelistStakerParams) -> Result<()> {
    let lockup = &mut ctx.accounts.lockup;
    let stake_pda = &mut ctx.accounts.stake_pda;
    let user_nonce = &mut ctx.accounts.user_nonce;
    let admin = &ctx.accounts.admin;
    let stake_token = &ctx.accounts.stake_token;

    run_validations(stake_token.key(), lockup, user_nonce, &params, admin.key())?;

    stake_pda.staked_amount += params.amount;
    lockup.staked_token.total_staked += params.amount;
    stake_pda.created_time = params.created_time;
    stake_pda.nonce = params.nonce;
    stake_pda.lock_period = params.lock_period;
    stake_pda.stake_claimed = params.claimed;
    user_nonce.nonce += 1;
    Ok(())
}

fn run_validations(
    stake_token: Pubkey,
    lockup: &Lockup,
    user_nonce: &UserNonce,
    params: &WhitelistStakerParams,
    admin: Pubkey,
) -> Result<()> {
    require!(
        stake_token == lockup.staked_token.token_address,
        ZbcnStakeError::InvalidStakeToken
    );

    require!(
        lockup.stake_info.creator == admin,
        ZbcnStakeError::UnAuthorized
    );

    require!(params.lock_period > 0, ZbcnStakeError::InvalidLockPeriod);

    require!(params.amount > 0, ZbcnStakeError::InvalidAmount);

    require!(
        user_nonce.nonce == params.nonce,
        ZbcnStakeError::InvaildNonce
    );
    Ok(())
}
