/**
 * PDF Export Service
 * Handles exporting charts and data to PDF format
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface PdfExportOptions {
  title: string;
  subtitle: string;
  timeRange: string;
  metricName: string;
  chartElement: HTMLElement;
  data?: Array<{ week: string; value: number;[key: string]: any }>;
  statisticalAnalysis?: {
    primaryMessage?: string;
    keyFindings?: string[];
    bestWeek?: { week: string; value: string };
    worstWeek?: { week: string; value: string };
  };
  companyName?: string;
}

export class PdfExportService {
  private static readonly COMPANY_NAME = 'Parkers Food Service';
  private static readonly COLORS = {
    primary: '#10b981', // Green
    secondary: '#3b82f6', // Blue
    accent: '#ef4444', // Red
    text: '#374151', // Gray-700
    lightText: '#6b7280' // Gray-500
  };

  /**
   * Export chart and data to PDF
   */
  static async exportToPdf(options: PdfExportOptions): Promise<void> {
    try {
      // Create new PDF document
      const pdf = new jsPDF('l', 'mm', 'a4'); // Landscape orientation
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Add header
      this.addHeader(pdf, options, pageWidth);

      // Capture chart as image
      const chartCanvas = await html2canvas(options.chartElement, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        allowTaint: true
      });

      // Add chart to PDF
      const chartImgData = chartCanvas.toDataURL('image/png');
      const chartWidth = pageWidth - 40; // 20mm margin on each side
      const chartHeight = (chartCanvas.height * chartWidth) / chartCanvas.width;

      pdf.addImage(chartImgData, 'PNG', 20, 50, chartWidth, Math.min(chartHeight, 120));

      let yPosition = 50 + Math.min(chartHeight, 120) + 20;

      // Add statistical analysis if available
      if (options.statisticalAnalysis) {
        yPosition = this.addStatisticalAnalysis(pdf, options.statisticalAnalysis, yPosition, pageWidth);
      }

      // Add data table if space permits
      if (options.data && yPosition < pageHeight - 60) {
        this.addDataTable(pdf, options.data, yPosition, pageWidth, pageHeight);
      }

      // Add footer
      this.addFooter(pdf, pageWidth, pageHeight);

      // Generate filename and save
      const filename = this.generateFilename(options);
      pdf.save(filename);

    } catch (error) {
      console.error('PDF export failed:', error);
      throw new Error('Failed to export PDF. Please try again.');
    }
  }

  /**
   * Add header to PDF
   */
  private static addHeader(pdf: jsPDF, options: PdfExportOptions, pageWidth: number): void {
    // Company name
    pdf.setFontSize(16);
    pdf.setTextColor(this.COLORS.text);
    pdf.text(this.COMPANY_NAME, 20, 20);

    // Report title
    pdf.setFontSize(20);
    pdf.setTextColor(this.COLORS.primary);
    pdf.text(options.title, 20, 35);

    // Subtitle and timeframe
    pdf.setFontSize(12);
    pdf.setTextColor(this.COLORS.lightText);
    pdf.text(`${options.subtitle} | ${options.timeRange}`, 20, 45);

    // Export date (right aligned)
    const exportDate = new Date().toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    pdf.text(`Generated: ${exportDate}`, pageWidth - 20, 20, { align: 'right' });
  }

  /**
   * Add statistical analysis section
   */
  private static addStatisticalAnalysis(
    pdf: jsPDF,
    analysis: NonNullable<PdfExportOptions['statisticalAnalysis']>,
    startY: number,
    pageWidth: number
  ): number {
    let yPos = startY;

    // Section title
    pdf.setFontSize(14);
    pdf.setTextColor(this.COLORS.text);
    pdf.text('Statistical Analysis', 20, yPos);
    yPos += 10;

    // Primary message
    if (analysis.primaryMessage) {
      pdf.setFontSize(11);
      pdf.setTextColor(this.COLORS.text);
      const lines = pdf.splitTextToSize(analysis.primaryMessage, pageWidth - 40);
      pdf.text(lines, 20, yPos);
      yPos += lines.length * 5 + 5;
    }

    // Key findings
    if (analysis.keyFindings && analysis.keyFindings.length > 0) {
      pdf.setFontSize(10);
      pdf.setTextColor(this.COLORS.lightText);
      pdf.text('Key Findings:', 20, yPos);
      yPos += 7;

      analysis.keyFindings.forEach(finding => {
        pdf.setFontSize(9);
        const lines = pdf.splitTextToSize(`• ${finding}`, pageWidth - 50);
        pdf.text(lines, 25, yPos);
        yPos += lines.length * 4 + 2;
      });
      yPos += 5;
    }

    // Best and worst weeks in two columns
    if (analysis.bestWeek || analysis.worstWeek) {
      const midPoint = pageWidth / 2;

      if (analysis.bestWeek) {
        pdf.setFontSize(10);
        pdf.setTextColor(this.COLORS.primary);
        pdf.text('📈 Best Week:', 20, yPos);
        pdf.setFontSize(9);
        pdf.setTextColor(this.COLORS.text);
        pdf.text(`${analysis.bestWeek.week}`, 20, yPos + 6);
        pdf.text(`${analysis.bestWeek.value}`, 20, yPos + 12);
      }

      if (analysis.worstWeek) {
        pdf.setFontSize(10);
        pdf.setTextColor(this.COLORS.accent);
        pdf.text('📉 Worst Week:', midPoint, yPos);
        pdf.setFontSize(9);
        pdf.setTextColor(this.COLORS.text);
        pdf.text(`${analysis.worstWeek.week}`, midPoint, yPos + 6);
        pdf.text(`${analysis.worstWeek.value}`, midPoint, yPos + 12);
      }

      yPos += 20;
    }

    return yPos;
  }

  /**
   * Add data table
   */
  private static addDataTable(
    pdf: jsPDF,
    data: PdfExportOptions['data'],
    startY: number,
    pageWidth: number,
    pageHeight: number
  ): void {
    if (!data || data.length === 0) return;

    let yPos = startY;

    // Section title
    pdf.setFontSize(12);
    pdf.setTextColor(this.COLORS.text);
    pdf.text('Weekly Data', 20, yPos);
    yPos += 10;

    // Table headers
    pdf.setFontSize(9);
    pdf.setTextColor(this.COLORS.text);
    pdf.text('Week', 20, yPos);
    pdf.text('Value', 80, yPos);
    pdf.text('Date Range', 140, yPos);
    yPos += 7;

    // Table data (limit to available space)
    pdf.setFontSize(8);
    pdf.setTextColor(this.COLORS.lightText);

    const maxRows = Math.floor((pageHeight - yPos - 20) / 5);
    const displayData = data.slice(0, maxRows);

    displayData.forEach(row => {
      pdf.text(row.week, 20, yPos);
      pdf.text(row.value.toString(), 80, yPos);
      if (row.weekStartDate) {
        const startDate = new Date(row.weekStartDate).toLocaleDateString('en-GB', {
          month: 'short',
          day: 'numeric'
        });
        pdf.text(startDate, 140, yPos);
      }
      yPos += 5;
    });

    // Add note if data was truncated
    if (data.length > maxRows) {
      pdf.setFontSize(8);
      pdf.setTextColor(this.COLORS.lightText);
      pdf.text(`... and ${data.length - maxRows} more weeks`, 20, yPos + 5);
    }
  }

  /**
   * Add footer
   */
  private static addFooter(pdf: jsPDF, pageWidth: number, pageHeight: number): void {
    pdf.setFontSize(8);
    pdf.setTextColor(this.COLORS.lightText);
    pdf.text(
      'This report was generated automatically from live business data.',
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  /**
   * Generate filename for PDF
   */
  private static generateFilename(options: PdfExportOptions): string {
    const date = new Date().toISOString().split('T')[0];
    const sanitizedTitle = options.title.replace(/[^a-zA-Z0-9]/g, '_');
    const sanitizedMetric = options.metricName.replace(/[^a-zA-Z0-9]/g, '_');

    return `${sanitizedTitle}_${sanitizedMetric}_${options.timeRange.replace(/\s+/g, '_')}_${date}.pdf`;
  }
}
