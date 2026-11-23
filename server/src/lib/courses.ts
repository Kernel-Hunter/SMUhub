// Course codes a question can belong to. Keep in sync with COURSES in client/src/api/seed.ts
// until courses get their own collection and API.
export const COURSE_CODES = [
  'CS101', 'CS201', 'CS224', 'CS301', 'CS324',
  'MATH101', 'MATH205', 'MATH210', 'PHY110', 'EE220',
  'ENG101', 'ECO101', 'ACC110', 'MKT201', 'LAW105',
] as const

export const isCourseCode = (code: string) => (COURSE_CODES as readonly string[]).includes(code)
