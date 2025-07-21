#!/usr/bin/env node

/**
 * Weekly Sales Comparison Wrapper
 * Node.js wrapper to run the Python sales comparison script
 */

import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runWeeklySalesComparison() {
    return new Promise((resolve, reject) => {
        console.log('🔄 Starting weekly sales comparison...');
        
        const scriptPath = join(__dirname, 'weekly-sales-comparison.py');
        
        // Check if Python script exists
        if (!existsSync(scriptPath)) {
            reject(new Error('Python script not found: weekly-sales-comparison.py'));
            return;
        }
        
        // Check if CSV files exist
        const week28File = join(__dirname, 'Wk28.csv');
        const week29File = join(__dirname, 'Wk29.csv');
        
        if (!existsSync(week28File)) {
            reject(new Error('Week 28 CSV file not found: Wk28.csv'));
            return;
        }
        
        if (!existsSync(week29File)) {
            reject(new Error('Week 29 CSV file not found: Wk29.csv'));
            return;
        }
        
        // Run Python script
        const pythonProcess = spawn('python3', [scriptPath], {
            cwd: __dirname,
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let output = '';
        let errorOutput = '';
        
        pythonProcess.stdout.on('data', (data) => {
            const chunk = data.toString();
            output += chunk;
            console.log(chunk.trim());
        });
        
        pythonProcess.stderr.on('data', (data) => {
            const chunk = data.toString();
            errorOutput += chunk;
            console.error(chunk.trim());
        });
        
        pythonProcess.on('close', (code) => {
            if (code === 0) {
                console.log('✅ Weekly sales comparison completed successfully');
                
                // Check if report file was created
                const reportFile = join(__dirname, 'weekly_comparison_report.csv');
                if (existsSync(reportFile)) {
                    console.log('📊 Detailed report available: weekly_comparison_report.csv');
                    resolve({
                        success: true,
                        output: output,
                        reportFile: reportFile
                    });
                } else {
                    resolve({
                        success: true,
                        output: output,
                        reportFile: null
                    });
                }
            } else {
                console.error(`❌ Python script failed with exit code ${code}`);
                reject(new Error(`Script failed: ${errorOutput || 'Unknown error'}`));
            }
        });
        
        pythonProcess.on('error', (error) => {
            console.error('❌ Failed to start Python process:', error.message);
            reject(error);
        });
    });
}

// Check if this is the main module
const isMain = import.meta.url === `file://${process.argv[1]}`;

if (isMain) {
    runWeeklySalesComparison()
        .then((result) => {
            console.log('🎉 Weekly sales comparison finished');
        })
        .catch((error) => {
            console.error('💥 Error:', error.message);
            process.exit(1);
        });
}

export { runWeeklySalesComparison };
