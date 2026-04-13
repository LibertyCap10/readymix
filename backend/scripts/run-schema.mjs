/**
 * Run Aurora PostgreSQL Schema via RDS Data API
 *
 * Splits schema.sql into individual statements and executes each one.
 * Handles PL/pgSQL blocks ($$..$$), parenthesized blocks (CREATE TABLE),
 * and inline comments.
 *
 * Usage:
 *   AURORA_CLUSTER_ARN="arn:..." AURORA_SECRET_ARN="arn:..." node run-schema.mjs
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

/**
 * Split a SQL file into individual statements.
 * Respects:
 *   - $$ delimited PL/pgSQL blocks
 *   - Parenthesized blocks (CREATE TABLE columns)
 *   - Single-line comments (--)
 *   - String literals ('...')
 */
function splitStatements(sql) {
  const statements = [];
  let current = '';
  let i = 0;
  let inDollarQuote = false;
  let parenDepth = 0;

  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];

    // $$ dollar quoting toggle
    if (ch === '$' && next === '$') {
      current += '$$';
      i += 2;
      inDollarQuote = !inDollarQuote;
      continue;
    }

    // Inside $$ block — consume everything
    if (inDollarQuote) {
      current += ch;
      i++;
      continue;
    }

    // Single-line comment
    if (ch === '-' && next === '-') {
      // Consume to end of line
      let j = i;
      while (j < sql.length && sql[j] !== '\n') j++;
      current += sql.slice(i, j);
      i = j;
      continue;
    }

    // String literal
    if (ch === "'") {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === "'" && sql[j + 1] === "'") { j += 2; continue; }
        if (sql[j] === "'") { j++; break; }
        j++;
      }
      current += sql.slice(i, j);
      i = j;
      continue;
    }

    // Track parentheses depth
    if (ch === '(') { parenDepth++; current += ch; i++; continue; }
    if (ch === ')') { parenDepth--; current += ch; i++; continue; }

    // Semicolon at top level = end of statement
    if (ch === ';' && parenDepth === 0) {
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        statements.push(trimmed);
      }
      current = '';
      i++;
      continue;
    }

    current += ch;
    i++;
  }

  // Remaining text
  const trimmed = current.trim();
  if (trimmed.length > 0 && !trimmed.split('\n').every(l => l.trim().startsWith('--') || l.trim() === '')) {
    statements.push(trimmed);
  }

  return statements;
}

async function runSchema() {
  const schemaPath = resolve(__dirname, '../../database/schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');

  const statements = splitStatements(schema);

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
