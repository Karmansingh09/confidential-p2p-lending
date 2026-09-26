/**
 * STRICTLY READ-ONLY Midnight Wallet SDK Diagnostic Tool.
 *
 * Inspects:
 * 1. Installed Midnight Wallet SDK package versions & APIs.
 * 2. Deployer wallet derivation from ./secrets/deployer.seed (in-memory only).
 * 3. Connection to Midnight Preprod indexer & RPC.
 * 4. Unshielded wallet synchronization & tNIGHT balances.
 * 5. Available NIGHT UTXOs and their on-chain DUST registration status.
 * 6. Current DUST balance & estimated real-time DUST generation.
 * 7. Verification of SDK capability for DUST registration.
 *
 * STRICT SAFETY INVARIANTS:
 * - READ-ONLY ONLY.
 * - ZERO transaction signing or broadcasting.
 * - ZERO calls to submitTransaction, finalizeRecipe, or registerNightUtxosForDustGeneration.
 * - ZERO secrets, mnemonics, private keys, or seed material exposed or printed.
 */

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { mnemonicToSeedSync } from '@scure/bip39';
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import {
  createKeystore,
  PublicKey,
  UnshieldedWallet,
} from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { DustAddress, MidnightBech32m } from '@midnight-ntwrk/wallet-sdk-address-format';
import { InMemoryTransactionHistoryStorage } from '@midnight-ntwrk/wallet-sdk-abstractions';
import { WalletEntrySchema, mergeWalletEntries, WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { LedgerParameters, DustSecretKey, nativeToken } from '@midnight-ntwrk/ledger-v8';
import * as rx from 'rxjs';

const NETWORK_ID = 'preprod';
const INDEXER_HTTP = 'https://indexer.preprod.midnight.network/api/v4/graphql';
const INDEXER_WS = 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws';
const NODE_RPC = 'https://rpc.preprod.midnight.network';
const PROOF_SERVER_URL = process.env.MIDNIGHT_PROOF_SERVER_URL || 'http://localhost:6300';

const EXPECTED_UNSHIELDED_ADDR =
  'mn_addr_preprod13q6475hz94v7m4pemje7a0kzn7dh96edxfsjsdzzpt8yjqhwe3sq3npssm';
const EXPECTED_DUST_ADDR =
  'mn_dust_preprod1wdq6zvnm95w8tjdxlraze2gfwfx0rdl3x3y5fdwuqzhstjn4f58rux64gfh';

function getInstalledVersion(pkgName: string): string {
  try {
    const pkgJsonPath = path.resolve('node_modules', pkgName, 'package.json');
    if (fs.existsSync(pkgJsonPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
      return pkg.version || 'unknown';
    }
  } catch {
    // ignore
  }
  return 'not installed';
}

async function checkProofServer(urlStr: string): Promise<string> {
  return new Promise((resolve) => {
    try {
      const url = new URL(urlStr);
      const req = http.get(
        {
          hostname: url.hostname,
          port: url.port || 6300,
          path: '/',
          timeout: 1500,
        },
        (res) => {
          resolve(`Reachable at ${urlStr} (HTTP ${res.statusCode})`);
        }
      );
      req.on('timeout', () => {
        req.destroy();
        resolve(`Configured (${urlStr}), not reachable / not running`);
      });
      req.on('error', () => {
        resolve(`Configured (${urlStr}), not running (not required for read-only diagnostic)`);
      });
    } catch (e) {
      resolve(`Invalid URL (${urlStr})`);
    }
  });
}

async function runDiagnostic() {
  // 1. Package inventory
  const sdkVersions = {
    '@midnight-ntwrk/wallet-sdk-facade': getInstalledVersion('@midnight-ntwrk/wallet-sdk-facade'),
    '@midnight-ntwrk/wallet-sdk-dust-wallet': getInstalledVersion('@midnight-ntwrk/wallet-sdk-dust-wallet'),
    '@midnight-ntwrk/wallet-sdk-unshielded-wallet': getInstalledVersion('@midnight-ntwrk/wallet-sdk-unshielded-wallet'),
    '@midnight-ntwrk/wallet-sdk-hd': getInstalledVersion('@midnight-ntwrk/wallet-sdk-hd'),
    '@midnight-ntwrk/wallet-sdk-address-format': getInstalledVersion('@midnight-ntwrk/wallet-sdk-address-format'),
    '@midnight-ntwrk/wallet-sdk-indexer-client': getInstalledVersion('@midnight-ntwrk/wallet-sdk-indexer-client'),
    '@midnight-ntwrk/wallet-sdk-node-client': getInstalledVersion('@midnight-ntwrk/wallet-sdk-node-client'),
    '@midnight-ntwrk/wallet-sdk-prover-client': getInstalledVersion('@midnight-ntwrk/wallet-sdk-prover-client'),
    '@midnight-ntwrk/ledger-v8': getInstalledVersion('@midnight-ntwrk/ledger-v8'),
  };

  // 2. Derive deployer wallet in memory (NEVER log secret material)
  const seedPath = path.resolve('secrets', 'deployer.seed');
  if (!fs.existsSync(seedPath)) {
    throw new Error(`Deployer seed file not found at ${seedPath}`);
  }
  const mnemonic = fs.readFileSync(seedPath, 'utf8').trim();
  const seedHex = Buffer.from(mnemonicToSeedSync(mnemonic)).toString('hex');

  const deriveKeyForRole = (seed: string, role: number, account = 0, keyIndex = 0): Uint8Array => {
    const seedBuffer = Buffer.from(seed, 'hex');
    const hdResult = HDWallet.fromSeed(seedBuffer);
    if (hdResult.type !== 'seedOk') throw new Error('HDWallet initialization failed');
    const derivation = hdResult.hdWallet.selectAccount(account).selectRole(role).deriveKeyAt(keyIndex);
    if (derivation.type !== 'keyDerived') throw new Error('Key derivation failed');
    return derivation.key;
  };

  const unshieldedSeed = deriveKeyForRole(seedHex, Roles.NightExternal);
  const dustSeed = deriveKeyForRole(seedHex, Roles.Dust);

  const keystore = createKeystore(unshieldedSeed, NETWORK_ID);
  const publicKey = PublicKey.fromKeyStore(keystore);
  const publicUnshieldedAddress = keystore.getBech32Address().asString();

  const dustSecretKey = DustSecretKey.fromSeed(dustSeed);
  const publicDustAddress = DustAddress.encodePublicKey(NETWORK_ID, dustSecretKey.publicKey);

  // 3. Configure and sync unshielded wallet against Midnight Preprod
  const storage = new InMemoryTransactionHistoryStorage(WalletEntrySchema, mergeWalletEntries);
  const config = {
    networkId: NETWORK_ID,
    indexerClientConnection: {
      indexerHttpUrl: INDEXER_HTTP,
      indexerWsUrl: INDEXER_WS,
    },
    txHistoryStorage: storage,
    costParameters: {
      ledgerParams: LedgerParameters.initialParameters(),
      additionalFeeOverhead: 0n,
      feeBlocksMargin: 5,
    },
  };

  const unshieldedWallet = UnshieldedWallet(config).startWithPublicKey(publicKey);
  await unshieldedWallet.start();

  // Wait for unshielded sync with a 30s timeout
  const unshieldedState = await rx.firstValueFrom(
    unshieldedWallet.state.pipe(
      rx.filter((s) => s.progress.isStrictlyComplete()),
      rx.timeout(30000)
    )
  );

  const nativeTokenRaw = nativeToken().raw;
  const rawNightBalance = unshieldedState.balances[nativeTokenRaw] ?? 0n;
  const formattedTNight = (Number(rawNightBalance) / 1_000_000).toLocaleString('en-US', {
    maximumFractionDigits: 6,
  });

  const availableCoins = unshieldedState.availableCoins.filter(
    (c) => c.utxo.type === nativeTokenRaw
  );
  const nightUtxoCount = availableCoins.length;
  const registeredCount = availableCoins.filter(
    (c) => c.meta.registeredForDustGeneration === true
  ).length;
  const unregisteredCount = availableCoins.filter(
    (c) => c.meta.registeredForDustGeneration === false
  ).length;

  // 4. Initialize Dust wallet state (read-only)
  const dustWallet = DustWallet(config).startWithSeed(
    dustSeed,
    LedgerParameters.initialParameters().dust
  );
  const dustState = await rx.firstValueFrom(dustWallet.state);

  const onChainDustBalance = dustState.balance(new Date());

  // Estimate real-time DUST generation from registered UTXOs
  const nightUtxosWithMeta = availableCoins.map((c) => ({
    ...c.utxo,
    ctime: c.meta.ctime,
    registeredForDustGeneration: c.meta.registeredForDustGeneration,
  }));
  const dustEstimations = dustState.estimateDustGeneration(nightUtxosWithMeta, new Date());
  const totalAccruedDustSpecks = dustEstimations.reduce(
    (acc, curr) => acc + curr.dust.generatedNow,
    0n
  );
  const maxCapSpecks = dustEstimations.reduce((acc, curr) => acc + curr.dust.maxCap, 0n);

  // 5. Proof server check
  const proofServerStatus = await checkProofServer(PROOF_SERVER_URL);

  // 6. Capability verification
  const canDetermineRegistration = typeof unshieldedState.availableCoins[0]?.meta?.registeredForDustGeneration === 'boolean';
  const canPerformRegistration = typeof WalletFacade.prototype.registerNightUtxosForDustGeneration === 'function';

  // 7. Output exactly formatted report
  console.log('=== Midnight Wallet SDK Diagnostic ===');
  console.log(`Network: ${NETWORK_ID} (Midnight Preprod)`);
  console.log('Installed SDK versions:');
  for (const [pkg, ver] of Object.entries(sdkVersions)) {
    console.log(`  - ${pkg}: ${ver}`);
  }
  console.log(`Public unshielded address: ${publicUnshieldedAddress}`);
  console.log(`  (Matches expected: ${publicUnshieldedAddress === EXPECTED_UNSHIELDED_ADDR ? 'YES' : 'NO'})`);
  console.log(`Public DUST address: ${publicDustAddress}`);
  console.log(`  (Matches expected: ${publicDustAddress === EXPECTED_DUST_ADDR ? 'YES' : 'NO'})`);
  console.log(`tNIGHT balance: ${rawNightBalance} specks / base units (${formattedTNight} tNIGHT)`);
  console.log(`NIGHT UTXO count: ${nightUtxoCount}`);
  console.log(`Registered-for-DUST UTXO count: ${registeredCount}`);
  console.log(`Unregistered NIGHT UTXO count: ${unregisteredCount}`);
  console.log(`Current DUST balance: ${onChainDustBalance} Specks`);
  if (registeredCount > 0) {
    console.log(`  (Real-time generated DUST accrued: ${totalAccruedDustSpecks} Specks out of ${maxCapSpecks} Specks max capacity)`);
  }
  console.log(`Wallet sync status: ${unshieldedState.progress.isStrictlyComplete() ? 'SYNCHRONIZED' : 'IN_PROGRESS'}`);
  console.log(`Wallet sync progress: appliedId=${unshieldedState.progress.appliedId}, highestTransactionId=${unshieldedState.progress.highestTransactionId}, isConnected=${unshieldedState.progress.isConnected}`);
  console.log(`Proof server status/config: ${proofServerStatus}`);
  console.log(`Can SDK determine DUST registration state: ${canDetermineRegistration ? 'YES' : 'NO'}`);
  console.log(`Can SDK perform DUST registration with this stack: ${canPerformRegistration ? 'YES' : 'NO'}`);

  // Clean shutdown
  await unshieldedWallet.stop();
}

runDiagnostic().catch((err) => {
  console.error('Diagnostic error:', err);
  process.exit(1);
});
