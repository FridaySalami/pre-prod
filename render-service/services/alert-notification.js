/**
 * Alert Notification Service
 * 
 * Handles delivery of alerts via email, webhook, and database notifications
 * Supports different alert frequencies: immediate, hourly, daily
 */

const { SupabaseService } = require('./supabase-client');

class AlertNotificationService {
  constructor() {
    this.supabase = SupabaseService.client;
    this.webhookUrl = process.env.SLACK_WEBHOOK_URL;
    this.fromEmail = process.env.FROM_EMAIL || 'alerts@chefstorecookbook.com';
  }

  /**
   * Process and send notifications for new alerts
   */
  async processAlertNotifications() {
    console.log('📨 Processing alert notifications');

    try {
      // Get unprocessed alerts
      const alerts = await this.getUnprocessedAlerts();

      if (alerts.length === 0) {
        console.log('No unprocessed alerts found');
        return;
      }

      console.log(`Found ${alerts.length} alerts to process`);

      // Group alerts by user and frequency preference
      const groupedAlerts = this.groupAlertsByUserAndFrequency(alerts);

      for (const [userEmail, frequencyGroups] of Object.entries(groupedAlerts)) {
        await this.processUserNotifications(userEmail, frequencyGroups);
      }

      // Mark alerts as processed
      await this.markAlertsAsProcessed(alerts.map(a => a.id));

    } catch (error) {
      console.error('Error processing alert notifications:', error);
    }
  }

  /**
   * Get alerts that haven't been sent yet
   */
  async getUnprocessedAlerts() {
    const { data, error } = await this.supabase
      .from('price_monitoring_alerts')
      .select(`
        *,
        price_monitoring_config!inner(
          alert_types,
          alert_frequency
        )
      `)
      .eq('status', 'active')
      .is('email_sent', false)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching unprocessed alerts:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Group alerts by user email and their frequency preferences
   */
  groupAlertsByUserAndFrequency(alerts) {
    const grouped = {};

    alerts.forEach(alert => {
      const userEmail = alert.user_email;
      const frequency = alert.price_monitoring_config.alert_frequency;

      if (!grouped[userEmail]) {
        grouped[userEmail] = {
          immediate: [],
          hourly: [],
          daily: []
        };
      }

      grouped[userEmail][frequency].push(alert);
    });

    return grouped;
  }

  /**
   * Process notifications for a specific user
   */
  async processUserNotifications(userEmail, frequencyGroups) {
    try {
      // Always send immediate alerts
      if (frequencyGroups.immediate.length > 0) {
        await this.sendImmediateAlerts(userEmail, frequencyGroups.immediate);
      }

      // Check if it's time for hourly/daily alerts
      const now = new Date();
      const shouldSendHourly = this.shouldSendHourlyDigest(now);
      const shouldSendDaily = this.shouldSendDailyDigest(now);

      if (shouldSendHourly && frequencyGroups.hourly.length > 0) {
        await this.sendDigestAlerts(userEmail, frequencyGroups.hourly, 'hourly');
      }

      if (shouldSendDaily && frequencyGroups.daily.length > 0) {
        await this.sendDigestAlerts(userEmail, frequencyGroups.daily, 'daily');
      }

    } catch (error) {
      console.error(`Error processing notifications for ${userEmail}:`, error);
    }
  }

  /**
   * Send immediate alerts
   */
  async sendImmediateAlerts(userEmail, alerts) {
    for (const alert of alerts) {
      await this.sendSingleAlert(userEmail, alert);
    }
  }

  /**
   * Send digest alerts (hourly/daily)
   */
  async sendDigestAlerts(userEmail, alerts, frequency) {
    const subject = `Buy Box Alert Digest - ${alerts.length} ${frequency} alerts`;
    const emailContent = this.generateDigestEmail(alerts, frequency);
    const slackContent = this.generateDigestSlack(alerts, frequency);

    const config = alerts[0].price_monitoring_config;

    if (config.alert_types.includes('email')) {
      await this.sendEmail(userEmail, subject, emailContent);
    }

    if (config.alert_types.includes('webhook')) {
      await this.sendWebhook(slackContent);
    }
  }

  /**
   * Send a single alert notification
   */
  async sendSingleAlert(userEmail, alert) {
    const config = alert.price_monitoring_config;

    try {
      // Send email if configured
      if (config.alert_types.includes('email')) {
        const subject = this.getAlertEmailSubject(alert);
        const content = this.generateAlertEmail(alert);
        await this.sendEmail(userEmail, subject, content);
      }

      // Send webhook/Slack if configured
      if (config.alert_types.includes('webhook')) {
        const slackMessage = this.generateSlackMessage(alert);
        await this.sendWebhook(slackMessage);
      }

      // Mark as sent
      await this.markAlertAsSent(alert.id);

    } catch (error) {
      console.error(`Error sending alert ${alert.id}:`, error);
    }
  }

  /**
   * Generate email subject for alert
   */
  getAlertEmailSubject(alert) {
    const urgency = alert.severity === 'critical' ? '🚨 URGENT' :
      alert.severity === 'high' ? '⚠️ HIGH' : '📊';

    const alertTypeMap = {
      'buy_box_ownership_change': 'Buy Box Status Change',
      'price_threshold_breach': 'Price Change Alert',
      'competitive_reaction': 'Competitor Activity',
      'new_competitor': 'New Competitor Alert'
    };

    return `${urgency} ${alertTypeMap[alert.type] || 'Buy Box Alert'} - ${alert.asin}`;
  }

  /**
   * Generate HTML email content for single alert
   */
  generateAlertEmail(alert) {
    const data = alert.alert_data;
    let details = '';

    switch (alert.type) {
      case 'buy_box_ownership_change':
        details = `
          <div style="background: ${data.current_status ? '#d4edda' : '#f8d7da'}; padding: 15px; border-radius: 5px; margin: 10px 0;">
            <h3>${data.current_status ? '🎉 Buy Box Regained!' : '⚠️ Buy Box Lost!'}</h3>
            <p><strong>ASIN:</strong> ${alert.asin}</p>
            <p><strong>SKU:</strong> ${alert.sku}</p>
            <p><strong>Your Price:</strong> £${data.price_when_lost?.toFixed(2) || 'N/A'}</p>
            <p><strong>Competitor Price:</strong> £${data.competitor_price?.toFixed(2) || 'N/A'}</p>
            <p><strong>Time:</strong> ${new Date(data.timestamp).toLocaleString()}</p>
          </div>
        `;
        break;

      case 'price_threshold_breach':
        details = `
          <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 10px 0;">
            <h3>💰 Significant Price Change</h3>
            <p><strong>ASIN:</strong> ${alert.asin}</p>
            <p><strong>SKU:</strong> ${alert.sku}</p>
            <p><strong>Previous Price:</strong> £${data.previous_price?.toFixed(2)}</p>
            <p><strong>Current Price:</strong> £${data.current_price?.toFixed(2)}</p>
            <p><strong>Change:</strong> ${data.is_increase ? '+' : '-'}${data.price_change_percent?.toFixed(1)}%</p>
            <p><strong>Threshold:</strong> ±${data.threshold}%</p>
          </div>
        `;
        break;

      case 'new_competitor':
        details = `
          <div style="background: #e2e3e5; padding: 15px; border-radius: 5px; margin: 10px 0;">
            <h3>👥 New Competitor Alert</h3>
            <p><strong>ASIN:</strong> ${alert.asin}</p>
            <p><strong>SKU:</strong> ${alert.sku}</p>
            <p><strong>New Competitors:</strong> ${data.new_competitors}</p>
            <p><strong>Total Competitors:</strong> ${data.current_competitor_count}</p>
            <p><strong>Lowest Competitor Price:</strong> £${data.lowest_competitor_price?.toFixed(2) || 'N/A'}</p>
          </div>
        `;
        break;

      default:
        details = `
          <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0;">
            <h3>${alert.message}</h3>
            <p><strong>ASIN:</strong> ${alert.asin}</p>
            <p><strong>SKU:</strong> ${alert.sku}</p>
            <p><strong>Time:</strong> ${new Date(alert.created_at).toLocaleString()}</p>
          </div>
        `;
    }

    return `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #f8f9fa; padding: 20px; border-radius: 10px;">
            <h2 style="color: #333;">Buy Box Alert</h2>
            ${details}
            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd;">
              <p style="font-size: 12px; color: #666;">
                Generated by Buy Box Monitoring System<br>
                Time: ${new Date().toLocaleString()}
              </p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generate Slack message for alert
   */
  generateSlackMessage(alert) {
    const data = alert.alert_data;
    const urgencyEmoji = alert.severity === 'critical' ? '🚨' :
      alert.severity === 'high' ? '⚠️' : '📊';

    let fields = [
      { title: 'ASIN', value: alert.asin, short: true },
      { title: 'SKU', value: alert.sku, short: true }
    ];

    if (alert.type === 'buy_box_ownership_change') {
      fields.push(
        { title: 'Status', value: data.current_status ? 'Won Buy Box 🎉' : 'Lost Buy Box ❌', short: true },
        { title: 'Your Price', value: `£${data.price_when_lost?.toFixed(2) || 'N/A'}`, short: true },
        { title: 'Competitor Price', value: `£${data.competitor_price?.toFixed(2) || 'N/A'}`, short: true }
      );
    }

    return {
      text: `${urgencyEmoji} Buy Box Alert`,
      attachments: [{
        color: alert.severity === 'critical' ? 'danger' :
          alert.severity === 'high' ? 'warning' : 'good',
        title: alert.message,
        fields: fields,
        ts: Math.floor(Date.now() / 1000)
      }]
    };
  }

  /**
   * Send email notification
   */
  async sendEmail(to, subject, htmlContent) {
    // For now, just log the email (you can integrate with SendGrid, AWS SES, etc.)
    console.log(`📧 EMAIL NOTIFICATION:`);
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Content: ${htmlContent.substring(0, 200)}...`);

    // TODO: Integrate with actual email service
    // Example with SendGrid:
    // const msg = {
    //   to: to,
    //   from: this.fromEmail,
    //   subject: subject,
    //   html: htmlContent,
    // };
    // await sgMail.send(msg);

    return true;
  }

  /**
   * Send webhook notification
   */
  async sendWebhook(content) {
    if (!this.webhookUrl) {
      console.log('📢 WEBHOOK NOTIFICATION (no URL configured):');
      console.log(JSON.stringify(content, null, 2));
      return;
    }

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(content)
      });

      if (response.ok) {
        console.log('✅ Webhook sent successfully');
      } else {
        console.error('❌ Webhook failed:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('❌ Webhook error:', error);
    }
  }

  /**
   * Check if we should send hourly digest (every hour at minute 0)
   */
  shouldSendHourlyDigest(now) {
    return now.getMinutes() === 0;
  }

  /**
   * Check if we should send daily digest (every day at 8 AM)
   */
  shouldSendDailyDigest(now) {
    return now.getHours() === 8 && now.getMinutes() === 0;
  }

  /**
   * Mark specific alert as sent
   */
  async markAlertAsSent(alertId) {
    const { error } = await this.supabase
      .from('price_monitoring_alerts')
      .update({
        email_sent: true,
        email_sent_at: new Date().toISOString()
      })
      .eq('id', alertId);

    if (error) {
      console.error('Error marking alert as sent:', error);
    }
  }

  /**
   * Mark multiple alerts as processed
   */
  async markAlertsAsProcessed(alertIds) {
    if (alertIds.length === 0) return;

    const { error } = await this.supabase
      .from('price_monitoring_alerts')
      .update({
        email_sent: true,
        email_sent_at: new Date().toISOString()
      })
      .in('id', alertIds);

    if (error) {
      console.error('Error marking alerts as processed:', error);
    } else {
      console.log(`✅ Marked ${alertIds.length} alerts as processed`);
    }
  }

  /**
   * Generate digest email content
   */
  generateDigestEmail(alerts, frequency) {
    const alertsByType = alerts.reduce((acc, alert) => {
      if (!acc[alert.type]) acc[alert.type] = [];
      acc[alert.type].push(alert);
      return acc;
    }, {});

    let content = `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #f8f9fa; padding: 20px; border-radius: 10px;">
            <h2 style="color: #333;">Buy Box Alert Digest - ${frequency.charAt(0).toUpperCase() + frequency.slice(1)}</h2>
            <p>You have ${alerts.length} alert(s) from your monitored ASINs:</p>
    `;

    Object.entries(alertsByType).forEach(([type, typeAlerts]) => {
      content += `<h3>${type.replace(/_/g, ' ').toUpperCase()}</h3>`;
      typeAlerts.forEach(alert => {
        content += `
          <div style="background: white; padding: 10px; margin: 5px 0; border-left: 4px solid #007bff;">
            <strong>${alert.asin}</strong> - ${alert.message}<br>
            <small style="color: #666;">${new Date(alert.created_at).toLocaleString()}</small>
          </div>
        `;
      });
    });

    content += `
            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd;">
              <p style="font-size: 12px; color: #666;">
                Generated by Buy Box Monitoring System<br>
                Time: ${new Date().toLocaleString()}
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    return content;
  }

  /**
   * Generate digest Slack message
   */
  generateDigestSlack(alerts, frequency) {
    const alertCounts = alerts.reduce((acc, alert) => {
      acc[alert.type] = (acc[alert.type] || 0) + 1;
      return acc;
    }, {});

    const fields = Object.entries(alertCounts).map(([type, count]) => ({
      title: type.replace(/_/g, ' ').toUpperCase(),
      value: count,
      short: true
    }));

    return {
      text: `📊 Buy Box Alert Digest - ${frequency.charAt(0).toUpperCase() + frequency.slice(1)}`,
      attachments: [{
        color: 'good',
        title: `${alerts.length} total alerts`,
        fields: fields,
        ts: Math.floor(Date.now() / 1000)
      }]
    };
  }
}

module.exports = { AlertNotificationService };