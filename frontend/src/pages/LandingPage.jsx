import { Link } from 'react-router-dom'
import { MessageCircle, ShieldCheck, Zap, Users } from 'lucide-react'
import useAuthStore from '@/store/authStore'
import useSeo from '@/hooks/useSeo'

function Feature({ title, desc }) {
  return (
    <div className="rounded-xl border border-border p-6">
      <h3 className="mb-2 font-bold text-text-primary">{title}</h3>
      <p className="text-sm text-text-secondary leading-relaxed">{desc}</p>
    </div>
  )
}

function InternalLink({ to, children }) {
  return (
    <a href={to} className="text-accent-yellow hover:text-accent-yellow-dim">
      {children}
    </a>
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
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          "mainEntity": {
            "@type": "SoftwareApplication",
            "name": "Tong Chat",
            "description": "Secure real-time messaging app for instant communication",
            "url": "https://tongchat.app",
          }
        })}
      </script>

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
              Tong Chat: Secure Real-Time Messaging for Teams &amp; Friends
            </h1>
            <p className="mt-6 max-w-xl text-base text-text-secondary md:text-lg leading-relaxed">
              Tong Chat is a fast, secure real-time messaging and chat app designed for instant communication. Send private messages to friends, create group chats for teams, share files and photos, and connect across all your devices with end-to-end encryption and privacy-first design. Perfect for personal messaging, team collaboration, and group conversations.
            </p>
            <p className="mt-4 max-w-xl text-sm text-text-muted md:text-base leading-relaxed">
              Join thousands of users enjoying secure, instant messaging. Tong Chat offers a modern chat experience with low-latency real-time delivery, message reactions, typing indicators, read receipts, and seamless cross-device synchronization.
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
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">Secure Messaging Features For Everyone</h2>
            <p className="text-text-secondary">Chat, collaborate, and stay connected with Tong Chat's powerful secure messaging features</p>
          </div>
          <p className="mb-8 max-w-2xl mx-auto text-center text-text-secondary leading-relaxed">
            Whether you're sending direct messages to friends, organizing group chats for work teams, or sharing media files, Tong Chat provides everything you need for secure and instant communication. Our messaging platform is optimized for speed, security, and simplicity.
          </p>
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

      {/* About Section */}
      <section className="border-t border-border/20 bg-bg-secondary/20 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-3xl mx-auto">
            <h2 className="mb-6 text-3xl font-bold md:text-4xl">Why Tong Chat is the Best Messaging App</h2>
            <p className="mb-4 text-text-secondary leading-relaxed">
              In today's world, secure communication is essential. Tong Chat combines military-grade security with user-friendly design to provide the best instant messaging experience. Unlike other chat apps, Tong Chat prioritizes your privacy without sacrificing speed or features.
            </p>
            <p className="mb-4 text-text-secondary leading-relaxed">
              Our real-time messaging infrastructure ensures messages are delivered instantly across all devices. Whether you're using an instant messenger for casual conversations or group messaging for business collaboration, Tong Chat scales to meet your needs.
            </p>
            <p className="text-text-secondary leading-relaxed">
              Start using Tong Chat today for free. No credit card required. Experience the most secure, fast, and user-friendly chat application on the market.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">Ready to Start Secure Messaging?</h2>
          <p className="mb-8 text-text-secondary md:text-lg">Join thousands of users enjoying secure instant messaging on Tong Chat. It's completely free and takes just 2 minutes to get started with our messaging app.</p>
          <Link to={isAuthenticated ? '/app' : '/register'} className="btn-primary inline-block px-8 py-4 font-medium">
            Create Your Account Now
          </Link>
        </div>
      </section>
    </main>
  )
}
