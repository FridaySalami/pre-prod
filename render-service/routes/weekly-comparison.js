/**
 * Weekly Comparison Route
 * 
 * API endpoint to run weekly sales comparison analysis
 */

const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const router = express.Router();

/**
 * POST /run - Run weekly sales comparison
 */
router.post('/run', async (req, res) => {
    try {
        console.log('🔄 Starting weekly sales comparison analysis...');
        
        // Path to the project root (where the Python script and CSVs are)
        const projectRoot = path.resolve(__dirname, '../../');
        const scriptPath = path.join(projectRoot, 'weekly-sales-comparison.py');
        
        // Check if required files exist
        if (!fs.existsSync(scriptPath)) {
            return res.status(404).json({
                error: 'Python script not found',
                message: 'weekly-sales-comparison.py script is missing',
                scriptPath: scriptPath
            });
        }
        
        const week28File = path.join(projectRoot, 'Wk28.csv');
        const week29File = path.join(projectRoot, 'Wk29.csv');
        
        if (!fs.existsSync(week28File)) {
            return res.status(404).json({
                error: 'Week 28 CSV file not found',
                message: 'Wk28.csv file is missing',
                expectedPath: week28File
            });
        }
        
        if (!fs.existsSync(week29File)) {
            return res.status(404).json({
                error: 'Week 29 CSV file not found',
                message: 'Wk29.csv file is missing',
                expectedPath: week29File
            });
        }
        
        // Run Python script
        const pythonProcess = spawn('python3', [scriptPath], {
            cwd: projectRoot,
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
            console.error('Python stderr:', chunk.trim());
        });
        
        pythonProcess.on('close', (code) => {
            if (code === 0) {
                console.log('✅ Weekly sales comparison completed successfully');
                
                // Check if report file was created
                const reportFile = path.join(projectRoot, 'weekly_comparison_report.csv');
                const reportExists = fs.existsSync(reportFile);
                
                res.json({
                    success: true,
                    message: 'Weekly sales comparison completed successfully',
                    output: output,
                    reportGenerated: reportExists,
                    reportFile: reportExists ? 'weekly_comparison_report.csv' : null,
                    timestamp: new Date().toISOString()
                });
            } else {
                console.error(`❌ Python script failed with exit code ${code}`);
                res.status(500).json({
                    success: false,
                    error: 'Script execution failed',
                    exitCode: code,
                    output: output,
                    errorOutput: errorOutput,
                    timestamp: new Date().toISOString()
                });
            }
        });
        
        pythonProcess.on('error', (error) => {
            console.error('❌ Failed to start Python process:', error.message);
            res.status(500).json({
                success: false,
                error: 'Failed to start Python process',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        });
        
    } catch (error) {
        console.error('❌ Weekly comparison error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /report - Download the latest comparison report
 */
router.get('/report', (req, res) => {
    try {
        const projectRoot = path.resolve(__dirname, '../../');
        const reportFile = path.join(projectRoot, 'weekly_comparison_report.csv');
        
        if (!fs.existsSync(reportFile)) {
            return res.status(404).json({
                error: 'Report not found',
                message: 'Weekly comparison report has not been generated yet. Run /api/weekly-comparison/run first.',
                reportFile: reportFile
            });
        }
        
        // Send the CSV file
        res.download(reportFile, 'weekly_comparison_report.csv', (err) => {
            if (err) {
                console.error('Error sending report file:', err);
                res.status(500).json({
                    error: 'Failed to send report file',
                    message: err.message
                });
            }
        });
        
    } catch (error) {
        console.error('❌ Report download error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

/**
 * GET /status - Check if CSV files are available for comparison
 */
router.get('/status', (req, res) => {
    try {
        const projectRoot = path.resolve(__dirname, '../../');
        const week28File = path.join(projectRoot, 'Wk28.csv');
        const week29File = path.join(projectRoot, 'Wk29.csv');
        const reportFile = path.join(projectRoot, 'weekly_comparison_report.csv');
        const scriptFile = path.join(projectRoot, 'weekly-sales-comparison.py');
        
        const status = {
            week28Available: fs.existsSync(week28File),
            week29Available: fs.existsSync(week29File),
            scriptAvailable: fs.existsSync(scriptFile),
            reportAvailable: fs.existsSync(reportFile),
            canRunComparison: false,
            files: {
                week28: week28File,
                week29: week29File,
                script: scriptFile,
                report: reportFile
            }
        };
        
        status.canRunComparison = status.week28Available && status.week29Available && status.scriptAvailable;
        
        if (status.reportAvailable) {
            const stats = fs.statSync(reportFile);
            status.reportLastModified = stats.mtime.toISOString();
        }
        
        res.json({
            success: true,
            status: status,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Status check error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

module.exports = router;
