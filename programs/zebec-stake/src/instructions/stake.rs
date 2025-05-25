use crate::{error::ZbcnStakeError, state::UserNonce, Lockup, UserStakeData, LOCKUP, STAKE_VAULT};
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{transfer, Mint, Token, TokenAccount, Transfer},
};

#[derive(Accounts)]
#[instruction(args: StakeParams)]
pub struct Stake<'info> {
    #[account(mut)]
    pub staker: Signer<'info>,
    #[account(
        mut,
        seeds =[LOCKUP.as_bytes(), lockup.stake_info.name.as_bytes()],
        bump
    )]
    pub lockup: Account<'info, Lockup>,
    #[account(
        init_if_needed,
        payer = staker,
        space = 8 + UserStakeData::INIT_SPACE,
        seeds = [staker.key().as_ref(), lockup.key().as_ref(), args.nonce.to_le_bytes().as_ref()],
        bump
    )]
    pub stake_pda: Box<Account<'info, UserStakeData>>,
    #[account(
        init_if_needed,
        payer = staker,
        space = 8 + UserNonce::INIT_SPACE,
        seeds = [staker.key().as_ref(), lockup.key().as_ref()],
        bump
    )]
    pub user_nonce: Box<Account<'info, UserNonce>>,
    pub stake_token: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = stake_token,
        associated_token::authority = staker,
    )]
    pub staker_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [STAKE_VAULT.as_bytes(), lockup.key().as_ref()],
        bump
    )]
    /// CHECK: seeds has been checked
    pub stake_vault: AccountInfo<'info>,
    #[account(
        init_if_needed,
        payer = staker,
        associated_token::mint = stake_token,
        associated_token::authority = stake_vault,
    )]
    pub stake_vault_token_account: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct StakeParams {
    pub amount: u64,
    pub lock_period: i64,
    pub nonce: u64,
}

pub fn handler(ctx: Context<Stake>, params: StakeParams) -> Result<()> {
    let stake_pda = &mut ctx.accounts.stake_pda;
    let lockup = &mut ctx.accounts.lockup;
    let staker = &ctx.accounts.staker;
    let staker_stake_token_account = &ctx.accounts.staker_token_account;
    let stake_vault_token_account = &ctx.accounts.stake_vault_token_account;
    let token_program = &ctx.accounts.token_program;
    let current_time = Clock::get()?.unix_timestamp;
    let stake_token = &ctx.accounts.stake_token;
    let user_nonce = &mut ctx.accounts.user_nonce;

    if user_nonce.nonce != params.nonce {
        return Err(ZbcnStakeError::InvaildNonce.into());
    }

    run_validations(stake_token.key(), lockup)?;

    let trns_spl = Transfer {
        from: staker_stake_token_account.to_account_info(),
        to: stake_vault_token_account.to_account_info(),
        authority: staker.to_account_info(),
    };
    let ctx_spl: CpiContext<'_, '_, '_, '_, _> =
        CpiContext::new(token_program.to_account_info(), trns_spl);

    transfer(ctx_spl, params.amount)?;

    stake_pda.staked_amount += params.amount;
    lockup.staked_token.total_staked += params.amount;
    stake_pda.created_time = current_time;
    stake_pda.nonce = params.nonce;
    stake_pda.lock_period = params.lock_period;
    user_nonce.nonce += 1;

    Ok(())
}

fn run_validations(stake_token: Pubkey, lockup: &Lockup) -> Result<()> {
    require!(
        stake_token == lockup.staked_token.token_address,
        ZbcnStakeError::InvalidStakeToken
    );
    Ok(())
}
