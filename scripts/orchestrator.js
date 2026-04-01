const cron = require('node-cron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Load environment variables from .env file
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

/**
 * Configuration: Map your scripts to cron schedules
 * PREVENTING OVERLAPS: Each job now has a 'running' state.
 */
const jobs = [
    {
        name: 'Amazon Buy Box Monitor (Top 100)',
        command: process.execPath,
        args: [path.join(__dirname, 'monitor-top-100-buybox.js')],
        schedule: '0 * * * *', // Every hour on the hour
        enabled: true,
        running: false,
        timeoutMs: 1000 * 60 * 30 // 30 mins
    },
    {
        name: 'Weekly Sales Comparison',
        command: process.execPath,
        args: [path.join(__dirname, 'run-weekly-comparison.js')],
        schedule: '0 9 * * 1', // Every Monday at 9:00 AM
        enabled: true,
        running: false,
        timeoutMs: 1000 * 60 * 60 // 1 hour
    },
    {
        name: 'Amazon Order Sync',
        command: process.execPath,
        args: [path.join(__dirname, 'cron-sync-items.js')],
        schedule: '15 * * * *', // Every hour at 15 minutes past (e.g. 14:15)
        enabled: true,
        running: false,
        timeoutMs: 1000 * 60 * 20 // 20 mins
    },
    {
        name: 'Amazon Shipping Sync',
        command: process.execPath,
        args: [path.join(__dirname, 'sync-shipping-costs.js')],
        schedule: '0 17 * * *', // Every day at 5:00 PM
        enabled: true,
        running: false,
        timeoutMs: 1000 * 60 * 45 // 45 mins
    }
];

// Ensure logs directory exists
const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

/**
 * Robust sanitization for log filenames
 */
function sanitizeFilename(name) {
    return name.toLowerCase()
        .replace(/[^a-z0-9]/gi, '-') // Replace any non-alphanumeric with hyphen
        .replace(/-+/g, '-')         // Collapse multiple hyphens
        .replace(/^-|-$/g, '');      // Remove leading/trailing hyphens
}

/**
 * Single finalizer to prevent double cleanup from 'error' and 'close'
 */
function finalizeJob(job, logStream, timeout, statusMsg, startTime) {
    if (job._finalized) return;
    job._finalized = true;

    clearTimeout(timeout);
    job.running = false;

    const endTime = new Date();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    const msg = `[${endTime.toISOString()}] [FINISH] ${job.name} - ${statusMsg} - Duration: ${duration}s`;
    
    console.log(msg);
    logStream.write(`${msg}\n\n`);
    logStream.end();
}

function runJob(job) {
    if (job.running) {
        console.warn(`[SKIP] Job "${job.name}" is already running. Skipping to prevent overlap.`);
        return;
    }

    job.running = true;
    job._finalized = false; // Reset for this run
    const startTime = new Date();
    const timestamp = startTime.toISOString();
    console.log(`[${timestamp}] [START] ${job.name}`);

    const safeName = sanitizeFilename(job.name);
    const logPath = path.join(logDir, `${safeName}.log`);
    const logStream = fs.createWriteStream(logPath, { flags: 'a' });

    try {
        const childProcess = spawn(job.command, job.args, {
            cwd: path.join(__dirname, '..'),
            env: { ...process.env, FORCE_COLOR: '1' }
        });

        // Add two-stage timeout protection
        const timeoutMs = job.timeoutMs || 1000 * 60 * 20; // Default 20 mins
        const timeout = setTimeout(() => {
            const timeoutLog = `[TIMEOUT] [${new Date().toISOString()}] Job "${job.name}" exceeded ${timeoutMs}ms. Sending SIGTERM...\n`;
            console.error(timeoutLog.trim());
            logStream.write(timeoutLog);
            
            childProcess.kill('SIGTERM');

            // Stage 2: Force kill after 10 second grace period if still not finalized
            setTimeout(() => {
                if (!job._finalized) {
                    const killLog = `[TIMEOUT] [${new Date().toISOString()}] Job "${job.name}" did not exit after SIGTERM. Sending SIGKILL...\n`;
                    console.error(killLog.trim());
                    logStream.write(killLog);
                    childProcess.kill('SIGKILL');
                }
            }, 10000).unref(); // .unref() allows the orchestrator to exit even if this timer is active
            
        }, timeoutMs);

        // Log to file with prefixes
        childProcess.stdout.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    const formatted = `[STDOUT] [${new Date().toISOString()}] ${line}`;
                    logStream.write(`${formatted}\n`);
                    console.log(`[${job.name}] ${line}`);
                }
            });
        });

        childProcess.stderr.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    const formatted = `[STDERR] [${new Date().toISOString()}] ${line}`;
                    logStream.write(`${formatted}\n`);
                    console.error(`[${job.name}] [ERROR] ${line}`);
                }
            });
        });

        // Handle process-level errors (e.g. file not found, permission denied)
        childProcess.on('error', (err) => {
            const status = `FATAL ERROR (failed to start: ${err.message})`;
            finalizeJob(job, logStream, timeout, status, startTime);
        });

        childProcess.on('close', (code, signal) => {
            const status = code === 0 
                ? 'SUCCESS' 
                : signal 
                    ? `FAILED (signal ${signal})` 
                    : `FAILED (exit code ${code})`;
            
            finalizeJob(job, logStream, timeout, status, startTime);
        });

    } catch (err) {
        console.error(`[UNEXPECTED FAIL] Job "${job.name}" crashed: ${err.message}`);
        job.running = false;
        logStream.write(`[CRASH] [${new Date().toISOString()}] ${err.stack}\n`);
        logStream.end();
    }
}

// Initialize and Validate Cron Jobs
console.log('--- Amazon Operations Orchestrator Initializing ---');
console.log(`Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);

jobs.forEach((job) => {
    if (!job.enabled) return;

    // Validate cron expression
    if (!cron.validate(job.schedule)) {
        console.error(`[CRITICAL] Invalid cron schedule for "${job.name}": "${job.schedule}"`);
        return;
    }

    console.log(`Scheduled: "${job.name}" -> [${job.schedule}]`);
    
    // Explicitly set timezone if needed (defaulting to system timezone)
    cron.schedule(job.schedule, () => runJob(job), {
        scheduled: true,
        timezone: "Europe/London" 
    });
});

console.log(`Monitoring ${jobs.filter(j => j.enabled).length} active jobs.`);

// Cleanup on exit
process.on('SIGINT', () => {
    console.log('\nReceived SIGINT. Shutting down orchestrator...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\nReceived SIGTERM. Shutting down orchestrator...');
    process.exit(0);
});
