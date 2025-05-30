import 'dotenv/config';

import {
  Address,
  Program,
  Provider,
} from '@coral-xyz/anchor';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createInitializeMint2Instruction,
  createMintToInstruction,
  createTransferCheckedInstruction,
  getAccount,
  getAssociatedTokenAddress,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';

import { ZebecStake } from '../target/types/zebec_stake';

export async function createNewMint(provider: Provider) {
  const mint = Keypair.generate();

  const ata = await getAssociatedTokenAddress(
    mint.publicKey,
    provider.publicKey,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
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

export async function fundTokenAccount(
  to:PublicKey,
  toAta: PublicKey,
  mint: PublicKey,
  mintDecimals: number,
  amount: number,
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
      toAta,
      to,
      mint,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    ),
    createTransferCheckedInstruction(
      sourceAta,
      mint,
      toAta,
      provider.publicKey,
      amount * 10 ** mintDecimals,
      mintDecimals,
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

export async function getUserNonceInfo(program: Program<ZebecStake>, userNonceAddress: Address): Promise<{ nonce: bigint}> {
  try {
		const userNonceAccount = await program.account.userNonce.fetchNullable(
			userNonceAddress,
			program.provider.connection.commitment,
		);

		if (!userNonceAccount) {
			return null;
		}

		return {
			nonce: BigInt(userNonceAccount.nonce.toString()),
		};
  } catch (error) {
    return null;
  }
	}