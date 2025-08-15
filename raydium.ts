import type {
  Connection,
  ParsedInnerInstruction,
  ParsedInstruction,
  ParsedTransactionWithMeta,
  PartiallyDecodedInstruction,
  PublicKey,
} from "@solana/web3.js";
import { config } from "./config";
import { base64, bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { BN, BorshCoder, type Instruction } from "@coral-xyz/anchor";
import idl from "./launchpad_idl.json";

export type RaydiumEventData = {
  instruction: Instruction;
  accounts: PublicKey[];
  signature: string;
  blockTime: number;
  slot: number;
  eventType: string;
  data: object;
};

export type PoolCreatedEvent = {
  pool_state: PublicKey;
  creator: PublicKey;
  config: PublicKey;
  base_mint_param: {
    decimals: number;
    name: string;
    symbol: string;
    uri: string;
  };
  curve_param: {
    Constant: {
      data: {
        supply: BN;
        total_base_sell: BN;
        total_quote_fund_raising: BN;
        migrate_type: number;
      };
    };
  };
  vesting_param: {
    total_locked_amount: BN;
    cliff_period: BN;
    vesting_period: BN;
  };
};

export type TradeEvent = {
  pool_state: PublicKey;
  total_base_sell: BN;
  virtual_base: BN;
  virtual_quote: BN;
  real_base_before: BN;
  real_quote_before: BN;
  real_base_after: BN;
  real_quote_after: BN;
  amount_in: BN;
  amount_out: BN;
  protocol_fee: BN;
  platform_fee: BN;
  share_fee: BN;
  trade_direction: { Buy: {} } | { Sell: {} };
  pool_status: { Fund: {} } | { Migrate: {} } | { Trade: {} };
};

const coder = new BorshCoder(idl as any);

export enum InitializeAccountIndex {
  Payer = 0,
  Creator,
  GlobalConfig,
  PlatformConfig,
  Authority,
  PoolState,
  BaseMint,
  QuoteMint,
  BaseVault,
  QuoteVault,
  MetadataAccount,
  BaseTokenProgram,
  QuoteTokenProgram,
  MetadataProgram,
  SystemProgram,
  RentProgram,
  EventAuthority,
  Program,
}

export enum TradeAccountIndex {
  Payer = 0,
  Authority,
  GlobalConfig,
  PlatformConfig,
  PoolState,
  UserBaseToken,
  UserQuoteToken,
  BaseVault,
  QuoteVault,
  BaseTokenMint,
  QuoteTokenMint,
  BaseTokenProgram,
  QuoteTokenProgram,
  EventAuthority,
  Program,
}

export type TxResult = {
  error: Error | null;
  signature: string;
  events: RaydiumEventData[];
};

export function parseTransaction0(
  signature: string,
  tx: ParsedTransactionWithMeta
): RaydiumEventData[] {
  if (tx?.meta?.err) {
    console.log(`\t skip failed transaction. ${signature}`);
    return [];
  }

  const blockTime = tx?.blockTime;
  const slot = tx?.slot;
  const instructions = tx?.transaction.message.instructions!;

  if (instructions.length === 0) {
    console.log(`\t❌ no instructions found. ${signature}`);
    return [];
  }

  if (tx?.meta?.innerInstructions?.length === 0) {
    console.log(`\t❌ no inner instructions found. ${signature}`);
    return [];
  }

  const result: RaydiumEventData[] = [];

  instructions.forEach((ix, index) => {
    if (
      ix.programId.toBase58() === config.programId.toBase58() &&
      "data" in ix
    ) {
      const instruction = decodeInstruction(ix?.data);
      if (instruction) {
        const eventData = {
          instruction,
          accounts: ix.accounts,
          slot: slot!,
          blockTime: blockTime!,
          signature,
          eventType: "",
          data: {},
        };
        // this ix is from raydium
        buildEventFromInstruction(
          eventData,
          index,
          tx?.meta?.innerInstructions!
        );
        console.log(
          `\t${eventData.eventType} ${eventData.instruction.name} found.`
        );
        result.push(eventData);
      }
    }
  });

  tx?.meta?.innerInstructions?.forEach((innerIx, innerIndex) => {
    const ixs = innerIx.instructions;
    for (let i = 0; i < ixs.length; i++) {
      const subIx = ixs[i]!;
      if (
        subIx.programId.toBase58() === config.programId.toBase58() &&
        "data" in subIx
      ) {
        const instruction = decodeInstruction(subIx?.data);
        if (instruction) {
          // this ix is from raydium
          const eventData = {
            instruction,
            accounts: subIx.accounts,
            slot: slot!,
            blockTime: blockTime!,
            signature,
            eventType: "",
            data: {},
          };
          buildEventFromNestedInstruction(eventData, ixs[i + 1]!);
          console.log(
            `\t${eventData.eventType} ${eventData.instruction.name} found.`
          );
          result.push(eventData);
        }
      }
    }
  });
  return result;
}

/**
 * Parse a transaction and return the events
 * @param signature - The signature of the transaction
 * @param conn - The connection to the Solana cluster
 * @param platformConfigAddress - The address of the platform config
 * @returns The events found in the transaction
 */
export async function parseTransaction(
  signature: string,
  conn: Connection,
  platformConfigAddress?: string
): Promise<RaydiumEventData[]> {
  console.log(`🚀 start processing: ${signature}`);
  const tx = await conn.getParsedTransaction(signature, {
    maxSupportedTransactionVersion: 0,
    commitment: "confirmed",
  });

  if (!tx) {
    throw new Error(`🤚 Transaction ${signature} not found`);
  }

  let result = parseTransaction0(signature, tx);

  if (platformConfigAddress) {
    result = result.filter((event) => {
      const accounts = event.accounts;
      return accounts.some((account) =>
        account.toBase58().includes(platformConfigAddress)
      );
    });
  }

  return result;
}

function buildEventFromInstruction(
  data: RaydiumEventData,
  index: number,
  innerInstructions: ParsedInnerInstruction[]
): RaydiumEventData {
  innerInstructions.forEach((innerIx, innerIndex) => {
    if (innerIx.index === index) {
      innerIx.instructions.forEach((subIx, subIndex) => {
        if (
          subIx.programId.toBase58() === config.programId.toBase58() &&
          "data" in subIx
        ) {
          const event = decodeCPIEvent(subIx?.data);
          if (event) {
            data.eventType = event.name;
            data.data = event.data;
          }
        }
      });
    }
  });
  return data;
}

function buildEventFromNestedInstruction(
  data: RaydiumEventData,
  subInstruction: ParsedInstruction | PartiallyDecodedInstruction
): RaydiumEventData {
  if (
    subInstruction.programId.toBase58() === config.programId.toBase58() &&
    "data" in subInstruction
  ) {
    const event = decodeCPIEvent(subInstruction?.data);
    if (event) {
      data.eventType = event.name;
      data.data = event.data;
    }
  }
  return data;
}

export function decodeInstruction(data: string): Instruction | null {
  let buffer = Buffer.from(bs58.decode(data));
  return coder.instruction.decode(buffer);
}

export function decodeCPIEvent(
  data: string
): { name: string; data: object } | null {
  const rawData = bs58.decode(data);
  const base64Data = base64.encode(rawData.subarray(8));
  return coder.events.decode(base64Data);
}
