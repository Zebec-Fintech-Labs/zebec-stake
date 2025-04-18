import {
  createAssociatedTokenAccountInstruction,
  createInitializeMint2Instruction,
  createMintToInstruction,
  createTransferCheckedInstruction,
  createTransferInstruction,
  getAccount,
  getAssociatedTokenAddress,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  MintLayout,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import "dotenv/config";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { BN, Provider } from "@coral-xyz/anchor";

export async function createNewMint(provider: Provider) {
  const mint = Keypair.generate();

  const ata = await getAssociatedTokenAddress(
    mint.publicKey,
    provider.publicKey,
    true,
    TOKEN_PROGRAM_ID
  );

  const transaction = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: provider.publicKey,
      newAccountPubkey: mint.publicKey,
      lamports: await getMinimumBalanceForRentExemptMint(provider.connection),
      space: MINT_SIZE,
      programId: TOKEN_PROGRAM_ID,
    }),
    createInitializeMint2Instruction(
      mint.publicKey,
      6,
      provider.publicKey,
      provider.publicKey,
      TOKEN_PROGRAM_ID
    ),
    createAssociatedTokenAccountInstruction(
      provider.publicKey,
      ata,
      provider.publicKey,
      mint.publicKey,
      TOKEN_PROGRAM_ID
    ),
    createMintToInstruction(
      mint.publicKey,
      ata,
      provider.publicKey,
      10000000 * 10 ** 6,
      undefined,
      TOKEN_PROGRAM_ID
    )
  );
  await provider.sendAndConfirm(transaction, [mint]);

  console.log("Mint created", mint.publicKey.toBase58());
  return mint.publicKey;
}

export async function transferToStakeVault(
  stakeVault: PublicKey,
  stakeVaultTokenAccount: PublicKey,
  mint: PublicKey,
  provider: Provider
) {
  const sourceAta = await getAssociatedTokenAddress(
    mint,
    provider.publicKey,
    true,
    TOKEN_PROGRAM_ID
  );
  // Transfer to stake vault
  const transaction = new Transaction().add(
    createAssociatedTokenAccountInstruction(
      provider.publicKey,
      stakeVaultTokenAccount,
      stakeVault,
      mint,
      TOKEN_PROGRAM_ID
    ),
    createTransferCheckedInstruction(
      sourceAta,
      mint,
      stakeVaultTokenAccount,
      provider.publicKey,
      1000 * 10 ** 6,
      6,
      undefined,
      TOKEN_PROGRAM_ID
    )
  );
  await provider.sendAndConfirm(transaction);
}

export async function getFeeVault(provider: Provider, mint: PublicKey) {
  const feeVault = Keypair.generate();
  const feeVaultTokenAccount = await getAssociatedTokenAddress(
    mint,
    feeVault.publicKey,
    true,
    TOKEN_PROGRAM_ID
  );
  const transaction = new Transaction().add(
    createAssociatedTokenAccountInstruction(
      provider.publicKey,
      feeVaultTokenAccount,
      feeVault.publicKey,
      mint,
      TOKEN_PROGRAM_ID
    )
  );
  await provider.sendAndConfirm(transaction);
  return [feeVault.publicKey, feeVaultTokenAccount];
}

export async function getTokenAccountBalance(
  provider: Provider,
  tokenAccount: PublicKey
): Promise<bigint> {
  const balance = await getAccount(provider.connection, tokenAccount);
  return balance.amount;
}

export function daysToSeconds(days: number) {
  return days * 24 * 60 * 60;
}

export function parseZbcnUnits(amount: number) {
  return amount * 10 ** 6;
}
