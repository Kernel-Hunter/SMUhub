import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import Shell from '@/components/Shell'
import Login from '@/pages/Login'
import Signup from '@/pages/Signup'
import Verify from '@/pages/Verify'
import Forgot from '@/pages/Forgot'
import { Skeleton } from '@/components/ui'

const Home = lazy(() => import('@/pages/Home'))
const Resources = lazy(() => import('@/pages/Resources'))
const ResourceDetail = lazy(() => import('@/pages/ResourceDetail'))
const Upload = lazy(() => import('@/pages/Upload'))
const Threads = lazy(() => import('@/pages/Threads'))
const ThreadDetail = lazy(() => import('@/pages/ThreadDetail'))
const Compose = lazy(() => import('@/pages/Compose'))
const Events = lazy(() => import('@/pages/Events'))
const Rentals = lazy(() => import('@/pages/Rentals'))
const Leaderboard = lazy(() => import('@/pages/Leaderboard'))
const Profile = lazy(() => import('@/pages/Profile'))
const Settings = lazy(() => import('@/pages/Settings'))
const Courses = lazy(() => import('@/pages/Courses'))
const Course = lazy(() => import('@/pages/Course'))

type FromState = { from?: string } | null

/** Signed out on a protected page: go to /login and remember where the student wanted to go. */
function ToLogin() {
  const { pathname, search } = useLocation()
  return <Navigate to="/login" replace state={{ from: pathname + search }} />
}

/** Signed in on /login: go back to the page that asked for a login, or home. */
function FromLogin() {
  const from = (useLocation().state as FromState)?.from
  const safe = from && from.startsWith('/') && !from.startsWith('//') && from !== '/login' ? from : '/'
  return <Navigate to={safe} replace />
}

export default function App() {
  const { me, loading } = useAuth()
  // Wait for GET /api/auth/me before choosing a screen, so the Login page never flashes for signed-in students.
  if (loading) return <div className="mx-auto max-w-3xl p-10"><Skeleton rows={3} /></div>
  if (!me) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/forgot" element={<Forgot />} />
        <Route path="*" element={<ToLogin />} />
      </Routes>
    )
  }
  return (
    <Shell>
      <Suspense fallback={<Skeleton rows={4} />}>
        <Routes>
          <Route path="/login" element={<FromLogin />} />
          <Route path="/" element={<Home />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/resources/new" element={<Upload />} />
          <Route path="/resources/:id" element={<ResourceDetail />} />
          <Route path="/qa" element={<Threads kind="question" />} />
          <Route path="/qa/new" element={<Compose kind="question" />} />
          <Route path="/qa/:id" element={<ThreadDetail kind="question" />} />
          <Route path="/voice" element={<Threads kind="voice" />} />
          <Route path="/voice/new" element={<Compose kind="voice" />} />
          <Route path="/voice/:id" element={<ThreadDetail kind="voice" />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/courses/:code" element={<Course />} />
          <Route path="/events" element={<Events />} />
          <Route path="/rentals" element={<Rentals />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/u/:id" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Shell>
  )
}
