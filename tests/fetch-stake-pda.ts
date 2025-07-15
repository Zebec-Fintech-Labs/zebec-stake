import { describe, it } from "mocha";
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

import { ZebecStake } from "../target/types/zebec_stake";
import { deriveUserNonceAddress, deriveStakeAddress } from "./pda";
import { getUserNonceInfo } from "./utils";

describe("fetch-stake-pda", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.ZebecStake as Program<ZebecStake>;
  let nonce: bigint;

  it.only("decodes stake PDA and user nonce PDA", async () => {
    const staker = new PublicKey(
      "8Vm6Uid7iSu3xcYVY8Yx6rSyXNqTEd3CW77DfGjzw1EG"
    );

    const endpoint = anchor.getProvider().connection.rpcEndpoint;
    let lockup: PublicKey;
    if (endpoint.includes("devnet")) {
      lockup = new PublicKey("DrxrMnUsyn5T6LRbnA1Zad4cYY6saSUSrhsdNJyJZyAN");
    } else {
      lockup = new PublicKey("AYbW5cbZEUgLEj6Eiy3yg74PU3YbEHkbFxgW6fjbSJjp");
    }

    // Derive staker nonce PDA
    const stakerNoncePda = deriveUserNonceAddress(
      staker,
      lockup,
      program.programId
    );
    console.log("stakerNoncePda", stakerNoncePda.toBase58());

    // Fetch only if nonce is null
    if (!nonce) {
      const nonceInfo = await getUserNonceInfo(program, stakerNoncePda);
      console.log("nonceInfo", nonceInfo);
      nonce = nonceInfo ? BigInt(nonceInfo?.nonce) - BigInt(1) : BigInt(0);
      console.log("nonce", nonce.toString());
    }
    // Derive staker stake PDA
    const stakerStakePda = deriveStakeAddress(
      staker,
      lockup,
      nonce,
      program.programId
    );
    console.log("stakerStakePda", stakerStakePda.toBase58());

    // Fetch stake PDA info
    const stakePdaInfo = await program.account.userStakeData.fetch(
      stakerStakePda
    );
    const stakePdaInfoForLog = {
      ...stakePdaInfo,
      stakedAmount: stakePdaInfo.stakedAmount?.toString(),
      rewardAmount: stakePdaInfo.rewardAmount?.toString(),
      createdTime: stakePdaInfo.createdTime?.toString(),
      lockPeriod: stakePdaInfo.lockPeriod?.toString(),
    };
    console.log("stakePdaInfo", JSON.stringify(stakePdaInfoForLog, null, 2));
  });
});
