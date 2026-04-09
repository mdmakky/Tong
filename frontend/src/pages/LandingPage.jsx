import { Link } from 'react-router-dom'
import { MessageCircle, ShieldCheck, Zap, Users } from 'lucide-react'
import useAuthStore from '@/store/authStore'
import useSeo from '@/hooks/useSeo'

export default function LandingPage() {
  const { isAuthenticated } = useAuthStore()

  useSeo({
    title: 'Secure Real-Time Messaging for Teams and Friends',
    description:
      'Tong Chat is a fast and secure messaging app with real-time chat, group conversations, and privacy-first communication.',
    canonicalPath: '/',
    noIndex: false,
  })

  return (
    <main className="landing-bg min-h-screen text-text-primary">
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16 md:py-24">
        <nav className="mb-10 flex flex-col gap-4 sm:mb-14 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <img src="/tong-icon.svg" alt="Tong Chat logo" className="h-10 w-10" />
            <span className="text-lg font-semibold tracking-tight sm:text-xl">Tong Chat</span>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto sm:gap-3">
            <Link to="/login" className="btn-ghost whitespace-nowrap px-3 py-2 sm:px-4">
              Sign In
            </Link>
            <Link
              to={isAuthenticated ? '/app' : '/register'}
              className="btn-primary whitespace-nowrap px-4 py-2.5 sm:px-5"
            >
              {isAuthenticated ? 'Open App' : 'Get Started'}
            </Link>
          </div>
        </nav>

        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <p className="mb-4 text-sm font-medium uppercase tracking-[0.18em] text-accent-yellow">
              Real-time Communication Platform
            </p>
            <h1 className="text-4xl font-semibold leading-tight md:text-6xl">
              Fast, secure messaging built for everyday teams.
            </h1>
            <p className="mt-5 max-w-xl text-base text-text-secondary md:text-lg">
              Tong Chat helps people communicate instantly with private direct chats, groups,
              file sharing, and responsive performance across devices.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={isAuthenticated ? '/app' : '/register'} className="btn-primary">
                {isAuthenticated ? 'Go to Inbox' : 'Create Free Account'}
              </Link>
              <Link to="/login" className="btn-ghost border border-border">
                Sign In
              </Link>
            </div>
          </div>

          <div className="landing-panel rounded-2xl border border-border p-6 md:p-8">
            <h2 className="mb-4 text-xl font-semibold">Why Tong Chat</h2>
            <ul className="space-y-4 text-sm text-text-secondary md:text-base">
              <li className="flex items-start gap-3">
                <Zap className="mt-0.5 h-5 w-5 flex-shrink-0 text-accent-yellow" />
                <span>Instant messaging with low-latency real-time delivery.</span>
              </li>
              <li className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-accent-yellow" />
                <span>Authentication and account controls focused on security.</span>
              </li>
              <li className="flex items-start gap-3">
                <Users className="mt-0.5 h-5 w-5 flex-shrink-0 text-accent-yellow" />
                <span>Private and group conversations designed for collaboration.</span>
              </li>
              <li className="flex items-start gap-3">
                <MessageCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-accent-yellow" />
                <span>Modern, clean chat experience on desktop and mobile devices.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  )
}
