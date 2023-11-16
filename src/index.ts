import {
  Connection,
  InflationReward,
  ParsedAccountData,
  PublicKey,
  StakeAuthorizationLayout,
  StakeProgram,
} from "@solana/web3.js";
import { Config } from "./config";
import { createObjectCsvWriter } from "csv-writer";

const STAKE_PROGRAM_PK = new PublicKey(
  "Stake11111111111111111111111111111111111111"
);
const WALLET_OFFSET = 44;
const DATA_SIZE = 200;

type CsvRow = {
  stakeAccount: string;
  epoch: number;
  effectiveSlot: number;
  amount: number;
  postBalance: number;
  commission?: number | null;
};
async function main() {
  const config = new Config();
  // for each stake account call getInflationReward
  // write reward/epoch to csv
  // log total per stake account to console
  const connection = new Connection(config.rpcUrl, "confirmed");
  // get all stake accounts
  const stakeAccounts = await connection.getProgramAccounts(STAKE_PROGRAM_PK, {
    dataSlice: {
      offset: 0,
      length: 0,
    },
    filters: [
      {
        dataSize: DATA_SIZE, // number of bytes
      },
      {
        memcmp: {
          offset: WALLET_OFFSET, // number of bytes
          bytes: config.wallet.toBase58(), // base58 encoded string
        },
      },
    ],
  });
  const epochInfo = await connection.getEpochInfo("confirmed");

  console.log(
    `Processing ${
      stakeAccounts.length
    } stake accounts for wallet: ${config.wallet.toBase58()}} from epoch ${epochInfo.epoch}`
  );
  
  const walletRewards: CsvRow[] = [];
  for (const stakeAccount of stakeAccounts) {
    const stake = await connection.getParsedAccountInfo(
      stakeAccount.pubkey,
      "confirmed"
    );
    const activationEpochStr = (stake.value?.data as any)?.parsed?.info?.stake
      ?.delegation?.activationEpoch as string | undefined;
    if (!activationEpochStr) {
      console.log(
        `missing activation epoch for stake account ${stakeAccount.pubkey.toBase58()}`
      );
      console.log(JSON.stringify(stake, null, 2));
      continue;
    }
    const activationEpoch = parseInt(activationEpochStr);
    let queryEpoch: number = epochInfo.epoch - 1;
    const stakeAccountRewards: CsvRow[] = [];
    console.log(
      `looping through all epochs for stake account ${stakeAccount.pubkey.toBase58()} from epoch ${queryEpoch} to ${activationEpoch}`
    );
    while (true) {
      if (queryEpoch < activationEpoch) {
        break;
      }
      console.log(`\tquerying epoch ${queryEpoch}`)
      const reward: InflationReward | null = (
        await connection.getInflationReward([stakeAccount.pubkey], queryEpoch)
      )[0];
      if (!reward) {
        console.log(`\tno rewards found for epoch ${queryEpoch}, continuing...`)
        queryEpoch = queryEpoch - 1;
        continue;
      }
      console.log(`\tgot reward on epoch ${reward.epoch}`);
      walletRewards.push({
        stakeAccount: stakeAccount.pubkey.toBase58(),
        ...reward,
      });
      stakeAccountRewards.push({
        stakeAccount: stakeAccount.pubkey.toBase58(),
        ...reward,
      });
      queryEpoch = queryEpoch - 1;
    }
    // Create a CSV writer instance
    const csvWriter = createObjectCsvWriter({
      path: `./out/stake-account-${stakeAccount.pubkey.toBase58()}-rewards.csv`,
      header: [
        { id: "stakeAccount", title: "stakeAccount" },
        { id: "epoch", title: "epoch" },
        { id: "effectiveSlot", title: "effectiveSlot" },
        { id: "amount", title: "amount" },
        { id: "postBalance", title: "postBalance" },
        { id: "commission", title: "commission" },
      ],
    });
    csvWriter
      .writeRecords(stakeAccountRewards)
      .then(() => console.log("CSV file has been written successfully."))
      .catch((error) => console.error("Error writing CSV file:", error));
  }
  const csvWriter = createObjectCsvWriter({
    path: `./out/wallet-${config.wallet.toBase58()}-rewards.csv`,
    header: [
      { id: "stakeAccount", title: "stakeAccount" },
      { id: "epoch", title: "epoch" },
      { id: "effectiveSlot", title: "effectiveSlot" },
      { id: "amount", title: "amount" },
      { id: "postBalance", title: "postBalance" },
      { id: "commission", title: "commission" },
    ],
  });
  csvWriter
    .writeRecords(walletRewards)
    .then(() => console.log("CSV file has been written successfully."))
    .catch((error) => console.error("Error writing CSV file:", error));
}

(async () => {
  try {
    await main();
  } catch (e) {
    console.log((e as any).stack);
    console.error(`failed with ${e}`);
  }
})();
