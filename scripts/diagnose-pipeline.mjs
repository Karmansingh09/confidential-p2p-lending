import './fix-undici-dispatcher.mjs';
import pino from 'pino';
import { resolve } from 'node:path';
import { CompactConfig } from '../node_modules/@openzeppelin/compact-deployer/dist/config/compact-config.js';
import { Artifact } from '../node_modules/@openzeppelin/compact-deployer/dist/loaders/artifact.js';
import { ConstructorArgs } from '../node_modules/@openzeppelin/compact-deployer/dist/loaders/args.js';
import { SigningKey } from '../node_modules/@openzeppelin/compact-deployer/dist/loaders/signing-key.js';
import { ProofServer } from '../node_modules/@openzeppelin/compact-deployer/dist/providers/proof-server.js';
import { applyNetwork } from '../node_modules/@openzeppelin/compact-deployer/dist/providers/network.js';
import { buildProviders } from '../node_modules/@openzeppelin/compact-deployer/dist/providers/build.js';
import { WalletHandler } from '../node_modules/@openzeppelin/compact-deployer/dist/wallet/handler.js';
import { resolveSeed } from '../node_modules/@openzeppelin/compact-deployer/dist/wallet/seeds.js';
import { syncAndVerifyFunds, DEFAULT_SYNC_TIMEOUT_MS } from '../node_modules/@openzeppelin/compact-deployer/dist/services/wallet-sync.js';
import { createUnprovenDeployTx } from '@midnight-ntwrk/midnight-js-contracts';
import { formatError } from '../node_modules/@openzeppelin/compact-deployer/dist/services/error-format.js';

const logger = pino({ level: 'info' });

async function runDiagnostic() {
  console.log("=== STEP 1: Load Compact Configuration ===");
  const config = await CompactConfig.load('./compact.toml');
  const networkName = 'preprod';
  const network = config.network(networkName);
  const contract = config.contract('ConfidentialP2PLending');
  console.log("Network:", networkName);
  console.log("Indexer HTTP:", network.indexer);
  console.log("Node RPC:", network.node);

  console.log("\n=== STEP 2: Load Deployer Seed (In-Memory Only) ===");
  const { seed } = await resolveSeed({ seedFile: './secrets/deployer.seed' });
  console.log("Seed loaded successfully into memory (kind:", seed.kind, ")");

  console.log("\n=== STEP 3: Start Proof Server Container ===");
  const proofServer = await ProofServer.start({ network, logger });
  console.log("Proof Server running at:", proofServer.url);

  let walletHandler;
  try {
    console.log("\n=== STEP 4: Build & Sync Wallet from Cache ===");
    const { env } = applyNetwork(network, proofServer.url);
    walletHandler = await WalletHandler.build(logger, env, seed, {
      rootDir: config.rootDir,
      syncTimeoutMs: DEFAULT_SYNC_TIMEOUT_MS,
      syncBatchSize: network.sync_batch_size ?? 5000,
    });

    console.log("Starting wallet provider...");
    await walletHandler.provider.start(false);

    await syncAndVerifyFunds({
      wallet: walletHandler.provider,
      timeoutMs: DEFAULT_SYNC_TIMEOUT_MS,
      logger,
      onCheckpoint: () => walletHandler.saveCache(),
    });
    console.log("Wallet synchronized successfully.");

    console.log("\n=== STEP 5: Load Contract Artifact, Signing Key, and Args ===");
    const signingKey = await SigningKey.load(config.rootDir, contract.signing_key_file);
    console.log("Signing key loaded successfully.");

    const artifact = await Artifact.load({
      rootDir: config.rootDir,
      artifactsDir: config.artifactsDir,
      artifact: contract.artifact,
      contractName: 'ConfidentialP2PLending',
      witnesses: contract.witnesses,
    });
    console.log("Artifact loaded:", artifact.circuitNames.length, "circuits");

    const args = await ConstructorArgs.load(contract, config.rootDir, undefined, undefined, artifact.artifactPath);
    console.log("Constructor args loaded:", args.length, "arguments");

    console.log("\n=== STEP 6: Build Providers & Create Unproven Deploy Transaction ===");
    const providers = buildProviders({
      env,
      wallet: walletHandler.provider,
      contractName: 'ConfidentialP2PLending',
      contract,
      zkConfigPath: artifact.zkConfigPath,
      rootDir: config.rootDir,
      privateStateSecret: seed.value,
    });

    const unprovenDeploy = await createUnprovenDeployTx(providers, {
      compiledContract: artifact.compiledContract,
      signingKey: signingKey.hex,
      args: args.values,
    });
    console.log("Unproven deploy transaction constructed successfully.");
    console.log("Target contract address:", unprovenDeploy.public.contractAddress);

    console.log("\n=== STEP 7: Proving Transaction (providers.proofProvider.proveTx) ===");
    console.log("Calling proofProvider.proveTx()... (zero-knowledge proof computation)");
    const t0 = Date.now();
    const provenTx = await providers.proofProvider.proveTx(unprovenDeploy.private.unprovenTx);
    console.log(`proveTx SUCCESS in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

    console.log("\n=== STEP 8: Balancing Transaction (providers.walletProvider.balanceTx) ===");
    console.log("Calling walletProvider.balanceTx()... (fee balancing & local signing; NO BROADCAST)");
    const t1 = Date.now();
    const balancedTx = await providers.walletProvider.balanceTx(provenTx);
    console.log(`balanceTx SUCCESS in ${((Date.now() - t1) / 1000).toFixed(1)}s`);
    console.log("Balanced Transaction created successfully!");
    console.log("Result transaction identifiers:", balancedTx.identifiers ? balancedTx.identifiers() : "available");
    console.log("\n*** DIAGNOSTIC RESULT: ALL PRE-SUBMISSION PHASES (PROVE + BALANCE) SUCCEEDED! ***");
    console.log("*** ZERO TRANSACTIONS WERE BROADCAST TO PREPROD ***");

  } catch (err) {
    console.error("\n*** OPERATION FAILED ***");
    console.error("Error constructor:", err?.constructor?.name);
    console.error("Error name:", err?.name);
    console.error("Error _tag:", err?._tag);
    console.error("Error message:", err?.message);
    if (err?.cause) {
      console.error("Cause constructor:", err.cause?.constructor?.name);
      console.error("Cause _tag:", err.cause?._tag);
      console.error("Cause message:", err.cause?.message);
      if (err.cause?.cause) {
        console.error("Nested cause:", err.cause.cause);
      }
    }
    console.error("Formatted via formatError:", formatError(err));
    console.error("Stack trace:\n", err?.stack);
  } finally {
    console.log("\n=== STEP 9: Clean Resource Teardown ===");
    if (walletHandler) {
      try {
        await walletHandler.provider.stop();
        console.log("Wallet stopped.");
      } catch (e) {
        console.warn("Wallet stop warning:", e.message);
      }
    }
    try {
      await proofServer[Symbol.asyncDispose] ? proofServer[Symbol.asyncDispose]() : undefined;
      console.log("Proof server disposed.");
    } catch (e) {
      console.warn("Proof server stop warning:", e.message);
    }
  }
}

await runDiagnostic();
