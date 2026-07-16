/**
 * OTP code extractor.
 * Scans email subject + body for numeric verification codes (4-8 digits).
 */

const OTP_PATTERNS = [
  // Indonesian / English context words
  /(?:kode|code|otp|verifikasi|verification|pin|password|sandi)\s*(?:anda|you[r]?)?\s*[:\-]?\s*(\d{4,8})/i,
  /(?:is\s*(?:code|otp|pin)\s*[:\-]?)\s*(\d{4,8})/i,
  // Standalone 4-6 digit codes (most common for OTP)
  /\b(\d{6})\b/,
  /\b(\d{4})\b/,
  /\b(\d{5})\b/,
  /\b(\d{8})\b/,
];

export function extractOTP(subject: string, body: string): string | null {
  const text = `${subject}\n${body}`;

  for (const pattern of OTP_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}
