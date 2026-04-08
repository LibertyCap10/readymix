/**
 * Aurora PostgreSQL Client — RDS Data API wrapper with local PG fallback.
 *
 * In AWS: uses the RDS Data API (no VPC, no connection pool).
 * Locally: when USE_LOCAL_PG=true, connects to a Docker Postgres via the pg driver.
 *
 * Exports:
 *   query(sql, parameters)     — execute a single SQL statement
 *   transaction(statements)    — execute multiple statements in a transaction
 *   param(name, value)         — build a typed Data API parameter
 */

// Check at call time, not module load time (SAM local env var timing)
function isLocal() { return process.env.USE_LOCAL_PG === 'true'; }

// Lazy-initialized clients
let _pgPool = null;
let _rdsClient = null;

async function getPgPool() {
  if (!_pgPool) {
    const pg = await import('pg');
    const Pool = pg.default?.Pool ?? pg.Pool;
    _pgPool = new Pool({ connectionString: process.env.PG_CONNECTION_STRING });
  }
  return _pgPool;
}

async function getRdsClient() {
  if (!_rdsClient) {
    const { RDSDataClient } = await import('@aws-sdk/client-rds-data');
    _rdsClient = new RDSDataClient({});
  }
  return _rdsClient;
}

function getClusterArn() { return process.env.AURORA_CLUSTER_ARN; }
function getSecretArn()  { return process.env.AURORA_SECRET_ARN; }
function getDatabase()   { return process.env.AURORA_DATABASE || 'readymix'; }

// ── Named param → positional param conversion for pg ─────────────────────

function convertParams(sql, parameters) {
  const values = [];
  let convertedSql = sql;
  for (const p of parameters) {
    values.push(extractParamValue(p));
    convertedSql = convertedSql.replace(new RegExp(`:${p.name}\\b`, 'g'), `$${values.length}`);
  }
  return { sql: convertedSql, values };
}

function extractParamValue(p) {
  const v = p.value;
  if (v.isNull) return null;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.longValue !== undefined) return v.longValue;
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  return null;
}

// ── Execute a single SQL statement ───────────────────────────────────────

export async function query(sql, parameters = []) {
  if (isLocal()) {
    const pool = await getPgPool();
    const { sql: pgSql, values } = convertParams(sql, parameters);
    const result = await pool.query(pgSql, values);
    return { rows: result.rows, rowCount: result.rowCount };
  }

  const client = await getRdsClient();
  const { ExecuteStatementCommand } = await import('@aws-sdk/client-rds-data');
  const result = await client.send(new ExecuteStatementCommand({
    resourceArn: getClusterArn(),
    secretArn:   getSecretArn(),
    database:    getDatabase(),
    sql,
    parameters,
    includeResultMetadata: true,
  }));

  return formatResult(result);
}

// ── Execute multiple statements in a transaction ─────────────────────────

export async function transaction(statements) {
  if (isLocal()) {
    const pool = await getPgPool();
    const pgClient = await pool.connect();
    try {
      await pgClient.query('BEGIN');
      const results = [];
      for (const { sql, parameters = [] } of statements) {
        const { sql: pgSql, values } = convertParams(sql, parameters);
        const result = await pgClient.query(pgSql, values);
        results.push({ rows: result.rows, rowCount: result.rowCount });
      }
      await pgClient.query('COMMIT');
      return results;
    } catch (err) {
      await pgClient.query('ROLLBACK');
      throw err;
    } finally {
      pgClient.release();
    }
  }

  const client = await getRdsClient();
  const {
    ExecuteStatementCommand,
    BeginTransactionCommand,
    CommitTransactionCommand,
    RollbackTransactionCommand,
  } = await import('@aws-sdk/client-rds-data');

  const { transactionId } = await client.send(new BeginTransactionCommand({
    resourceArn: getClusterArn(),
    secretArn:   getSecretArn(),
    database:    getDatabase(),
  }));

  try {
    const results = [];
    for (const { sql, parameters = [] } of statements) {
      const result = await client.send(new ExecuteStatementCommand({
        resourceArn: getClusterArn(),
        secretArn:   getSecretArn(),
        database:    getDatabase(),
        sql,
        parameters,
        transactionId,
        includeResultMetadata: true,
      }));
      results.push(formatResult(result));
    }

    await client.send(new CommitTransactionCommand({
      resourceArn: getClusterArn(),
      secretArn:   getSecretArn(),
      transactionId,
    }));

    return results;
  } catch (err) {
    await client.send(new RollbackTransactionCommand({
      resourceArn: getClusterArn(),
      secretArn:   getSecretArn(),
      transactionId,
    }));
    throw err;
  }
}

// ── Format Data API response into plain objects ──────────────────────────

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
