/**
 * Aurora PostgreSQL Client — RDS Data API wrapper
 *
 * Provides a clean interface for executing SQL against Aurora Serverless v2
 * via the RDS Data API. No VPC, no connection pool, no pg driver needed.
 *
 * Exports:
 *   query(sql, parameters)     — execute a single SQL statement
 *   transaction(statements)    — execute multiple statements in a transaction
 *   param(name, value)         — build a typed Data API parameter
 */

import {
  RDSDataClient,
  ExecuteStatementCommand,
  BeginTransactionCommand,
  CommitTransactionCommand,
  RollbackTransactionCommand,
} from '@aws-sdk/client-rds-data';

const client = new RDSDataClient({});

const CLUSTER_ARN = process.env.AURORA_CLUSTER_ARN;
const SECRET_ARN  = process.env.AURORA_SECRET_ARN;
const DATABASE    = process.env.AURORA_DATABASE || 'readymix';

// ── Execute a single SQL statement ───────────────────────────────────────

export async function query(sql, parameters = []) {
  const result = await client.send(new ExecuteStatementCommand({
    resourceArn: CLUSTER_ARN,
    secretArn:   SECRET_ARN,
    database:    DATABASE,
    sql,
    parameters,
    includeResultMetadata: true,
  }));

  return formatResult(result);
}

// ── Execute multiple statements in a transaction ─────────────────────────

export async function transaction(statements) {
  const { transactionId } = await client.send(new BeginTransactionCommand({
    resourceArn: CLUSTER_ARN,
    secretArn:   SECRET_ARN,
    database:    DATABASE,
  }));

  try {
    const results = [];
    for (const { sql, parameters = [] } of statements) {
      const result = await client.send(new ExecuteStatementCommand({
        resourceArn: CLUSTER_ARN,
        secretArn:   SECRET_ARN,
        database:    DATABASE,
        sql,
        parameters,
        transactionId,
        includeResultMetadata: true,
      }));
      results.push(formatResult(result));
    }

    await client.send(new CommitTransactionCommand({
      resourceArn: CLUSTER_ARN,
      secretArn:   SECRET_ARN,
      transactionId,
    }));

    return results;
  } catch (err) {
    await client.send(new RollbackTransactionCommand({
      resourceArn: CLUSTER_ARN,
      secretArn:   SECRET_ARN,
      transactionId,
    }));
    throw err;
  }
}

// ── Format Data API response into plain objects ──────────────────────────
// The Data API returns typed fields like { stringValue: "foo" }.
// This converts them to plain { column_name: "foo" } objects.

function formatResult(result) {
  if (!result.columnMetadata || !result.records) {
    return { rows: [], rowCount: result.numberOfRecordsUpdated || 0 };
  }

  const columns = result.columnMetadata.map(col => col.name);

  const rows = result.records.map(record =>
    Object.fromEntries(
      record.map((field, i) => [columns[i], extractValue(field)])
    )
  );

  return { rows, rowCount: rows.length };
}

function extractValue(field) {
  if (field.isNull)                       return null;
  if (field.stringValue !== undefined)    return field.stringValue;
  if (field.longValue !== undefined)      return field.longValue;
  if (field.doubleValue !== undefined)    return field.doubleValue;
  if (field.booleanValue !== undefined)   return field.booleanValue;
  if (field.blobValue !== undefined)      return field.blobValue;
  if (field.arrayValue !== undefined)     return field.arrayValue;
  return null;
}

// ── Parameter helpers ────────────────────────────────────────────────────
// The Data API requires typed parameters. This helper makes it less verbose.

export function param(name, value) {
  if (value === null || value === undefined) {
    return { name, value: { isNull: true } };
  }
  if (typeof value === 'string') {
    return { name, value: { stringValue: value } };
  }
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return { name, value: { longValue: value } };
    }
    return { name, value: { doubleValue: value } };
  }
  if (typeof value === 'boolean') {
    return { name, value: { booleanValue: value } };
  }
  return { name, value: { stringValue: String(value) } };
}
