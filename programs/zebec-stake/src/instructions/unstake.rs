use crate::{
    constants::REWARD_VAULT, error::ZbcnStakeError, events::Unstaked, Lockup, UserStakeData,
    LOCKUP, SECONDS_PER_YEAR, STAKE_VAULT,
};
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{transfer, Mint, Token, TokenAccount, Transfer},
};

#[derive(Accounts)]
#[instruction(_nonce: u64)]
pub struct Unstake<'info> {
    #[account(mut)]
    pub staker: Signer<'info>,
    #[account(mut)]
    pub fee_payer: Signer<'info>,
    #[account(
        mut,
        seeds = [LOCKUP.as_bytes(), lockup.stake_info.name.as_bytes()],
        bump
    )]
    pub lockup: Box<Account<'info, Lockup>>,
    #[account(
        mut,
        seeds = [staker.key().as_ref(), lockup.key().as_ref(), &_nonce.to_le_bytes()],
        bump
    )]
    pub stake_pda: Box<Account<'info, UserStakeData>>,
    pub reward_token: Account<'info, Mint>,
    pub stake_token: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = fee_payer,
        associated_token::mint = stake_token,
        associated_token::authority = staker,
    )]
    pub staker_token_account: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = fee_payer,
        associated_token::mint = reward_token,
        associated_token::authority = staker,
    )]
    pub staker_reward_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [STAKE_VAULT.as_bytes(), lockup.key().as_ref()],
        bump
    )]
    /// CHECK: seeds has been checked
    pub stake_vault: AccountInfo<'info>,
    #[account(
        mut,
        seeds = [REWARD_VAULT.as_bytes(), lockup.key().as_ref()],
        bump
    )]
    /// CHECK: seeds has been checked
    pub reward_vault: AccountInfo<'info>,
    #[account(
        init_if_needed,
        payer = fee_payer,
        associated_token::mint = stake_token,
        associated_token::authority = stake_vault,
    )]
    pub stake_vault_token_account: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = fee_payer,
        associated_token::mint = reward_token,
        associated_token::authority = reward_vault,
    )]
    pub reward_vault_token_account: Account<'info, TokenAccount>,
    #[account(
        constraint = lockup.fee_info.fee_vault == *fee_vault.key,
    )]
    /// CHECK: constraint has been checked
    pub fee_vault: AccountInfo<'info>,
    #[account(
        mut,
        associated_token::mint = stake_token,
        associated_token::authority = lockup.fee_info.fee_vault,
    )]
    pub fee_vault_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Unstake>, _nonce: u64) -> Result<()> {
    let lockup = &ctx.accounts.lockup;
    let stake_pda = &mut ctx.accounts.stake_pda;
    let stake_vault = &ctx.accounts.stake_vault;
    let reward_vault = &ctx.accounts.reward_vault;
    let token_program = &ctx.accounts.token_program;
    let reward_token = &ctx.accounts.reward_token;
    let stake_token = &ctx.accounts.stake_token;
    let fee_vault_token_account = &ctx.accounts.fee_vault_token_account;
    let current_time = Clock::get()?.unix_timestamp;
    let duration = stake_pda.lock_period;

    run_validations(
        reward_token.key(),
        stake_token.key(),
        &lockup,
        &stake_pda,
        current_time,
    )?;

    let annual_reward_rate =
        lockup.get_reward_for_duration(duration as u64).unwrap() as f64 / 10000.0;
    let total_reward_amount = stake_pda.staked_amount as f64
        * (annual_reward_rate / SECONDS_PER_YEAR)
        * (stake_pda.lock_period as f64);

    if total_reward_amount as u64 == 0 {
        return Err(ZbcnStakeError::RewardIsZero.into());
    }

    let staker_reward_token_account = &ctx.accounts.staker_reward_token_account;
    let reward_vault_token_account = &ctx.accounts.reward_vault_token_account;

    let lockup_key = lockup.key();
    let (_, bump_seed) = Pubkey::find_program_address(
        &[REWARD_VAULT.as_bytes(), lockup_key.as_ref()],
        ctx.program_id,
    );
    let reward_vault_seed: &[&[&[_]]] =
        &[&[REWARD_VAULT.as_bytes(), lockup_key.as_ref(), &[bump_seed]]];
    let trns_spl: Transfer<'_> = Transfer {
        from: reward_vault_token_account.to_account_info(),
        to: staker_reward_token_account.to_account_info(),
        authority: reward_vault.to_account_info(),
    };
    let ctx_spl: CpiContext<'_, '_, '_, '_, _> =
        CpiContext::new_with_signer(token_program.to_account_info(), trns_spl, reward_vault_seed);
    transfer(ctx_spl, total_reward_amount as u64)?;

    let fee_amount = (stake_pda.staked_amount * lockup.fee_info.fee) / 1000;
    let unstake_amount = stake_pda.staked_amount - fee_amount;

    let staker_stake_token_account = &ctx.accounts.staker_token_account;
    let stake_vault_token_account = &ctx.accounts.stake_vault_token_account;

    let lockup_key = lockup.key();
    let (_, bump_seed) = Pubkey::find_program_address(
        &[STAKE_VAULT.as_bytes(), lockup_key.as_ref()],
        ctx.program_id,
    );
    let lockup_vault_seed: &[&[&[_]]] =
        &[&[STAKE_VAULT.as_bytes(), lockup_key.as_ref(), &[bump_seed]]];

    // Unstake
    let unstake = Transfer {
        from: stake_vault_token_account.to_account_info(),
        to: staker_stake_token_account.to_account_info(),
        authority: stake_vault.to_account_info(),
    };
    let ctx_unstake: CpiContext<'_, '_, '_, '_, _> =
        CpiContext::new_with_signer(token_program.to_account_info(), unstake, lockup_vault_seed);

    transfer(ctx_unstake, unstake_amount)?;

    // Transfer Fee
    let transfer_fee = Transfer {
        from: stake_vault_token_account.to_account_info(),
        to: fee_vault_token_account.to_account_info(),
        authority: stake_vault.to_account_info(),
    };
    let ctx_transfer_fee: CpiContext<'_, '_, '_, '_, _> = CpiContext::new_with_signer(
        token_program.to_account_info(),
        transfer_fee,
        lockup_vault_seed,
    );
    transfer(ctx_transfer_fee, fee_amount)?;

    stake_pda.reward_amount = total_reward_amount as u64;
    stake_pda.stake_claimed = true;

    emit!(Unstaked {
        staker: stake_pda.staker,
        unstake_amount: unstake_amount,
        reward_amount: stake_pda.reward_amount,
        lock_period: stake_pda.lock_period,
    });

    Ok(())
}

fn run_validations(
    reward_token: Pubkey,
    stake_token: Pubkey,
    lockup: &Lockup,
    stake_pda: &UserStakeData,
    current_time: i64,
) -> Result<()> {
    if stake_pda.stake_claimed {
        return Err(ZbcnStakeError::RewardAlreadyClaimed.into());
    }

    require!(
        reward_token == lockup.reward_token.token_address,
        ZbcnStakeError::InvalidRewardToken
    );

    require!(
        stake_token == lockup.staked_token.token_address,
        ZbcnStakeError::InvalidStakeToken
    );

    require!(
        current_time > (stake_pda.created_time + stake_pda.lock_period),
        ZbcnStakeError::StakeRewardNotClaimable
    );

    Ok(())
}
