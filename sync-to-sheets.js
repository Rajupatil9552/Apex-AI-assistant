import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';

dotenv.config();

// Initialize auth - safely accessing env variables
const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  // The replace function ensures no literal "\n" strings break the formatting
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);

/**
 * Function to append a new message to your Google Sheet.
 * @param {string} conversationId 
 * @param {string} senderRole 'user' or 'ai'
 * @param {string} content The actual message text
 */
export async function appendMessageToSheet(conversationId, senderRole, content) {
  try {
    await doc.loadInfo(); // Loads document properties and worksheets
    const sheet = doc.sheetsByIndex[0]; // Gets the first tab
    
    // Add row - the keys must match the column headers you created exactly
    await sheet.addRow({
      'Timestamp': new Date().toISOString(),
      'Conversation ID': conversationId,
      'Sender Role': senderRole === 'user' ? 'User' : 'AI',
      'Message Content': content
    });

    console.log(`Successfully added ${senderRole} message to sheet!`);
  } catch (error) {
    console.error("Error writing to Google Sheets:", error);
  }
}

// ==============================================
// EXAMPLE USAGE:
// Uncomment below to test if it's working locally
// ==============================================
// appendMessageToSheet("session-123", "user", "What are the interest rates for Vyapar Loan?");
