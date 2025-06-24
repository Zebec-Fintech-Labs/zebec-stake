# ZEBEC STAKE

Zebec Stake is a staking program built on the Solana blockchain. It enables users to lock (stake) their $ZBCN tokens for a predefined period to earn rewards. The contract also includes administrative controls for defining staking configurations.

Zebec Stake is a module in the Zebec ecosystem that allows:
- Locking $ZBCN tokens for a specific duration.
- Enforcing minimum staking requirements.
- Customizing reward configurations based on lock durations.
- Implementing protocol-level staking fees.

## Prerequisites

Ensure you have the following installed:

- [Rust](https://www.rust-lang.org/tools/install)
- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools)
- [Anchor CLI](https://project-serum.github.io/anchor/getting-started/installation.html)
- Node.js (with npm)

## Installation

1. **Clone the repository:**
   ```sh
   git clone https://github.com/Zebec-Fintech-Labs/zebec-stake.git
   cd zebec-stake
   ```

2. **Build the program:**
   ```sh
   anchor build
   ```

3. **Deploy the program to the Solana cluster:**
   ```sh
   anchor deploy --url <cluster>
   ```

4. **Install the necessary Node.js dependencies for testing:**
   ```sh
   npm install
   ```

## Available Instructions

- ### 1) **_init_lockup():_** <br>

  Used by the admin to initialize the staking configuration.

  ### Parameters:
  - `name` : `String`
    - Name for the lockup.

  - `fee` : `u64`
    - Fee in lamports per stake.

  - `fee_vault` : `Pubkey`
    - Fee destination account.

  - `minimum_stake` : `u64`
    - Minimum stake amount in tokens.

  - `duration_map` : `Vec<DurationMap>`
    - Allowed staking durations and their rewards.

  ```rust
  pub struct InitConfigParams {
    pub name: String,
    pub fee: u64,
    pub fee_vault: Pubkey,
    pub minimum_stake: u64,
    pub duration_map: Vec<DurationMap>,
  }

  pub fn init_lockup(ctx: Context<InitLockup>, params: InitConfigParams) -> Result<()> {
        init_lockup::handler(ctx, params)
    }
  ```

- ### 2) **_stake_zbcn():_** <br>

  Allows a user to stake their $ZBCN tokens.

  ### Parameters:
  - `amount` : `u64`
    - Amount to stake.

  - `lock_period` : `i64`
    - Duration in seconds for which tokens are locked.

  - `nonce` : `u64`
    - Unique identifier for this stake.

  ```rust
  pub struct StakeParams {
    pub amount: u64,
    pub lock_period: i64,
    pub nonce: u64,
  }

  pub fn stake_zbcn(ctx: Context<Stake>, params: StakeParams) -> Result<()> {
        stake::handler(ctx, params)
  }
  ```

- ### 3) **_unstake_zbcn():_** <br>

  Allows a user to withdraw their tokens as well as the reward earned, after the lock period.

  ### Parameters:
  - `nonce` : `u64`
    - The identifier for the specific stake to be released.

  ```rust
  pub fn unstake_zbcn(ctx: Context<Unstake>, nonce: u64) -> Result<()> {
        unstake::handler(ctx, nonce)
  }
  ```

  ## Testing
  This repo also includes a comprehensive test suite written using Anchor, Mocha, and Bankrun, designed to verify all core contract behaviors, including happy-path flows and critical edge cases.

  **Run The Test**
  ```sh
  anchor run stake
  ```
  <sub>Note: Ensure your local Anchor environment is set up and that you have the necessary dev dependencies installed (e.g., @coral-xyz/anchor, solana-bankrun, anchor-bankrun, chai, etc.).</sub>

  The test script covers:
  - ✅ **Positive Scenarios**
    - **Stake Configuration Initialization<br>**
      Initializes staking configuration using *init_lockup* with a duration map, fee vault, and minimum stake.
    
    - **Stake + Unstake Happy Path<br>**
      Stake some $ZBCN for certain allowed duration with respective APY for that duration and validate correct reward and fee application.

  - 🚫 **Edge Case Coverage**
    Test Description | Validation
    --- | ---
    *Stake with 0 ZBCN* | Rejects and throws `InvalidStakeAmount`
    *Unstake before lockup expiry* | Fails with `StakeRewardNotClaimable`
    *Stake below minimum threshold* | Throws `MinimumStakeNotMet`
    *Double unstaking (replay attack)* | Throws `RewardAlreadyClaimed`
    *Unstaking with unsupported duration* | Throws `StakeRewardNotClaimable`

  These tests ensure that:
  - Only valid staking durations (from duration_map) are accepted.
  - Minimum stake enforcement is strict.
  - Stake rewards are only claimable after the lockup period.
  - Rewards are only claimable once.
