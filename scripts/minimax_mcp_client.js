#!/usr/bin/env node
/**
 * Minimal MCP stdio client for MiniMax Coding Plan MCP.
 *
 * Usage:
 *   node scripts/minimax_mcp_client.js web_search '{"query":"OpenClaw"}'
 *   node scripts/minimax_mcp_client.js understand_image '{"prompt":"這張圖是什麼？","image_url":"/path/to/a.png"}'
 */

const { spawn } = require('node:child_process');

function die(msg) {
  console.error(msg);
  process.exit(1);
}

const toolName = process.argv[2];
const jsonArg = process.argv[3];
if (!toolName) die('Missing tool name. Use --list to inspect available MCP tools.');
let toolArgs = {};
if (jsonArg) {
  try { toolArgs = JSON.parse(jsonArg); } catch { die('Third arg must be JSON.'); }
}

// Coding Plan MCP uses a *Coding Plan* API key (not the regular MiniMax model key).
// We accept MINIMAX_CODING_PLAN_API_KEY first, then fall back to MINIMAX_API_KEY.
const MINIMAX_API_KEY = process.env.MINIMAX_CODING_PLAN_API_KEY || process.env.MINIMAX_API_KEY;
const MINIMAX_API_HOST = process.env.MINIMAX_API_HOST || process.env.MINIMAX_CODING_PLAN_API_HOST || 'https://api.minimax.io';
if (!MINIMAX_API_KEY) die('MINIMAX_CODING_PLAN_API_KEY (or MINIMAX_API_KEY) is required in env.');

// --- MCP framing (MiniMax MCP): newline-delimited JSON (NDJSON)
function encode(obj) {
  return `${JSON.stringify(obj)}\n`;
}

class Decoder {
  constructor(onMessage) {
    this.buf = '';
    this.onMessage = onMessage;
  }
  push(chunk) {
    this.buf += chunk.toString('utf8');
    while (true) {
      const idx = this.buf.indexOf('\n');
      if (idx === -1) return;
      const line = this.buf.slice(0, idx).trim();
      this.buf = this.buf.slice(idx + 1);
      if (!line) continue;
      try {
        this.onMessage(JSON.parse(line));
      } catch {
        // ignore non-JSON lines
      }
    }
  }
}

function main() {
  const child = spawn('uvx', ['minimax-coding-plan-mcp', '-y'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      MINIMAX_API_KEY,
      MINIMAX_API_HOST,
    },
  });

  let id = 1;
  const pending = new Map();

  function request(method, params) {
    const reqId = id++;
    const msg = { jsonrpc: '2.0', id: reqId, method, params };
    child.stdin.write(encode(msg));
    return new Promise((resolve, reject) => {
      pending.set(reqId, { resolve, reject, method });
      // hard timeout
      setTimeout(() => {
        if (pending.has(reqId)) {
          pending.delete(reqId);
          reject(new Error(`timeout: ${method}`));
        }
      }, 60000).unref();
    });
  }

  function notify(method, params) {
    const msg = { jsonrpc: '2.0', method, params };
    child.stdin.write(encode(msg));
  }

  const decoder = new Decoder((msg) => {
    if (msg && typeof msg.id !== 'undefined' && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) p.reject(Object.assign(new Error(msg.error.message || 'error'), { error: msg.error }));
      else p.resolve(msg.result);
    }
  });

  child.stdout.on('data', (c) => decoder.push(c));
  child.stderr.on('data', (c) => {
    // keep stderr for debugging but don't spam unless needed
    const s = c.toString('utf8').trim();
    if (s) console.error('[mcp]', s);
  });

  child.on('exit', (code) => {
    if (pending.size > 0) {
      for (const { reject, method } of pending.values()) {
        reject(new Error(`mcp exited (${code}) while waiting for ${method}`));
      }
    }
  });

  (async () => {
    // 1) initialize
    await request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'openclaw-minimax-mcp-client', version: '0.1.0' },
    });
    // MiniMax MCP expects notifications/initialized
    notify('notifications/initialized', {});

    // 2) tools/list (sanity)
    const tools = await request('tools/list', {});

    if (toolName === '--list' || toolName === 'list-tools') {
      process.stdout.write(JSON.stringify(tools, null, 2));
      child.kill();
      return;
    }

    const exists = Array.isArray(tools?.tools)
      ? tools.tools.some((t) => t?.name === toolName)
      : false;
    if (!exists) {
      die(`Tool not found: ${toolName}. Available: ${(tools?.tools || []).map(t => t.name).join(', ')}`);
    }

    // 3) tools/call
    const result = await request('tools/call', {
      name: toolName,
      arguments: toolArgs,
    });

    // Print raw result JSON to stdout
    process.stdout.write(JSON.stringify(result, null, 2));
    child.kill();
  })().catch((e) => {
    console.error(String(e?.stack || e));
    child.kill();
    process.exit(2);
  });
}

main();
