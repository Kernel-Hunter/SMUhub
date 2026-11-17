// Gamification + upload rules. The server MUST enforce every one of these;
// the client only reads them to explain the system to students.
export const RULES = {
  allowedExt: ['pdf', 'docx', 'pptx', 'xlsx', 'png', 'jpg'] as const,
  maxBytes: 25 * 1024 * 1024,
  minBytes: 10 * 1024,
  uploadsPerDay: 5,
  dailyXpCap: 120,
  pairWeeklyCap: 3, // max XP-earning interactions from one voter to one author per 7 days
  verifyThreshold: 3, // distinct downloaders who rate a file helpful
  points: { helpful: 5, verified: 30, accepted: 15, answerUp: 2, questionUp: 1, voiceUp: 1 },
} as const
