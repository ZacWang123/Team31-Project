import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

const EMAIL_USER = process.env.EMAIL_USER || 'team31qut736@gmail.com';
const EMAIL_PASS = process.env.EMAIL_PASS || 'xbcr jiwl jtyw krst';

// Credentials (loads from .env or falls back to standard values)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: EMAIL_USER, 
    pass: EMAIL_PASS // Generated via Google Account > Security > App passwords
  }
});

/**
 * 1. STORE LEAD TEMPLATE (Operational, compact & scannable for travel agents)
 */
function generateStoreLeadEmailHtml(payload) {
  const user = payload?.user || {};
  const packages = payload?.savedPackages || [];
  const timestamp = payload?.timestamp
    ? new Date(payload.timestamp).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })
    : new Date().toLocaleString('en-AU');

  const packageRows = packages.length > 0
    ? packages.map(pkg => `
        <tr style="border-bottom: 1px solid #edf2f7;">
          <td style="padding: 10px 12px; font-weight: bold; color: #2d3748; font-size: 13px; font-family: Arial, sans-serif;">
            ${pkg.packageName || pkg.title || 'Travel Package'}
          </td>
          <td style="padding: 10px 12px; color: #4a5568; font-size: 13px; font-family: Arial, sans-serif;">
            ${pkg.destination || 'N/A'}${pkg.country ? `, ${pkg.country}` : ''}
          </td>
          <td style="padding: 10px 12px; color: #df1d22; font-weight: bold; font-size: 13px; text-align: right; font-family: Arial, sans-serif;">
            ${pkg.fromPrice ? `$${Number(pkg.fromPrice).toLocaleString()} AUD` : 'Inquire'}
          </td>
        </tr>
      `).join('')
    : `<tr><td colspan="3" style="padding: 12px; color: #718096; text-align: center; font-style: italic; font-family: Arial, sans-serif;">No specific packages shortlisted.</td></tr>`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Store Lead</title>
    </head>
    <body style="font-family: Arial, Helvetica, sans-serif; background-color: #f4f6f8; margin: 0; padding: 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
        
        <!-- COMPACT HEADER BAR -->
        <tr>
          <td style="background-color: #1a202c; padding: 14px 20px; color: #ffffff;">
            <table width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td style="font-size: 12px; font-weight: bold; letter-spacing: 1px; color: #e2e8f0; text-transform: uppercase; font-family: Arial, sans-serif;">
                  FLIGHT CENTRE STORE LEAD
                </td>
                <td align="right" style="font-size: 11px; color: #a0aec0; font-family: Arial, sans-serif;">
                  ${timestamp}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ACTION REQUIRED BANNER -->
        <tr>
          <td style="background-color: #fff5f5; border-bottom: 2px solid #df1d22; padding: 12px 20px;">
            <p style="margin: 0; color: #9b2c2c; font-size: 13px; font-weight: bold; font-family: Arial, sans-serif;">
              Action Required: New Web Enquiry Assigned to Store
            </p>
          </td>
        </tr>

        <!-- MAIN CONTENT -->
        <tr>
          <td style="padding: 20px;">
            
            <!-- CUSTOMER DETAILS CARD -->
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #cbd5e0; border-radius: 6px; padding: 14px; margin-bottom: 20px;">
              <tr>
                <td>
                  <p style="margin: 0 0 8px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #718096; font-weight: bold; font-family: Arial, sans-serif;">Customer Details</p>
                  <p style="margin: 2px 0; font-size: 15px; color: #1a202c; font-weight: bold; font-family: Arial, sans-serif;">${user.name || 'Anonymous User'}</p>
                  <p style="margin: 2px 0; font-size: 13px; color: #4a5568; font-family: Arial, sans-serif;">
                    📞 Phone: <a href="tel:${user.phone}" style="color: #df1d22; font-weight: bold; text-decoration: none;">${user.phone || 'Not provided'}</a>
                  </p>
                  <p style="margin: 2px 0; font-size: 13px; color: #4a5568; font-family: Arial, sans-serif;">
                    ✉️ Email: <a href="mailto:${user.email}" style="color: #df1d22; text-decoration: underline;">${user.email || 'Not provided'}</a>
                  </p>
                </td>
                <td align="right" style="vertical-align: top;">
                  ${user.email ? `
                    <a href="mailto:${user.email}?subject=Your Flight Centre Travel Inquiry" style="background-color: #df1d22; color: #ffffff; text-decoration: none; padding: 8px 12px; font-size: 12px; font-weight: bold; border-radius: 4px; display: inline-block; font-family: Arial, sans-serif;">
                      Reply to Client
                    </a>
                  ` : ''}
                </td>
              </tr>
            </table>

            <!-- SHORTLIST SUMMARY TABLE -->
            <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: bold; color: #2d3748; text-transform: uppercase; letter-spacing: 0.5px; font-family: Arial, sans-serif;">
              Shortlisted Packages (${packages.length})
            </p>

            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border: 1px solid #e2e8f0; border-collapse: collapse; margin-bottom: 20px;">
              <thead>
                <tr style="background-color: #edf2f7; text-align: left;">
                  <th style="padding: 8px 12px; font-size: 11px; color: #4a5568; text-transform: uppercase; font-family: Arial, sans-serif;">Package</th>
                  <th style="padding: 8px 12px; font-size: 11px; color: #4a5568; text-transform: uppercase; font-family: Arial, sans-serif;">Destination</th>
                  <th style="padding: 8px 12px; font-size: 11px; color: #4a5568; text-transform: uppercase; text-align: right; font-family: Arial, sans-serif;">Price</th>
                </tr>
              </thead>
              <tbody>
                ${packageRows}
              </tbody>
            </table>

            <!-- AGENT GUIDANCE -->
            <div style="background-color: #edf2f7; padding: 10px 12px; border-radius: 4px; font-size: 12px; color: #4a5568; font-family: Arial, sans-serif;">
              <strong>Agent Tip:</strong> Contact the customer within 24 hours to review their package selections and generate a custom quote.
            </div>

          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background-color: #f7fafc; border-top: 1px solid #e2e8f0; padding: 10px 20px; font-size: 11px; color: #a0aec0; text-align: center; font-family: Arial, sans-serif;">
            Automated Store Lead Notification • Team 31 Flight Centre Concierge
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

/**
 * 2. CUSTOMER TEMPLATE (Rich, visual itinerary brochure)
 */
function generateCustomerEmailHtml(payload) {
  const user = payload?.user || {};
  const packages = payload?.savedPackages || [];
  const timestamp = payload?.timestamp
    ? new Date(payload.timestamp).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })
    : new Date().toLocaleString('en-AU');

  const packageCardsHtml = packages.length > 0
    ? packages.map(pkg => `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 16px; background-color: #ffffff; overflow: hidden;">
          <tr>
            ${pkg.imageUrl ? `
              <td width="130" style="vertical-align: top; padding: 0;">
                <img src="${pkg.imageUrl}" alt="${pkg.packageName || pkg.title || 'Package'}" width="130" height="110" style="display: block; width: 130px; height: 110px; object-fit: cover;" />
              </td>
            ` : ''}
            <td style="padding: 12px 16px; vertical-align: top;">
              <h4 style="margin: 0 0 6px 0; color: #1a202c; font-size: 16px; font-family: Arial, sans-serif;">
                ${pkg.packageName || pkg.title || 'Travel Package'}
              </h4>
              <p style="margin: 0 0 6px 0; color: #4a5568; font-size: 13px; font-family: Arial, sans-serif;">
                📍 <strong>${pkg.destination || 'Destination'}</strong>${pkg.country ? `, ${pkg.country}` : ''}
              </p>
              ${pkg.fromPrice ? `
                <p style="margin: 0 0 6px 0; color: #df1d22; font-weight: bold; font-size: 15px; font-family: Arial, sans-serif;">
                  From $${Number(pkg.fromPrice).toLocaleString()} AUD <span style="font-size: 11px; color: #718096; font-weight: normal;">per person</span>
                </p>
              ` : ''}
              ${pkg.wowFactor ? `
                <div style="background-color: #fff5f5; border-left: 3px solid #df1d22; padding: 6px 10px; margin-top: 6px; border-radius: 2px;">
                  <p style="margin: 0; color: #9b2c2c; font-size: 12px; font-family: Arial, sans-serif;">
                    ✨ <strong>Highlight:</strong> ${pkg.wowFactor}
                  </p>
                </div>
              ` : ''}
            </td>
          </tr>
        </table>
      `).join('')
    : '<p style="color: #718096; font-style: italic; font-family: Arial, sans-serif;">No saved packages attached to this profile.</p>';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Flight Centre Travel Profile</title>
    </head>
    <body style="font-family: Arial, Helvetica, sans-serif; background-color: #f4f6f8; margin: 0; padding: 20px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
        
        <!-- FLIGHT CENTRE IMAGE BANNER -->
        <tr>
          <td style="background-color: #df1d22; text-align: center; padding: 0;">
            <a href="https://www.flightcentre.com.au" target="_blank" style="text-decoration: none;">
              <img 
                src="https://content.flightcentre.com/sites/default/files/Flight-Centre.jpeg" 
                alt="Flight Centre Banner" 
                width="600" 
                style="display: block; width: 100%; max-width: 600px; height: auto; border: 0; background-color: #df1d22; padding: 18px 0;" 
              />
            </a>
          </td>
        </tr>

        <!-- CONTENT BODY -->
        <tr>
          <td style="padding: 28px 24px;">
            <h2 style="margin-top: 0; color: #1a202c; font-size: 20px; font-family: Arial, sans-serif;">
              G'day ${user.name || 'Traveler'},
            </h2>
            <p style="color: #4a5568; font-size: 14px; line-height: 1.5; margin-bottom: 20px; font-family: Arial, sans-serif;">
              Thank you for exploring with Flight Centre! Here is a summary of your shortlisted holiday packages and travel profile details.
            </p>

            <!-- CUSTOMER DETAILS CARD -->
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border-left: 4px solid #df1d22; border-radius: 4px; padding: 14px 16px; margin-bottom: 24px;">
              <tr>
                <td>
                  <p style="margin: 3px 0; font-size: 14px; color: #2d3748; font-family: Arial, sans-serif;"><strong>Customer Name:</strong> ${user.name || 'Not provided'}</p>
                  <p style="margin: 3px 0; font-size: 14px; color: #2d3748; font-family: Arial, sans-serif;"><strong>Email Address:</strong> <a href="mailto:${user.email}" style="color: #df1d22; text-decoration: underline;">${user.email || 'Not provided'}</a></p>
                  <p style="margin: 3px 0; font-size: 14px; color: #2d3748; font-family: Arial, sans-serif;"><strong>Phone Number:</strong> ${user.phone || 'Not provided'}</p>
                  <p style="margin: 3px 0; font-size: 12px; color: #718096; margin-top: 6px; font-family: Arial, sans-serif;"><strong>Submitted On:</strong> ${timestamp}</p>
                </td>
              </tr>
            </table>

            <!-- SAVED PACKAGES SECTION -->
            <h3 style="font-size: 16px; font-weight: 700; color: #1a202c; border-bottom: 2px solid #edf2f7; padding-bottom: 8px; margin-top: 24px; margin-bottom: 16px; font-family: Arial, sans-serif;">
              Saved Packages (${packages.length})
            </h3>
            
            ${packageCardsHtml}

            <!-- CALL TO ACTION BANNER -->
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top: 28px; background-color: #fff5f5; border: 1px dashed #feb2b2; border-radius: 8px; padding: 16px; text-align: center;">
              <tr>
                <td>
                  <p style="margin: 0 0 6px 0; font-weight: bold; color: #c53030; font-size: 14px; font-family: Arial, sans-serif;">
                    Ready to start planning?
                  </p>
                  <p style="margin: 0; font-size: 13px; color: #4a5568; line-height: 1.4; font-family: Arial, sans-serif;">
                    Reply directly to this email or pop into your local Flight Centre store to speak with one of our expert consultants.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background-color: #1a202c; color: #a0aec0; text-align: center; padding: 16px 20px; font-size: 12px; font-family: Arial, sans-serif;">
            <p style="margin: 0 0 4px 0;">Flight Centre Travel Group &copy; ${new Date().getFullYear()}</p>
            <p style="margin: 0; opacity: 0.7;">First Choice for Travel</p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

// POST endpoint for sending travel profile emails
app.post('/api/send-profile', async (req, res) => {
  try {
    const { recipient, type, data } = req.body;

    if (!recipient) {
      return res.status(400).json({ success: false, error: 'Recipient email is required.' });
    }

    const isStoreLead = type === 'STORE_LEAD';

    // Route to appropriate HTML template based on type
    const htmlContent = isStoreLead
      ? generateStoreLeadEmailHtml(data)
      : generateCustomerEmailHtml(data);

    const mailOptions = {
      from: `"Flight Centre Concierge" <${EMAIL_USER}>`,
      to: recipient,
      subject: isStoreLead
        ? `[NEW LEAD] Web Enquiry from ${data?.user?.name || 'Customer'}`
        : `Your Personalised Flight Centre Travel Profile`,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    console.log(`[Email Dispatched] Successfully sent ${type} email to: ${recipient}`);

    res.status(200).json({ success: true, message: 'Email sent successfully!' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});