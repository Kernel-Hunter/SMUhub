import type { VoiceCategory, RentalCategory } from './types'

const DAY = 86400000
const H = 3600000
export const now = () => Date.now()
export const daysAgo = (n: number, h = 0) => Date.now() - n * DAY - h * H
export const inDays = (n: number, hour = 10) => {
  const d = new Date(Date.now() + n * DAY)
  d.setHours(hour, 0, 0, 0)
  return d.getTime()
}

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

export const USERS = [
  ['u1', 'Amira Ben Salah', 'Computer Science', 3, 'Algorithms nerd. I share what I wish I had in year one.'],
  ['u2', 'Youssef Trabelsi', 'Computer Science', 2, 'Databases, coffee, repeat.'],
  ['u3', 'Ines Gharbi', 'Business', 2, 'Accounting summaries done properly.'],
  ['u4', 'Mehdi Jlassi', 'Engineering', 4, 'Digital logic survivor.'],
  ['u5', 'Rania Chebbi', 'Computer Science', 4, 'Final year. Ask me about internships.'],
  ['u6', 'Oussama Khelifi', 'Mathematics', 3, 'Linear algebra is beautiful, fight me.'],
  ['u7', 'Salma Mejri', 'Law', 2, 'Case summaries and good notes.'],
  ['u8', 'Hamza Bouaziz', 'Engineering', 3, 'I own too many calculators.'],
  ['u9', 'Yasmine Kefi', 'Business', 1, 'Fresh in. Learning the ropes.'],
  ['u10', 'Aymen Dridi', 'Computer Science', 1, 'Building stuff, breaking stuff.'],
  ['u11', 'Lina Hammami', 'Mathematics', 2, 'Probability tutor on weekends.'],
  ['u12', 'Skander Rebai', 'Physics', 3, 'Mechanics, lab reports, memes.'],
] as const

// id, kind, title, body, course, category, author, anonymous, daysAgo, votes, solved
export const THREADS: [string, 'question' | 'voice', string, string, string | '', VoiceCategory | '', string, boolean, number, number, boolean][] = [
  ['t1', 'question', 'Difference between a clustered and a non-clustered index?', 'The slides define both but I cannot picture when the DB would choose one over the other. A concrete example would help a lot.', 'CS224', '', 'u10', false, 1, 12, true],
  ['t2', 'question', 'How do I prove a greedy algorithm is optimal?', 'I always get stuck on the exchange argument. Is there a template to follow?', 'CS301', '', 'u9', false, 2, 9, false],
  ['t3', 'question', 'Does the Calculus I final allow a calculator?', 'The syllabus is silent about it. Did anyone ask the instructor last semester?', 'MATH101', '', 'u9', false, 0, 6, true],
  ['t4', 'question', 'useEffect runs twice in development, is that a bug?', 'My fetch fires two times in the CS324 project. Do I need to worry before deployment?', 'CS324', '', 'u10', false, 1, 7, true],
  ['t5', 'question', 'Journal entry for prepaid insurance?', 'I keep mixing up the debit and credit side when the policy covers 12 months.', 'ACC110', '', 'u3', false, 3, 4, false],
]

// id, threadId, author, anonymous, body, daysAgo, votes, accepted
export const REPLIES: [string, string, string, boolean, string, number, number, boolean][] = [
  ['p1', 't1', 'u2', false, 'A clustered index is the table itself sorted by the key, so there can be only one. A non-clustered index is a separate sorted structure with pointers back to the rows. Range scans on the clustered key are fastest. Use non-clustered for lookups by other columns.', 1, 14, true],
  ['p2', 't1', 'u5', false, 'Rule of thumb: the primary key is usually the clustered index. Add non-clustered ones for columns you filter or join on often.', 1, 5, false],
  ['p3', 't2', 'u1', false, 'Template: assume an optimal solution differs from the greedy one at the first step, swap the greedy choice in, and show the result is no worse. Repeat by induction.', 1, 8, false],
  ['p4', 't3', 'u6', false, 'Basic scientific calculators were allowed last year. Graphing ones were not.', 0, 6, true],
  ['p5', 't4', 'u5', false, 'React StrictMode double-invokes effects in development only. Add a cleanup function and you are fine. Production runs it once.', 1, 11, true],
]

// id, title, kind, daysFromNow, hour, location, course, author, going, desc
export const EVENTS: [string, string, 'event' | 'deadline' | 'club', number, number, string, string, string, number, string][] = [
  ['e1', 'CS324 project proposal deadline', 'deadline', 2, 23, 'Moodle', 'CS324', 'u5', 41, 'Submit the PDF proposal on Moodle before midnight.'],
  ['e2', 'Hackathon kickoff: 24 hours of building', 'event', 5, 17, 'Block C · Innovation Lab', '', 'u1', 87, 'Teams of 3 to 4. Free pizza. Prizes for the top three projects.'],
  ['e3', 'Calculus I midterm', 'deadline', 7, 9, 'Amphi A', 'MATH101', 'u6', 120, 'Chapters 1 to 4. Bring your student card.'],
  ['e4', 'Photography club open session', 'club', 4, 16, 'Student Center', '', 'u12', 23, 'Beginners welcome. Bring any camera, even your phone.'],
  ['e5', 'Career fair: Tunisian tech and finance firms', 'event', 12, 10, 'Main Hall', '', 'u5', 164, 'Bring printed CVs. 30 companies confirmed.'],
  ['e6', 'Financial Accounting quiz 2', 'deadline', 9, 14, 'Room B204', 'ACC110', 'u3', 52, 'Covers adjusting entries and the trial balance.'],
]

// id, title, cat, price, deposit, cond, owner, available, desc, contact
export const RENTALS: [string, string, RentalCategory, number, number, 'new' | 'good' | 'worn', string, boolean, string, string][] = [
  ['x1', 'Casio fx-991EX Classwiz', 'calculator', 2, 20, 'good', 'u8', true, 'Exam-approved scientific calculator. Fresh batteries.', 'WhatsApp +216 20 000 001'],
  ['x2', 'TI-84 Plus CE graphing calculator', 'calculator', 4, 60, 'good', 'u8', true, 'Great for Calculus and Statistics. Charger included.', 'WhatsApp +216 20 000 001'],
  ['x3', 'Arduino Uno starter kit', 'tech', 5, 40, 'good', 'u4', true, 'Board, breadboard, 40 jumpers, LEDs and sensors.', 'Telegram @mehdi_j'],
  ['x4', 'Lab coat (size M)', 'lab', 1, 10, 'good', 'u12', false, 'Required for Physics and Chemistry labs.', 'WhatsApp +216 20 000 002'],
  ['x5', 'Introduction to Algorithms (CLRS), 4th ed.', 'books', 3, 50, 'worn', 'u1', true, 'Highlighted but readable. Pick up at the library.', 'Instagram @amira.bs'],
  ['x6', 'Portable monitor 15.6 inch', 'tech', 6, 80, 'new', 'u2', true, 'USB-C, ideal for coding marathons.', 'Telegram @youssef_t'],
]
