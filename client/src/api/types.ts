// Domain types shared by the client and (later) the REST API contract.

export type PublicUser = {
  id: string
  name: string
  handle: string
  major: string
  year: number
}

export type Me = PublicUser & {
  bio: string
  joinedAt: number
  role: 'student' | 'admin'
  xp: number
  weeklyXp: number
  rank: number
  uploads: number
  courses: string[]
}

/** From GET /api/courses: open = unanswered questions, events = still on the calendar, students = have it in their courses. */
export type Course = { code: string; name: string; dept: string; resources: number; questions: number; open: number; events: number; students: number }

export type ResourceKind = 'notes' | 'exam' | 'summary' | 'slides' | 'tutorial'

export type Resource = {
  id: string
  title: string
  description: string
  courseCode: string
  kind: ResourceKind
  semester: 'S1' | 'S2'
  academicYear: string
  fileName: string
  fileSize: number
  ext: string
  uploader: PublicUser
  createdAt: number
  downloads: number
  helpful: number
  verified: boolean
  mine: boolean
  iVoted: boolean
  iDownloaded: boolean
}

export type ThreadKind = 'question' | 'voice'
export type VoiceCategory = 'academics' | 'facilities' | 'admin' | 'campus-life' | 'praise' | 'idea'

export type Thread = {
  id: string
  kind: ThreadKind
  title: string
  body: string
  courseCode?: string
  category?: VoiceCategory
  author: PublicUser | null // null = anonymous
  mine: boolean
  createdAt: number
  votes: number
  iVoted: boolean
  replyCount: number
  solved: boolean
}

export type Reply = {
  id: string
  threadId: string
  body: string
  author: PublicUser | null
  mine: boolean
  createdAt: number
  votes: number
  iVoted: boolean
  accepted: boolean
}

export type CampusEvent = {
  id: string
  title: string
  kind: 'event' | 'deadline' | 'club'
  startsAt: number
  location: string
  courseCode?: string
  description: string
  author: PublicUser
  going: number
  iGo: boolean
}

export type RentalCategory = 'calculator' | 'lab' | 'books' | 'tech' | 'other'
export type RentalItem = {
  id: string
  title: string
  category: RentalCategory
  pricePerDay: number // TND
  deposit: number
  condition: 'new' | 'good' | 'worn'
  description: string
  owner: PublicUser
  mine: boolean
  available: boolean
  createdAt: number
  myRequest?: RentalRequest
  pendingRequests: number
}
export type RentalRequest = {
  id: string
  itemId: string
  renter: PublicUser
  from: number
  to: number
  note: string
  status: 'pending' | 'accepted' | 'declined' | 'returned'
  contact?: string // revealed to renter only once accepted
}

export type XpRow = { id: string; points: number; kind: XpKind; label: string; at: number }
export type XpKind =
  | 'resource_verified' | 'resource_helpful' | 'answer_accepted' | 'answer_upvoted'
  | 'question_upvoted' | 'voice_upvoted' | 'removal_penalty'

export type LeaderRow = { user: PublicUser; xp: number; rank: number; uploads: number; isMe: boolean }

export type ResourceQuery = {
  q?: string
  course?: string
  kind?: ResourceKind | ''
  semester?: 'S1' | 'S2' | ''
  sort?: 'new' | 'top' | 'downloads'
}
