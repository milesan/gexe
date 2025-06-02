// Common styles as template literals
export const styles = {
  container: 'font-family: sans-serif; max-width: 600px; margin: 0 auto;',
  heading: 'color: #064e3b; text-align: center;',
  card: 'background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;',
  infoCard: 'background-color: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0;',
  policyCard: 'background-color: #fffbeb; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #d97706;',
  label: 'display: block; color: #334155; margin-bottom: 4px;',
  value: 'font-size: 16px; color: #1f2937;',
  timeNote: 'margin: 4px 0 0 0; color: #059669; font-size: 13px;',
  button: 'background-color: #064e3b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;',
  footer: 'color: #64748b; text-align: center; font-size: 14px;',
  policyText: 'color: #a16207; font-size: 14px; line-height: 1.5;',
  policyList: 'color: #a16207; font-size: 14px; line-height: 1.6; margin: 10px 0; padding-left: 20px;'
};

interface BookingEmailData {
  accommodation: string;
  formattedCheckIn: string;
  formattedCheckOut: string;
  totalPrice: number;
  bookingDetailsUrl: string;
}

export function generateBookingConfirmationEmail({
  accommodation,
  formattedCheckIn,
  formattedCheckOut,
  totalPrice,
  bookingDetailsUrl
}: BookingEmailData): string {
  return `
    <div style="${styles.container}">
      <h1 style="${styles.heading}">Residency Confirmed!</h1>
      
      <div style="${styles.card}">
        <h2 style="${styles.heading}">Your Details</h2>
        
        <div style="margin: 15px 0;">
          <strong style="${styles.label}">Accommodation:</strong>
          <span style="${styles.value}">${accommodation}</span>
        </div>
        
        <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin: 20px 0;">
          <tr>
            <td style="width: 50%; padding-right: 15px;">
              <strong style="${styles.label}">Check-in</strong>
              <div style="${styles.value}">${formattedCheckIn}</div>
              <p style="${styles.timeNote}">Available 2-5 PM</p>
            </td>
            <td style="width: 50%; padding-left: 15px; border-left: 1px solid #e2e8f0;">
              <strong style="${styles.label}">Check-out</strong>
              <div style="${styles.value}">${formattedCheckOut}</div>
              <p style="${styles.timeNote}">By 11 AM</p>
            </td>
          </tr>
        </table>
        
        <div style="margin: 20px 0 0 0; border-top: 1px solid #e2e8f0; padding-top: 20px;">
          <strong style="${styles.label}">Total Donated Amount</strong>
          <div style="font-size: 18px; color: #064e3b; font-weight: 600;">€${totalPrice}</div>
        </div>
      </div>
      
      <div style="${styles.infoCard}">
        <h3 style="${styles.heading}" style="margin-top: 0;">Existential Info</h3>
        <ul style="color: #115e59; padding-left: 20px; margin: 15px 0;">
          <li style="margin-bottom: 8px;">This is a co-created experience</li>
          <li style="margin-bottom: 8px;">The Garden is a strictly smoke & alcohol-free space</li>
          <li style="margin-bottom: 8px;">Breakfast, lunch & dinner included Monday-Friday</li>
          <li style="margin-bottom: 8px;">To ensure a smooth arrival, please respect the check-in window (2-5 PM)</li>
          <li style="margin-bottom: 8px;">Review our <a href="https://gardening.notion.site/welcome-to-the-garden" target="_blank" style="color: #047857; text-decoration: underline;">Welcome Guide</a> for more details</li>
        </ul>
      </div>
      
      <p style="margin-top: 20px; text-align: center; color: #334155;">
        For any questions related to your booking, send a pigeon to living@thegarden.pt
      </p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${bookingDetailsUrl}" style="${styles.button}">
          View Booking Details
        </a>
      </div>
      
      <div style="${styles.policyCard}">
        <h3 style="color: #a16207; margin-top: 0; margin-bottom: 15px;">Cancellation Policy</h3>
        <p style="${styles.policyText}">
          As a non-profit association, your contributions are considered donations that directly support our mission and the operations of this space. While donations are typically non-refundable, we understand that plans can change and offer the following flexibility:
        </p>
        <ol style="${styles.policyList}">
          <li style="margin-bottom: 8px;"><strong>Guests with independent accommodations (van/camping):</strong><br>
              Always eligible for 85% refund or 100% credit, regardless of timing.</li>
          <li style="margin-bottom: 8px;"><strong>More than 30 days before arrival:</strong><br>
              We can offer a 85% refund of your donation or 100% credit for future use within 12 months.</li>
          <li style="margin-bottom: 8px;"><strong>15 to 30 days before arrival:</strong><br>
              We can offer a 50%-60% refund of your donation or 75% credit for future use within 12 months.</li>
          <li style="margin-bottom: 8px;"><strong>Less than 15 days before arrival:</strong><br>
              Donations are non-refundable at this stage, but we can offer a 50% credit for future use within 12 months.</li>
          <li style="margin-bottom: 8px;"><strong>Special circumstances (force majeure, injury, or accident):</strong><br>
              With valid documentation:
              <ul style="margin: 5px 0; padding-left: 15px;">
                <li>More than 15 days before arrival: 85% refund of donation or 100% credit.</li>
                <li>15 days or less before arrival: 75% credit.</li>
              </ul>
          </li>
        </ol>
      </div>
    </div>
  `;
} 