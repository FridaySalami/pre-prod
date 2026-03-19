import { fail, type Actions } from '@sveltejs/kit';
import { writeFile, unlink, access, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

export const actions: Actions = {
    default: async ({ request }) => {
        const formData = await request.formData();
        const oldFile = formData.get('oldReport') as File;
        const newFile = formData.get('newReport') as File;

        if (!oldFile || !newFile) {
            return fail(400, { missing: true });
        }

        // Generate unique temp filenames
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(7);
        const oldFilePath = join(tmpdir(), `old_report_${timestamp}_${randomSuffix}.csv`);
        const newFilePath = join(tmpdir(), `new_report_${timestamp}_${randomSuffix}.csv`);
        const outputExcelPath = join(tmpdir(), `comparison_report_${timestamp}_${randomSuffix}.xlsx`);

        try {
            // Write files to temp dir
            const oldBuffer = Buffer.from(await oldFile.arrayBuffer());
            const newBuffer = Buffer.from(await newFile.arrayBuffer());
            
            await writeFile(oldFilePath, oldBuffer);
            await writeFile(newFilePath, newBuffer);

            // Execute Python script
            const scriptPath = join(process.cwd(), 'scripts', 'compare-sales-reports.py');
            
            // Determine python executable
            let pythonPath = 'python3';
            const venvPath = join(process.cwd(), '.venv', 'bin', 'python3');
            
            try {
                 await access(venvPath);
                 pythonPath = venvPath;
            } catch (e) {
                 // venv python not found, fallback to system python3
            }

            // Increase max buffer for large outputs (default is 1MB, let's bump to 10MB)
            const { stdout, stderr } = await execPromise(
                `"${pythonPath}" "${scriptPath}" "${oldFilePath}" "${newFilePath}" --output-excel "${outputExcelPath}"`, 
                { maxBuffer: 10 * 1024 * 1024 }
            );

            if (stderr) {
                console.error('Python script stderr:', stderr);
            }
            
            // Clean up temp output files immediately
            await unlink(oldFilePath).catch(() => {});
            await unlink(newFilePath).catch(() => {});

            // Read the generated Excel file if it exists
            let excelBase64 = null;
            try {
                const excelBuffer = await readFile(outputExcelPath);
                excelBase64 = excelBuffer.toString('base64');
                await unlink(outputExcelPath).catch(() => {});
            } catch (e) {
                console.warn('Failed to read excel output:', e);
            }

            try {
                const data = JSON.parse(stdout);
                if (data.error) {
                    return fail(400, { error: data.error });
                }
                return { success: true, analysis: data, excelReport: excelBase64 };
            } catch (e) {
                console.error('Failed to parse JSON output:', stdout);
                return fail(500, { error: 'Failed to process analysis results. The script did not return valid JSON.' });
            }

        } catch (err) {
            console.error('Error processing files:', err);
             // Cleanup if error
            try { await unlink(oldFilePath).catch(() => {}); } catch {}
            try { await unlink(newFilePath).catch(() => {}); } catch {}
            try { await unlink(outputExcelPath).catch(() => {}); } catch {}
            
            return fail(500, { error: 'Internal server error processing files' });
        }
    }
};
