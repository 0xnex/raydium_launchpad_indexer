import type {
  Connection,
  ParsedInnerInstruction,
  ParsedInstruction,
  PartiallyDecodedInstruction,
  PublicKey,
} from "@solana/web3.js";
import { config } from "./config";
import { base64, bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { BorshCoder, type Instruction } from "@coral-xyz/anchor";
import idl from "./launchpad_idl.json";

export type EventType = "PoolCreated" | "Trade";

export type InstructionData = {
  name: string;
  data: { [key: string]: any };
};

export type EventData = {
  instruction: Instruction;
  accounts: PublicKey[];
  signature: string;
  blockTime: number;
  slot: number;
  eventType: string;
  data: object;
};

export type PoolCreatedEvent = {
  poolState: string;
  creator: string;
  config: string;
  baseMintParam: {
    decimals: number;
    name: string;
    symbol: string;
    uri: string;
  };
  curveParam: {
    constant: {
      data: {
        supply: string;
        totalBaseSell: string;
        totalQuoteFundRaising: string;
        migrateType: number;
      };
    };
  };
  vestingParam: {
    totalLockedAmount: number;
    cliffPeriod: number;
    vestingPeriod: number;
  };
};

export type TradeEvent = {
  poolState: string;
  totalBaseSell: string;
  virtualBase: string;
  virtualQuote: string;
  realBaseBefore: string;
  realQuoteBefore: string;
  realBaseAfter: string;
  realQuoteAfter: string;
  amountIn: string;
  amountOut: string;
  protocolFee: string;
  platformFee: string;
  shareFee: string;
  tradingDirection: { Buy: {} } | { Sell: {} };
  poolStatus: { Fund: {} } | { Migrate: {} } | { Trade: {} };
};

const coder = new BorshCoder(idl as any);

const TRADE_IX_NAMES = [
  "buy_exact_out",
  "sell_exact_in",
  "buy_exact_in",
  "sell_exact_out",
];

// 1. instruction from message.instruction
// 2. instruction from innerInstructions

export async function parseTransaction(
  signature: string,
  conn: Connection
): Promise<EventData[]> {
  console.log(`🚀 start processing: ${signature}`);
  const tx = await conn.getParsedTransaction(signature, {
    maxSupportedTransactionVersion: 0,
    commitment: "confirmed",
  });

  if (tx?.meta?.err) {
    console.log(`\t❌failed. ${signature}`);
    return [];
  }

  const blockTime = tx?.blockTime;
  const slot = tx?.slot;
  const instructions = tx?.transaction.message.instructions!;

  if (instructions.length === 0) {
    console.log(`\t❌no instructions found. ${signature}`);
    return [];
  }

  if (tx?.meta?.innerInstructions?.length === 0) {
    console.log(`\t❌no inner instructions found. ${signature}`);
    return [];
  }

  const result: EventData[] = [];

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

function buildEventFromInstruction(
  data: EventData,
  index: number,
  innerInstructions: ParsedInnerInstruction[]
): EventData {
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
  data: EventData,
  subInstruction: ParsedInstruction | PartiallyDecodedInstruction
): EventData {
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
