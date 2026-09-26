/**
 * Constructor arguments for ConfidentialP2PLending contract deployment.
 *
 * The Compact contract constructor (index.compact L79-99) requires:
 * 1. borrowerPk: Bytes<32>       -> Uint8Array(32)
 * 2. principalAmount: Uint<64>   -> bigint (> 0)
 * 3. interestRate: Uint<16>      -> bigint (1..10000 basis points)
 * 4. termBlocks: Uint<32>        -> bigint (> 0)
 * 5. minThreshold: Uint<64>      -> bigint (> 0)
 */

export default function getArgs() {
  // Real 32-byte public verification key derived locally from deployer wallet
  // (Coin public key / ZswapCoinPublicKey.bytes: 3cd20baf49d3a2156ab48985cc4de72c1b52a2a6c228cb4616190b7d4e44f532)
  const DERIVED_DEPLOYER_COIN_PK = '3cd20baf49d3a2156ab48985cc4de72c1b52a2a6c228cb4616190b7d4e44f532';
  const targetHex = (process.env.BORROWER_PK_HEX || DERIVED_DEPLOYER_COIN_PK).trim().replace(/^0x/i, '');
  const borrowerPk = new Uint8Array(32);
  if (targetHex.length === 64) {
    for (let i = 0; i < 32; i++) {
      borrowerPk[i] = parseInt(targetHex.substring(i * 2, i * 2 + 2), 16);
    }
  } else {
    throw new Error(`[deploy/args.js] BORROWER_PK_HEX must be 64 hex characters; received length ${targetHex.length}`);
  }

  const principal = BigInt(process.env.PRINCIPAL_AMOUNT || '1000000000'); // 1,000 DUST
  const interestRate = BigInt(process.env.INTEREST_RATE_BPS || '500');   // 500 bps (5.00%)
  const termBlocks = BigInt(process.env.TERM_BLOCKS || '1000');          // 1,000 blocks
  const minThreshold = BigInt(process.env.MIN_THRESHOLD || '500000000'); // 500 DUST

  return [borrowerPk, principal, interestRate, termBlocks, minThreshold];
}
