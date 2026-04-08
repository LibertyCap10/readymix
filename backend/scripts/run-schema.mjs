/**
 * Run Aurora PostgreSQL Schema
 *
 * Reads database/schema.sql and executes each statement against Aurora
 * via the RDS Data API. Designed for idempotent reruns — continues on
 * errors (e.g., "already exists").
 *
 * Usage:
 *   AURORA_CLUSTER_ARN="arn:..." \
 *   AURORA_SECRET_ARN="arn:..." \
 *   node run-schema.mjs
 *
 * Or, if you've already deployed the SAM stack:
 *   export AURORA_CLUSTER_ARN=$(aws cloudformation describe-stacks \
 *     --stack-name readymix-dashboard-dev \
 *     --query "Stacks[0].Outputs[?OutputKey=='AuroraClusterArn'].OutputValue" \
 *     --output text)
 *   export AURORA_SECRET_ARN=$(aws cloudformation describe-stacks \
 *     --stack-name readymix-dashboard-dev \
 *     --query "Stacks[0].Outputs[?OutputKey=='AuroraSecretArn'].OutputValue" \
 *     --output text)
 *   node run-schema.mjs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import {
  RDSDataClient,
  ExecuteStatementCommand,
} from '@aws-sdk/client-rds-data';

const __dirname = dirname(fileURLToPath(import.meta.url));

const client = new RDSDataClient({ region: process.env.AWS_REGION || 'us-east-1' });

const CLUSTER_ARN = process.env.AURORA_CLUSTER_ARN;
const SECRET_ARN  = process.env.AURORA_SECRET_ARN;
const DATABASE    = 'readymix';

if (!CLUSTER_ARN || !SECRET_ARN) {
  console.error('Missing required environment variables:');
  console.error('  AURORA_CLUSTER_ARN — Aurora cluster ARN');
  console.error('  AURORA_SECRET_ARN  — Secrets Manager secret ARN');
  process.exit(1);
}

async function runSQL(sql) {
  return client.send(new ExecuteStatementCommand({
    resourceArn: CLUSTER_ARN,
    secretArn:   SECRET_ARN,
    database:    DATABASE,
    sql,
  }));
}

async function runSchema() {
  const schemaPath = resolve(__dirname, '../../database/schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');

  // Split on semicolons that are followed by SQL keywords or end-of-file.
  // This avoids splitting inside PL/pgSQL function bodies which contain
  // internal semicolons (e.g., the compute_cycle_time() trigger function).
  const statements = schema
    .split(/;(?=\s*(?:--|CREATE|INSERT|ALTER|DROP|DO|GRANT|REVOKE|SELECT|\s*$))/i)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`Found ${statements.length} SQL statements to execute.\n`);

  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.substring(0, 80).replace(/\n/g, ' ');
    try {
      await runSQL(stmt);
      console.log(`  \u2713 [${i + 1}/${statements.length}] ${preview}...`);
      succeeded++;
    } catch (err) {
      console.error(`  \u2717 [${i + 1}/${statements.length}] ${preview}...`);
      console.error(`    Error: ${err.message}\n`);
      failed++;
    }
  }

  console.log(`\nSchema execution complete: ${succeeded} succeeded, ${failed} failed.`);
}

runSchema().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
