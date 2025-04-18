import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { StakeZbcn } from "../target/types/stake_zbcn";
import { PublicKey } from "@solana/web3.js";
import {
  createNewMint,
  daysToSeconds,
  getFeeVault,
  getTokenAccountBalance,
  parseZbcnUnits,
  transferToStakeVault,
} from "./utils";

import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { BankrunProvider, startAnchor } from "anchor-bankrun";
import { BanksClient, Clock, ProgramTestContext } from "solana-bankrun";
import { expect } from "chai";
import { LOCKUP_NAME, LOCKUP_SEED, STAKE_VAULT_SEED } from "./constants";

type InitConfigParams = {
  name: string;
  lockPeriod: anchor.BN;
  stakingEndTime: anchor.BN;
  stakingStartTime: anchor.BN;
  apy: anchor.BN;
  fee: anchor.BN;
  feeVault: PublicKey;
};

/* 
  For a user who stakes 1,000 ZBCN for 90 days at 12% APY,
  the reward would be ~29.6 ZBCN
  (calculated as (12% ÷ 365) × 90 × 1000).
  1,000 ZBCN, upon unstaking, they will receive 950 ZBCN 
  (as 50 ZBCN will be deducted as a fee).
*/
describe("stake-zbcn", async () => {
  let program: Program<StakeZbcn>;
  let context: ProgramTestContext;
  let client: BanksClient;
  let mint: PublicKey;
  let provider: anchor.Provider;
  let stakeVaultTokenAccount: PublicKey;
  let user1TokenAccount: PublicKey;
  let feeVaultTokenAccount: PublicKey;
  let feeVault: PublicKey;
  let lockup: PublicKey;
  let stakeVault: PublicKey;
  let user1Pda: PublicKey;
  let lockUpData: InitConfigParams;

  before(async () => {
    context = await startAnchor("", [], []);
    client = context.banksClient;

    provider = new BankrunProvider(context);
    anchor.setProvider(provider);

    program = anchor.workspace.StakeZbcn as Program<StakeZbcn>;
    console.log("sender", program.provider.publicKey.toBase58());
    console.log("programId", program.programId.toBase58());

    mint = await createNewMint(program.provider);
    [lockup] = PublicKey.findProgramAddressSync(
      [Buffer.from(LOCKUP_SEED), Buffer.from(LOCKUP_NAME)],
      program.programId
    );
    [stakeVault] = PublicKey.findProgramAddressSync(
      [Buffer.from(STAKE_VAULT_SEED), lockup.toBuffer()],
      program.programId
    );

    [user1Pda] = PublicKey.findProgramAddressSync(
      [program.provider.publicKey.toBuffer(), lockup.toBuffer()],
      program.programId
    );

    stakeVaultTokenAccount = await getAssociatedTokenAddress(
      mint,
      stakeVault,
      true,
      TOKEN_PROGRAM_ID
    );

    // transfer tokens to stake vault for rewards
    await transferToStakeVault(
      stakeVault,
      stakeVaultTokenAccount,
      mint,
      provider
    );

    user1TokenAccount = await getAssociatedTokenAddress(
      mint,
      provider.publicKey,
      true,
      TOKEN_PROGRAM_ID
    );

    [feeVault, feeVaultTokenAccount] = await getFeeVault(provider, mint);
  });

  it("should Initialize stake config with lock period of 90 days!", async () => {
    try {
      let currentUnixTimestamp = Math.floor(Date.now() / 1000);
      let stakingStartTime = currentUnixTimestamp + daysToSeconds(1);
      let stakingEndTime = stakingStartTime + daysToSeconds(2);
      let lockPeriod = daysToSeconds(90);

      lockUpData = {
        name: LOCKUP_NAME,
        lockPeriod: new anchor.BN(lockPeriod),
        stakingEndTime: new anchor.BN(stakingEndTime),
        stakingStartTime: new anchor.BN(stakingStartTime),
        apy: new anchor.BN(120),
        fee: new anchor.BN(50),
        feeVault: feeVault,
      };

      const initAccounts = {
        creator: provider.publicKey,
        lockup: lockup,
        stakeVault: stakeVault,
        stakeToken: mint,
        rewardToken: mint,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      };
      const tx = await program.methods
        .initLockup(lockUpData)
        .accounts(initAccounts)
        .rpc();
      console.log("✅✅ Init signature: ", tx);
      const lockupAccount = await program.account.lockup.fetch(lockup);

      expect(lockupAccount.feeInfo.fee.toNumber()).to.be.equal(50);
      expect(lockupAccount.feeInfo.feeVault.toBase58()).to.be.equal(
        feeVault.toBase58()
      );
      expect(lockupAccount.stakeInfo.endTime.toNumber()).to.be.equal(
        stakingEndTime
      );
      expect(lockupAccount.stakeInfo.startTime.toNumber()).to.be.equal(
        stakingStartTime
      );
      expect(lockupAccount.stakeInfo.lockPeriod.toNumber()).to.be.equal(
        lockPeriod
      );
    } catch (error) {
      console.error("❌❌ Error: ", error);
    }
  });

  it("should stake 1000 zbc for 90 days", async () => {
    const timestamp = Math.floor(Date.now() / 1000);

    // time skip to staking start time
    const currentClock = await client.getClock();
    context.setClock(
      new Clock(
        currentClock.slot,
        currentClock.epochStartTimestamp,
        currentClock.epoch,
        currentClock.leaderScheduleEpoch,
        BigInt(
          timestamp +
            lockUpData.stakingEndTime.toNumber() -
            lockUpData.stakingStartTime.toNumber() +
            10
        )
      )
    );

    try {
      type StakeConfigParams = {
        amount: anchor.BN; // Corresponds to u64 (number in JS/TS can handle large integers, but not as large as u64)
      };

      const data: StakeConfigParams = {
        amount: new anchor.BN(parseZbcnUnits(1000)),
      };

      const stakeAccounts = {
        staker: program.provider.publicKey,
        lockup: lockup,
        userPda: user1Pda,
        stakeToken: mint,
        stakerTokenAccount: user1TokenAccount,
        stakeVault: stakeVault,
        stakeVaultTokenAccount,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      };

      const tx = await program.methods
        .stakeZbcn(data)
        .accounts(stakeAccounts)
        .rpc();
      console.log("✅✅ Stake signature", tx);
    } catch (error) {
      console.error("❌❌ Error: ", error);
    }
  });

  it("should be able to unstake after 90 days with 5% stake fee", async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const currentClock = await client.getClock();
    context.setClock(
      new Clock(
        currentClock.slot,
        currentClock.epochStartTimestamp,
        currentClock.epoch,
        currentClock.leaderScheduleEpoch,
        BigInt(timestamp) +
          BigInt(
            timestamp +
              lockUpData.stakingEndTime.toNumber() -
              lockUpData.stakingStartTime.toNumber() +
              lockUpData.lockPeriod.toNumber()
          )
      )
    );

    const user1TokenAccountBalanceBefore = await getTokenAccountBalance(
      provider,
      user1TokenAccount
    );

    const feeVaultTokenAccountBalanceBefore = await getTokenAccountBalance(
      provider,
      feeVaultTokenAccount
    );

    try {
      const unstakeAccounts = {
        staker: program.provider.publicKey,
        lockup: lockup,
        stakePda: user1Pda,
        stakeToken: mint,
        stakerTokenAccount: user1TokenAccount,
        stakeVault: stakeVault,
        stakeVaultTokenAccount,
        feeVault: feeVault,
        feeVaultTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      };

      // Add your test here.
      const tx = await program.methods
        .unstakeZbcn()
        .accounts(unstakeAccounts)
        .rpc();
      console.log("✅✅ Unstake signature", tx);

      const user1TokenAccountBalanceAfter = await getTokenAccountBalance(
        provider,
        user1TokenAccount
      );

      const feeVaultTokenAccountBalanceAfter = await getTokenAccountBalance(
        provider,
        feeVaultTokenAccount
      );

      expect(
        user1TokenAccountBalanceAfter - user1TokenAccountBalanceBefore
      ).to.be.equal(BigInt(parseZbcnUnits(950)));

      expect(
        feeVaultTokenAccountBalanceAfter - feeVaultTokenAccountBalanceBefore
      ).to.be.equal(BigInt(parseZbcnUnits(50)));
    } catch (error) {
      console.error("❌❌ Error: ", error);
    }
  });

  it("should claim", async () => {
    try {
      const user1TokenAccountBalanceBefore = await getTokenAccountBalance(
        provider,
        user1TokenAccount
      );
      const claimAccounts = {
        staker: program.provider.publicKey,
        lockup: lockup,
        stakePda: user1Pda,
        rewardToken: mint,
        stakeToken: mint,
        stakerRewardTokenAccount: user1TokenAccount,
        stakeVault: stakeVault,
        stakeVaultRewardTokenAccount: stakeVaultTokenAccount,
        stakeVaultTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      };

      const tx = await program.methods
        .claimReward()
        .accounts(claimAccounts)
        .rpc();
      console.log("✅✅ Claim signature: ", tx);
      const user1TokenAccountBalanceAfter = await getTokenAccountBalance(
        provider,
        user1TokenAccount
      );
      const aprAmount = (12 / 100 / 365) * 90 * 1000;
      const expectedAmount = parseZbcnUnits(aprAmount);
      expect(
        user1TokenAccountBalanceAfter - user1TokenAccountBalanceBefore
      ).to.be.equal(BigInt(expectedAmount.toFixed(0)));
    } catch (error) {
      console.error("❌❌ Error: ", error);
    }
  });
});
