import { BankrunProvider, startAnchor } from "anchor-bankrun";
import { expect } from "chai";
import { BanksClient, Clock, ProgramTestContext } from "solana-bankrun";

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Keypair, PublicKey } from "@solana/web3.js";

import { ZebecStake } from "../target/types/zebec_stake";
import { InitConfigParams, rewardSchemes } from "./constants";
import {
  deriveLockupAddress,
  deriveRewardVaultAddress,
  deriveStakeVaultAddress,
  deriveUserNonceAddress,
  deriveStakeAddress,
} from "./pda";
import {
  createNewMint,
  daysToSeconds,
  fundTokenAccount,
  getFeeVault,
  getTokenAccountBalance,
  getUserNonceInfo,
  parseZbcnUnits,
} from "./utils";

/* 
  For a user who stakes 1,000 ZBCN for 90 days at 12% APY,
  the reward would be ~29.6 ZBCN
  (calculated as (12% ÷ 365) × 90 × 1000).
  1,000 ZBCN, upon unstaking, they will receive 950 ZBCN 
  (as 50 ZBCN will be deducted as a fee).
*/
describe("stake-zbcn", async () => {
  let program: Program<ZebecStake>;
  let context: ProgramTestContext;
  let client: BanksClient;
  let mint: PublicKey;
  let provider: BankrunProvider;
  let stakeVaultAta: PublicKey;
  let rewardVaultAta: PublicKey;
  let staker1: Keypair;
  let staker1Ata: PublicKey;
  let stakerNonce1: PublicKey;
  let feeVaultTokenAccount: PublicKey;
  let feeVault: PublicKey;
  let lockup: PublicKey;
  let stakeVault: PublicKey;
  let rewardVault: PublicKey;
  let feePayer: Keypair;
  let lockUpData: InitConfigParams;
  const LOCKUP_NAME = "test-lockup";

  before(async () => {
    context = await startAnchor("", [], []);
    client = context.banksClient;

    provider = new BankrunProvider(context);
    anchor.setProvider(provider);

    program = anchor.workspace.ZebecStake as Program<ZebecStake>;
    console.log("sender", program.provider.publicKey.toBase58());
    console.log("programId", program.programId.toBase58());

    feePayer = anchor.web3.Keypair.generate();
    console.log("feePayer", feePayer.publicKey.toBase58());

    // transfer sol to feePayer from provider wallet
    const transferSolTx = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.transfer({
        fromPubkey: provider.wallet.payer.publicKey,
        toPubkey: feePayer.publicKey,
        lamports: 1000000000, // 1 SOL
      })
    );
    await provider.sendAndConfirm(transferSolTx, [provider.wallet.payer]);

    lockup = deriveLockupAddress(LOCKUP_NAME, program.programId);

    stakeVault = deriveStakeVaultAddress(lockup, program.programId);
    console.log("stake vault", stakeVault.toBase58());

    rewardVault = deriveRewardVaultAddress(lockup, program.programId);
    console.log("rewardVault", rewardVault.toBase58());

    mint = await createNewMint(provider);
    console.log("mint", mint.toBase58());

    const stakeVaultTokenAccount = await getAssociatedTokenAddress(
      mint,
      stakeVault,
      true
    );
    console.log("stakeVaultTokenAccount", stakeVaultTokenAccount.toBase58());

    stakeVaultAta = stakeVaultTokenAccount;

    // transfer tokens to stake vault for rewards
    await fundTokenAccount(
      stakeVault,
      stakeVaultAta,
      mint,
      6,
      1000, // 1 million
      provider
    );

    const rewardVaultTokenAccount = await getAssociatedTokenAddress(
      mint,
      rewardVault,
      true
    );
    rewardVaultAta = rewardVaultTokenAccount;

    await fundTokenAccount(
      rewardVault,
      rewardVaultAta,
      mint,
      6,
      1000,
      provider
    );

    staker1 = provider.wallet.payer;
    console.log("staker1", staker1.publicKey.toBase58());

    // await connection.requestAirdrop(
    //   staker1.publicKey,
    //   10000000000 // 10 million lamports
    // );

    staker1Ata = await getAssociatedTokenAddress(mint, staker1.publicKey, true);

    stakerNonce1 = deriveUserNonceAddress(
      staker1.publicKey,
      lockup,
      program.programId
    );

    // await fundTokenAccount(
    //   staker1.publicKey,
    //   staker1Ata,
    //   mint,
    //   6,
    //   1000000, // 1 million
    //   provider,
    // );

    [feeVault, feeVaultTokenAccount] = await getFeeVault(provider, mint);
  });

  it("should Initialize stake config with lock period of 90 days!", async () => {
    try {
      lockUpData = {
        name: LOCKUP_NAME,
        fee: new anchor.BN(0),
        feeVault: feeVault,
        durationMap: rewardSchemes,
        minimumStake: new anchor.BN(parseZbcnUnits(1000)), // 1000 ZBCN
      };

      const tx = await program.methods
        .initLockup(lockUpData)
        .accountsStrict({
          creator: provider.publicKey,
          rewardToken: mint,
          stakeToken: mint,
          lockup: lockup,
          stakeVault: stakeVault,
          rewardVault: rewardVault,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([provider.wallet.payer])
        .rpc();
      // console.log("✅✅ Init signature: ", tx);
      const lockupAccount = await program.account.lockup.fetch(lockup);

      expect(lockupAccount.feeInfo.fee.toNumber()).to.be.equal(0);
      expect(lockupAccount.feeInfo.feeVault.toBase58()).to.be.equal(
        feeVault.toBase58()
      );
      expect(lockupAccount.stakeInfo.creator.toBase58()).to.be.equal(
        provider.publicKey.toBase58()
      );
    } catch (error) {
      throw error;
    }
  });

  it("should stake 1000 zbcn for 90 days and then unstake", async () => {
    const lockPeriod = daysToSeconds(90);
    const nonceInfo = await getUserNonceInfo(program, stakerNonce1);
    const nonce = nonceInfo ? nonceInfo.nonce : BigInt(0);
    const staker1Pda = deriveStakeAddress(
      staker1.publicKey,
      lockup,
      nonce,
      program.programId
    );

    try {
      type StakeConfigParams = {
        amount: anchor.BN;
        lockPeriod: anchor.BN;
        nonce: anchor.BN;
      };

      const data: StakeConfigParams = {
        amount: new anchor.BN(parseZbcnUnits(1000)), // 1000 ZBCN
        lockPeriod: new anchor.BN(lockPeriod),
        nonce: new anchor.BN(nonce.toString()),
      };

      let staker1TokenAccountBalanceBefore = await getTokenAccountBalance(
        provider,
        staker1Ata
      );

      let stakeVaultTokenAccountBalanceBefore = await getTokenAccountBalance(
        provider,
        stakeVaultAta
      );

      const stakeSig = await program.methods
        .stakeZbcn(data)
        .accountsStrict({
          staker: staker1.publicKey,
          feePayer: feePayer.publicKey,
          lockup: lockup,
          stakePda: staker1Pda,
          stakeToken: mint,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          stakerTokenAccount: staker1Ata,
          stakeVault: stakeVault,
          stakeVaultTokenAccount: stakeVaultAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          userNonce: stakerNonce1,
        })
        .signers([staker1, feePayer])
        .rpc();
      // console.log("✅✅ Stake signature", stakeSig);

      let staker1TokenAccountBalanceAfter = await getTokenAccountBalance(
        provider,
        staker1Ata
      );

      let stakeVaultTokenAccountBalanceAfter = await getTokenAccountBalance(
        provider,
        stakeVaultAta
      );

      expect(
        stakeVaultTokenAccountBalanceBefore + BigInt(data.amount.toString())
      ).to.be.equal(stakeVaultTokenAccountBalanceAfter);

      expect(
        staker1TokenAccountBalanceBefore - BigInt(data.amount.toString())
      ).to.be.equal(staker1TokenAccountBalanceAfter);

      const timestamp = Math.floor(Date.now() / 1000);
      const currentClock = await client.getClock();
      context.setClock(
        new Clock(
          currentClock.slot,
          currentClock.epochStartTimestamp,
          currentClock.epoch,
          currentClock.leaderScheduleEpoch,
          BigInt(timestamp) + BigInt(timestamp + daysToSeconds(90))
        )
      );

      staker1TokenAccountBalanceBefore = await getTokenAccountBalance(
        provider,
        staker1Ata
      );

      stakeVaultTokenAccountBalanceBefore = await getTokenAccountBalance(
        provider,
        stakeVaultAta
      );

      const unstakeSig = await program.methods
        .unstakeZbcn(new anchor.BN(nonce.toString()))
        .accountsStrict({
          feePayer: feePayer.publicKey,
          rewardToken: mint,
          rewardVault,
          rewardVaultTokenAccount: rewardVaultAta,
          stakerRewardTokenAccount: staker1Ata,
          staker: program.provider.publicKey,
          lockup: lockup,
          stakePda: staker1Pda,
          stakeToken: mint,
          stakerTokenAccount: staker1Ata,
          stakeVault: stakeVault,
          stakeVaultTokenAccount: stakeVaultAta,
          feeVault: feeVault,
          feeVaultTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([staker1, feePayer])
        .rpc();
      // console.log("✅✅ Unstake signature", unstakeSig);

      staker1TokenAccountBalanceAfter = await getTokenAccountBalance(
        provider,
        staker1Ata
      );

      stakeVaultTokenAccountBalanceAfter = await getTokenAccountBalance(
        provider,
        stakeVaultAta
      );

      /// 1000*0.12/(365*86400)*(90*86400)
      let expectedReward = parseZbcnUnits(
        ((1000 * 0.12) / (365 * 86400)) * (90 * 86400)
      );

      expect(
        stakeVaultTokenAccountBalanceBefore - BigInt(data.amount.toString())
      ).to.be.equal(stakeVaultTokenAccountBalanceAfter);

      expect(
        staker1TokenAccountBalanceBefore +
          BigInt(data.amount.toString()) +
          BigInt(expectedReward.toFixed())
      ).to.be.equal(staker1TokenAccountBalanceAfter);
    } catch (error) {
      throw error;
    }
  });

  it("Zero stake amount", async () => {
    const nonceInfo = await getUserNonceInfo(program, stakerNonce1);
    const nonce = nonceInfo ? nonceInfo.nonce : BigInt(0);
    const staker1Pda = deriveStakeAddress(
      staker1.publicKey,
      lockup,
      nonce,
      program.programId
    );

    let error: Error | undefined;
    try {
      type StakeConfigParams = {
        amount: anchor.BN;
        lockPeriod: anchor.BN;
        nonce: anchor.BN;
      };

      const data: StakeConfigParams = {
        amount: new anchor.BN(parseZbcnUnits(0)),
        lockPeriod: new anchor.BN(daysToSeconds(90)),
        nonce: new anchor.BN(nonce.toString()),
      };

      const stakeSig = await program.methods
        .stakeZbcn(data)
        .accountsStrict({
          staker: staker1.publicKey,
          feePayer: feePayer.publicKey,
          lockup: lockup,
          stakePda: staker1Pda,
          userNonce: stakerNonce1,
          stakeToken: mint,
          stakerTokenAccount: staker1Ata,
          stakeVault: stakeVault,
          stakeVaultTokenAccount: stakeVaultAta,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([staker1, feePayer])
        .rpc();
      // console.log("✅✅ Stake signature", stakeSig);
    } catch (err) {
      error = err;
    }

    expect(error).not.to.be.undefined;
  });

  it("Unstake before lockup period", async () => {
    const lockPeriod = daysToSeconds(90);
    const nonceInfo = await getUserNonceInfo(program, stakerNonce1);
    const nonce = nonceInfo ? nonceInfo.nonce : BigInt(0);
    const staker1Pda = deriveStakeAddress(
      staker1.publicKey,
      lockup,
      nonce,
      program.programId
    );
    let error: Error | undefined;

    try {
      type StakeConfigParams = {
        amount: anchor.BN;
        lockPeriod: anchor.BN;
        nonce: anchor.BN;
      };

      const data: StakeConfigParams = {
        amount: new anchor.BN(parseZbcnUnits(1000)), // 1000 ZBCN
        lockPeriod: new anchor.BN(lockPeriod),
        nonce: new anchor.BN(nonce.toString()),
      };

      const stakeSig = await program.methods
        .stakeZbcn(data)
        .accountsStrict({
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          feePayer: feePayer.publicKey,
          staker: staker1.publicKey,
          lockup: lockup,
          stakePda: staker1Pda,
          stakeToken: mint,
          stakerTokenAccount: staker1Ata,
          stakeVault: stakeVault,
          stakeVaultTokenAccount: stakeVaultAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          userNonce: stakerNonce1,
        })
        .signers([staker1, feePayer])
        .rpc();
      // console.log("✅✅ Stake signature", stakeSig);

      const unstakeSig = await program.methods
        .unstakeZbcn(new anchor.BN(nonce.toString()))
        .accountsStrict({
          rewardToken: mint,
          feePayer: feePayer.publicKey,
          rewardVault,
          rewardVaultTokenAccount: rewardVaultAta,
          stakerRewardTokenAccount: staker1Ata,
          staker: program.provider.publicKey,
          lockup: lockup,
          stakePda: staker1Pda,
          stakeToken: mint,
          stakerTokenAccount: staker1Ata,
          stakeVault: stakeVault,
          stakeVaultTokenAccount: stakeVaultAta,
          feeVault: feeVault,
          feeVaultTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([staker1, feePayer])
        .rpc();
      // console.log("✅✅ Unstake signature", unstakeSig);
    } catch (e) {
      error = e;
    }
    expect(error).not.to.be.undefined;
    expect(error.message).to.include("StakeRewardNotClaimable");
  });

  it("Cannot stake with less than minimum amount", async () => {
    const nonceInfo = await getUserNonceInfo(program, stakerNonce1);
    const nonce = nonceInfo ? nonceInfo.nonce : BigInt(0);
    let error: Error | undefined;
    const staker1Pda = deriveStakeAddress(
      staker1.publicKey,
      lockup,
      nonce,
      program.programId
    );
    try {
      type StakeConfigParams = {
        amount: anchor.BN;
        lockPeriod: anchor.BN;
        nonce: anchor.BN;
      };

      const data: StakeConfigParams = {
        amount: new anchor.BN(parseZbcnUnits(500)),
        lockPeriod: new anchor.BN(daysToSeconds(90)),
        nonce: new anchor.BN(nonce.toString()),
      };

      const stakeSig = await program.methods
        .stakeZbcn(data)
        .accountsStrict({
          staker: staker1.publicKey,
          feePayer: feePayer.publicKey,
          lockup: lockup,
          stakePda: staker1Pda,
          userNonce: stakerNonce1,
          stakeToken: mint,
          stakerTokenAccount: staker1Ata,
          stakeVault: stakeVault,
          stakeVaultTokenAccount: stakeVaultAta,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([staker1, feePayer])
        .rpc();

      // expect error to be thrown
    } catch (err) {
      error = err;
    }
    expect(error).not.to.be.undefined;
    expect(error.message).to.include("MinimumStakeNotMet");
  });

  it("Double unstaking", async () => {
    const nonce = BigInt(0);
    const staker1Pda = deriveStakeAddress(
      staker1.publicKey,
      lockup,
      nonce,
      program.programId
    );
    let error: any = undefined;
    try {
      await program.methods
        .unstakeZbcn(new anchor.BN(nonce.toString()))
        .accountsStrict({
          rewardToken: mint,
          feePayer: feePayer.publicKey,
          rewardVault,
          rewardVaultTokenAccount: rewardVaultAta,
          stakerRewardTokenAccount: staker1Ata,
          staker: program.provider.publicKey,
          lockup: lockup,
          stakePda: staker1Pda,
          stakeToken: mint,
          stakerTokenAccount: staker1Ata,
          stakeVault: stakeVault,
          stakeVaultTokenAccount: stakeVaultAta,
          feeVault: feeVault,
          feeVaultTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([staker1, feePayer])
        .rpc();
    } catch (e) {
      error = e;
    }
    expect(error).not.to.be.undefined;
    expect(error.message).to.include("RewardAlreadyClaimed.");
  });

  it("stake and unstake outside of lock period maps", async () => {
    const nonceInfo = await getUserNonceInfo(program, stakerNonce1);
    const nonce = nonceInfo ? nonceInfo.nonce : BigInt(0);
    const staker1Pda = deriveStakeAddress(
      staker1.publicKey,
      lockup,
      nonce,
      program.programId
    );
    let error: Error | undefined;
    try {
      type StakeConfigParams = {
        amount: anchor.BN;
        lockPeriod: anchor.BN;
        nonce: anchor.BN;
      };

      const data: StakeConfigParams = {
        amount: new anchor.BN(parseZbcnUnits(10000)),
        lockPeriod: new anchor.BN(daysToSeconds(50)),
        nonce: new anchor.BN(nonce.toString()),
      };

      const stakeSig = await program.methods
        .stakeZbcn(data)
        .accountsStrict({
          staker: staker1.publicKey,
          feePayer: feePayer.publicKey,
          lockup: lockup,
          stakePda: staker1Pda,
          userNonce: stakerNonce1,
          stakeToken: mint,
          stakerTokenAccount: staker1Ata,
          stakeVault: stakeVault,
          stakeVaultTokenAccount: stakeVaultAta,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([staker1, feePayer])
        .rpc();

      const unstakeSig = await program.methods
        .unstakeZbcn(new anchor.BN(nonce.toString()))
        .accountsStrict({
          rewardToken: mint,
          feePayer: feePayer.publicKey,
          rewardVault,
          rewardVaultTokenAccount: rewardVaultAta,
          stakerRewardTokenAccount: staker1Ata,
          staker: program.provider.publicKey,
          lockup: lockup,
          stakePda: staker1Pda,
          stakeToken: mint,
          stakerTokenAccount: staker1Ata,
          stakeVault: stakeVault,
          stakeVaultTokenAccount: stakeVaultAta,
          feeVault: feeVault,
          feeVaultTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([staker1, feePayer])
        .rpc();
      // expect error to be thrown
    } catch (err) {
      error = err;
    }
    expect(error).not.to.be.undefined;
    expect(error.message).to.include("StakeRewardNotClaimable.");
  });
});
