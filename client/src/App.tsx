import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import Shell from '@/components/Shell'
import Login from '@/pages/Login'
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

export default function App() {
  const { me, loading } = useAuth()
  if (loading) return <div className="mx-auto max-w-3xl p-10"><Skeleton rows={3} /></div>
  if (!me) return <Routes><Route path="*" element={<Login />} /></Routes>
  return (
    <Shell>
      <Suspense fallback={<Skeleton rows={4} />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/resources/new" element={<Upload />} />
          <Route path="/resources/:id" element={<ResourceDetail />} />
          <Route path="/qa" element={<Threads kind="question" />} />
          <Route path="/qa/new" element={<Compose kind="question" />} />
          <Route path="/qa/:id" element={<ThreadDetail />} />
          <Route path="/voice" element={<Threads kind="voice" />} />
          <Route path="/voice/new" element={<Compose kind="voice" />} />
          <Route path="/voice/:id" element={<ThreadDetail />} />
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
