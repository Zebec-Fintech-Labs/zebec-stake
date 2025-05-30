import { Address, BN, translateAddress, utils } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { SEEDS } from "./constants";

export function deriveStakeAddress(
	staker: Address,
	lockup: Address,
	nonce: bigint,
	programId: Address 
) {
	const [stakeAddress] = PublicKey.findProgramAddressSync(
		[
			translateAddress(staker).toBuffer(),
			translateAddress(lockup).toBuffer(),
			new BN(nonce.toString()).toArrayLike(Buffer, "le", 8),
		],
		translateAddress(programId),
	);

	return stakeAddress;
}

export function deriveLockupAddress(name: string, programId: Address ) {
	const [lockupAddress] = PublicKey.findProgramAddressSync(
		[utils.bytes.utf8.encode(SEEDS.lockup), utils.bytes.utf8.encode(name)],
		translateAddress(programId),
	);

	return lockupAddress;
}

export function deriveUserNonceAddress(
	user: Address,
	lockup: Address,
	programId: Address,
) {
	const [userNonceAddress] = PublicKey.findProgramAddressSync(
		[translateAddress(user).toBuffer(), translateAddress(lockup).toBuffer()],
		translateAddress(programId),
	);

	return userNonceAddress;
}

export function deriveStakeVaultAddress(lockup: Address, programId: Address ) {
	const [stakeVault] = PublicKey.findProgramAddressSync(
		[utils.bytes.utf8.encode(SEEDS.stakeVault), translateAddress(lockup).toBuffer()],
		translateAddress(programId),
	);

	return stakeVault;
}

export function deriveRewardVaultAddress(lockup: Address, programId: Address ) {
	const [rewardVault] = PublicKey.findProgramAddressSync(
		[utils.bytes.utf8.encode(SEEDS.rewardVault), translateAddress(lockup).toBuffer()],
		translateAddress(programId),
	);

	return rewardVault;
}