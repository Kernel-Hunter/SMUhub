// Course catalogue: code, name, department. Keep in sync with COURSE_CODES in server/src/lib/courses.ts
// until courses get their own collection and API.
export const COURSES = [
  ['CS101', 'Introduction to Programming', 'Computer Science'],
  ['CS201', 'Data Structures', 'Computer Science'],
  ['CS224', 'Database Systems', 'Computer Science'],
  ['CS301', 'Algorithms & Complexity', 'Computer Science'],
  ['CS324', 'Web Application Development', 'Computer Science'],
  ['MATH101', 'Calculus I', 'Mathematics'],
  ['MATH205', 'Linear Algebra', 'Mathematics'],
  ['MATH210', 'Probability & Statistics', 'Mathematics'],
  ['PHY110', 'Mechanics', 'Physics'],
  ['EE220', 'Digital Logic Design', 'Engineering'],
  ['ENG101', 'Academic Writing', 'Languages'],
  ['ECO101', 'Microeconomics', 'Business'],
  ['ACC110', 'Financial Accounting', 'Business'],
  ['MKT201', 'Marketing Principles', 'Business'],
  ['LAW105', 'Introduction to Law', 'Law'],
] as const
