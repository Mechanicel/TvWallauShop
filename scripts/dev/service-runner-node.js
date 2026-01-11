#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

function log(message) {
  console.log(`[dev-runner] ${message}`);
}

function logError(message) {
  console.error(`[dev-runner] ${message}`);
}

function parseArgs(argv) {
  const args = [...argv];
  const result = { options: {}, command: [], action: null };
  if (args.length === 0) {
    return result;
  }
  result.action = args.shift();
  let commandIndex = args.indexOf('--');
  if (commandIndex === -1) {
    commandIndex = args.length;
  }
  const optionArgs = args.slice(0, commandIndex);
  result.command = commandIndex < args.length ? args.slice(commandIndex + 1) : [];
  for (let i = 0; i < optionArgs.length; i += 2) {
    const key = optionArgs[i];
    const value = optionArgs[i + 1];
    if (!key || !value || !key.startsWith('--')) {
      logError('Invalid arguments. Expected --key value pairs.');
      process.exit(2);
    }
    result.options[key.slice(2)] = value;
  }
  return result;
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function readPid(pidFile) {
  if (!fs.existsSync(pidFile)) {
    return null;
  }
  const value = fs.readFileSync(pidFile, 'utf8').trim();
  if (!value) {
    return null;
  }
  const pid = Number(value);
  return Number.isNaN(pid) ? null : pid;
}

function isProcessAlive(pid) {
  if (!pid) {
    return false;
  }
  if (process.platform === 'win32') {
    const result = spawnSync('tasklist', ['/FI', `PID eq ${pid}`], {
      encoding: 'utf8',
    });
    return result.stdout && result.stdout.includes(String(pid));
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return false;
  }
}

function cleanupFiles(pidFile, metaFile) {
  if (fs.existsSync(pidFile)) {
    fs.unlinkSync(pidFile);
  }
  if (metaFile && fs.existsSync(metaFile)) {
    fs.unlinkSync(metaFile);
  }
}

function waitForExit(pid, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!isProcessAlive(pid)) {
      return true;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200);
  }
  return !isProcessAlive(pid);
}

function stopProcess(pid) {
  if (process.platform === 'win32') {
    const result = spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
      encoding: 'utf8',
    });
    return result.status === 0;
  }
  try {
    process.kill(-pid, 'SIGTERM');
  } catch (error) {
    return false;
  }
  const exited = waitForExit(pid, 5000);
  if (exited) {
    return true;
  }
  try {
    process.kill(-pid, 'SIGKILL');
  } catch (error) {
    return false;
  }
  return waitForExit(pid, 5000);
}

function startService(pidFile, metaFile, command) {
  if (command.length === 0) {
    logError('Missing command for start.');
    process.exit(2);
  }

  const existingPid = readPid(pidFile);
  if (existingPid && isProcessAlive(existingPid)) {
    logError(`Service already running with pid ${existingPid}.`);
    process.exit(1);
  }

  if (existingPid && !isProcessAlive(existingPid)) {
    log('Stale pid file found. Removing.');
    cleanupFiles(pidFile, metaFile);
  }

  ensureDir(pidFile);
  const [cmd, ...args] = command;
  const child = spawn(cmd, args, {
    detached: true,
    stdio: 'ignore',
    shell: process.platform === 'win32',
  });
  child.unref();

  fs.writeFileSync(pidFile, String(child.pid));
  if (metaFile) {
    const metadata = {
      pid: child.pid,
      command: cmd,
      args,
      cwd: process.cwd(),
      startedAt: new Date().toISOString(),
    };
    fs.writeFileSync(metaFile, JSON.stringify(metadata, null, 2));
  }

  log(`Started service with pid ${child.pid}.`);
}

function stopService(pidFile, metaFile) {
  const pid = readPid(pidFile);
  if (!pid) {
    log('Service is not running.');
    cleanupFiles(pidFile, metaFile);
    return;
  }
  if (!isProcessAlive(pid)) {
    log(`Stale pid file for pid ${pid}. Cleaning up.`);
    cleanupFiles(pidFile, metaFile);
    return;
  }

  const stopped = stopProcess(pid);
  if (!stopped) {
    logError(`Failed to stop pid ${pid}.`);
    process.exit(1);
  }
  cleanupFiles(pidFile, metaFile);
  log(`Stopped service with pid ${pid}.`);
}

function statusService(pidFile, metaFile) {
  const pid = readPid(pidFile);
  if (pid && isProcessAlive(pid)) {
    log(`running (pid ${pid})`);
    return;
  }
  if (pid) {
    log(`stopped (stale pid ${pid})`);
    cleanupFiles(pidFile, metaFile);
    return;
  }
  log('stopped');
}

const { action, options, command } = parseArgs(process.argv.slice(2));
const pidFile = options['pid-file'];
const metaFile = options['meta-file'];

if (!action || !pidFile) {
  logError('Usage: service-runner-node.js <start|stop|status> --pid-file <path> [--meta-file <path>] -- <command>');
  process.exit(2);
}

if (action === 'start') {
  startService(pidFile, metaFile, command);
} else if (action === 'stop') {
  stopService(pidFile, metaFile);
} else if (action === 'status') {
  statusService(pidFile, metaFile);
} else {
  logError(`Unknown action: ${action}`);
  process.exit(2);
}
