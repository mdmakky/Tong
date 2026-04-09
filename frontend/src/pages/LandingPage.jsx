import { Link } from 'react-router-dom'
import { MessageCircle, ShieldCheck, Zap, Users } from 'lucide-react'
import useAuthStore from '@/store/authStore'
import useSeo from '@/hooks/useSeo'

function Feature({ title, desc }) {
  return (
    <div className="rounded-xl border border-border p-6">
      <h3 className="mb-2 font-bold text-text-primary">{title}</h3>
      <p className="text-sm text-text-secondary">{desc}</p>
    </div>
  )
}

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
      {/* Header Nav */}
      <nav className="border-b border-border/20 sticky top-0 z-40 bg-bg-primary/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <img src="/tong-icon.svg" alt="Tong Chat logo" className="h-10 w-10" />
            <span className="text-lg font-bold tracking-tight sm:text-xl">Tong Chat</span>
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
        </div>
      </nav>

      {/* Hero Section */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 md:py-32">
        <div className="grid gap-12 md:grid-cols-2 md:items-center">
          <div>
            <p className="mb-4 text-sm font-medium uppercase tracking-[0.18em] text-accent-yellow">
              Secure Messaging Platform
            </p>
            <h1 className="text-4xl font-bold leading-tight md:text-6xl">
              Fast, secure messaging for teams &amp; friends
            </h1>
            <p className="mt-6 max-w-xl text-base text-text-secondary md:text-lg leading-relaxed">
              Tong Chat is a real-time messaging app designed for instant communication. Send private messages, create group chats, share files, and connect across all your devices with military-grade encryption and privacy-first design.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link to={isAuthenticated ? '/app' : '/register'} className="btn-primary px-6 py-3 text-base font-medium">
                {isAuthenticated ? 'Go to Inbox' : 'Start Messaging Free'}
              </Link>
              <Link to="/login" className="btn-ghost border border-border px-6 py-3 text-base font-medium">
                Sign In
              </Link>
            </div>
          </div>

          <div className="landing-panel rounded-2xl border border-border p-6 md:p-8">
            <h2 className="mb-6 text-2xl font-bold">Why Choose Tong Chat?</h2>
            <ul className="space-y-5 text-sm text-text-secondary md:text-base">
              <li className="flex items-start gap-3">
                <Zap className="mt-0.5 h-5 w-5 flex-shrink-0 text-accent-yellow" />
                <div>
                  <strong className="text-text-primary">Instant Messaging</strong>
                  <p className="text-sm">Low-latency real-time delivery for seamless conversations</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-accent-yellow" />
                <div>
                  <strong className="text-text-primary">Maximum Security</strong>
                  <p className="text-sm">End-to-end encryption and privacy-focused authentication</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Users className="mt-0.5 h-5 w-5 flex-shrink-0 text-accent-yellow" />
                <div>
                  <strong className="text-text-primary">Group Collaboration</strong>
                  <p className="text-sm">Create groups, manage permissions, and organize team conversations</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <MessageCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-accent-yellow" />
                <div>
                  <strong className="text-text-primary">Cross-Platform</strong>
                  <p className="text-sm">Native experience on desktop, mobile, and tablet devices</p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="border-t border-border/20 bg-bg-secondary/30 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">Messaging Features Built For Everyone</h2>
            <p className="text-text-secondary">Everything you need for secure, instant conversations</p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            <Feature title="Direct Messages" desc="One-on-one private chats with read receipts and typing indicators" />
            <Feature title="Group Chats" desc="Create public or private groups with role-based permissions" />
            <Feature title="Media Sharing" desc="Send photos, videos, and files instantly with preview support" />
            <Feature title="Message Search" desc="Find messages, media, and conversations in seconds" />
            <Feature title="Message Reactions" desc="React with emojis to quickly show your feelings or feedback" />
            <Feature title="Always Available" desc="Access your chats anytime on any device, anywhere" />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">Ready to Connect?</h2>
          <p className="mb-8 text-text-secondary md:text-lg">Join thousands of users communicating on Tong Chat today. It's free, secure, and takes 2 minutes to get started.</p>
          <Link to={isAuthenticated ? '/app' : '/register'} className="btn-primary inline-block px-8 py-4 font-medium">
            Create Your Account Now
          </Link>
        </div>
      </section>
    </main>
  )
}
