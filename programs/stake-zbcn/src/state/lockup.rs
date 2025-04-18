use anchor_lang::prelude::*;

#[account]
#[derive(Default, InitSpace)]
pub struct Lockup {
    pub stake_info: StakeInfo,
    pub reward_token: RewardToken,
    pub staked_token: StakedToken,
    pub fee_info: FeeInfo,
}

#[derive(Default, AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct StakeInfo {
    #[max_len(30)]
    pub name: String,
    pub creator: Pubkey,
    #[max_len(250)]
    duration_map: Vec<DurationMap>,
}

#[derive(InitSpace, Clone, AnchorDeserialize, AnchorSerialize)]
pub struct DurationMap {
    pub duration: u64,
    pub reward: u64,
}

#[derive(Default, AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct RewardToken {
    pub token_address: Pubkey,
}

#[derive(Default, AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct StakedToken {
    pub token_address: Pubkey,
    pub total_staked: u64,
}

#[derive(Default, AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct FeeInfo {
    pub fee: u64,
    pub fee_vault: Pubkey,
}

#[account(AnchorSerialize, AnchorDeserialize)]
pub struct InitConfigParams {
    pub name: String,
    pub lock_period: i64,
    pub staking_end_time: i64,
    pub staking_start_time: i64,
    pub fee: u64,
    pub fee_vault: Pubkey,
    pub duration_map: Vec<DurationMap>,
}

impl DurationMap {
    fn new(duration: u64, reward: u64) -> Self {
        Self { duration, reward }
    }
}
impl Lockup {
    pub fn init(
        &mut self,
        params: InitConfigParams,
        creator: Pubkey,
        reward_token: Pubkey,
        staked_token: Pubkey,
    ) -> std::result::Result<(), anchor_lang::error::Error> {
        *self = Self::default();
        self.stake_info.name = params.name;
        self.stake_info.creator = creator;

        self.reward_token.token_address = reward_token;

        self.staked_token.total_staked = 0;
        self.staked_token.token_address = staked_token;

        self.fee_info.fee = params.fee;
        self.fee_info.fee_vault = params.fee_vault;

        for f in params.duration_map.iter() {
            self.set_duration_map(f.duration, f.reward);
        }
        Ok(())
    }

    pub fn set_duration_map(&mut self, duration: u64, reward: u64) {
        for f in self.stake_info.duration_map.iter_mut() {
            if f.duration == duration {
                f.reward = reward;
                return;
            }
        }
        self.stake_info
            .duration_map
            .push(DurationMap::new(duration, reward));
    }

    pub fn get_reward_for_duration(&self, duration: u64) -> Option<u64> {
        for f in self.stake_info.duration_map.iter() {
            if f.duration == duration {
                return Some(f.reward);
            }
        }
        // None
        Some(0)
    }
}
