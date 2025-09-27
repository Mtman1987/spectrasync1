import { execa } from 'execa';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import prompts from 'prompts';
import dotenv from 'dotenv';
import killPort from 'kill-port';
import kill from 'tree-kill';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(projectRoot, '.env') });

const PORT = 9002;
// Use environment variable for domain, with a fallback for others
const NGROK_DOMAIN = process.env.NGROK_DOMAIN || 'unostensible-carola-preallied.ngrok-free.dev';

let devProc = null;
let ngrokProc = null;
let vipRefreshProc = null;

function log(message, color = '\x1b[36m') { // Cyan
  console.log(`${color}%s\x1b[0m`, message);
}

function logWarn(message) {
  console.log(`\x1b[33m%s\x1b[0m`, message); // Yellow
}

function logInfo(message) {
  console.log(`\x1b[34m%s\x1b[0m`, message); // Blue
}

async function stopProcesses() {
  log('Stopping development processes...');
  const pidsToKill = [];
  if (devProc && devProc.pid) pidsToKill.push(devProc.pid);
  if (ngrokProc && ngrokProc.pid) pidsToKill.push(ngrokProc.pid);
  if (vipRefreshProc && vipRefreshProc.pid) pidsToKill.push(vipRefreshProc.pid);

  const killPromises = pidsToKill.map(pid => new Promise(resolve => {
    kill(pid, 'SIGKILL', (err) => {
      if (err) {
        logWarn(`Could not kill process ${pid}. It might have already stopped.`);
      }
      resolve();
    });
  }));

  await Promise.all(killPromises);

  devProc = null;
  ngrokProc = null;
  vipRefreshProc = null;
  log('All processes stopped.');
}

function startVipRefreshLoop() {
  if (vipRefreshProc && !vipRefreshProc.killed) {
    return;
  }
  logInfo('Starting VIP refresh loop...');
  vipRefreshProc = execa('npm', ['run', 'refresh:vip'], {
    cwd: projectRoot,
    stdio: 'inherit',
    detached: true, // To allow it to run independently
  });
  vipRefreshProc.unref(); // Don't let this process keep the main script alive
}

function startDevServer(useTunnel) {
  log('Starting dev environment...');

  if (useTunnel) {
    if (!process.env.NGROK_AUTHTOKEN && !NGROK_DOMAIN.endsWith('ngrok-free.dev')) {
        logWarn('Warning: Using a custom ngrok domain usually requires an authtoken.');
        logWarn('You can add it by running `ngrok config add-authtoken <YOUR_TOKEN>`');
    }
    logInfo(`Starting ngrok tunnel for localhost:${PORT}`);
    ngrokProc = execa('ngrok', ['http', `${PORT}`, `--domain=${NGROK_DOMAIN}`], {
      cwd: projectRoot,
      stdio: 'inherit',
    });
  } else {
    logWarn(`Skipping ngrok tunnel (using NEXT_PUBLIC_BASE_URL = ${process.env.NEXT_PUBLIC_BASE_URL})`);
  }

  startVipRefreshLoop();

  devProc = execa('npm', ['run', 'dev:next'], {
    cwd: projectRoot,
    stdio: 'inherit',
  });

  devProc.catch(error => {
    if (!error.isCanceled) {
      logWarn('Dev server process exited unexpectedly.');
    }
  });

  return devProc;
}

async function main() {
  const args = process.argv.slice(2);
  const noKillFlag = args.includes('--no-kill');
  const noTunnelFlag = args.includes('--no-tunnel') || args.includes('-NoTunnel');
  const envBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  const useTunnel = (() => {
    if (noTunnelFlag) return false;
    if (!envBaseUrl) return true;
    return /^(https?:\/\/)?(localhost|127\.0\.0\.1)/.test(envBaseUrl);
  })();

  if (!noKillFlag) {
    try {
      log(`Attempting to free up port ${PORT}...`);
      await killPort(PORT);
      log(`Port ${PORT} is clear.`);
    } catch (e) {
      logWarn(`Could not kill process on port ${PORT}. It might already be free.`);
    }
  }

  // Graceful shutdown
  process.on('SIGINT', async () => {
    await stopProcesses();
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    await stopProcesses();
    process.exit(0);
  });

  while (true) {
    await stopProcesses();
    const devServerProcess = startDevServer(useTunnel);

    try {
      await devServerProcess;
    } catch (e) {
      // This will catch when the user manually stops the dev server (Ctrl+C)
      // or if it crashes.
    }

    const { choice } = await prompts({
      type: 'select',
      name: 'choice',
      message: 'Dev server stopped. What would you like to do?',
      choices: [
        { title: 'Restart', value: 'restart' },
        { title: 'Quit', value: 'quit' },
      ],
      initial: 0,
    });

    if (choice === 'quit') {
      await stopProcesses();
      break;
    }
  }
}

main().catch(err => {
  console.error('An unexpected error occurred:', err);
  process.exit(1);
});