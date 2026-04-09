import { Link } from 'react-router-dom'
import { Zap, ShieldCheck, Users } from 'lucide-react'
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
    <main className="min-h-screen bg-[#0e0e0e] text-white overflow-x-hidden">

      {/* Doodles */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        {/* Top-left squiggle */}
        <svg className="absolute -top-6 -left-8 w-48 opacity-10" viewBox="0 0 200 200" fill="none">
          <path d="M20 160 C40 100, 80 140, 100 80 S160 20, 180 60" stroke="#e8d44d" strokeWidth="3" strokeLinecap="round" fill="none"/>
          <path d="M10 130 C30 90, 60 120, 80 70 S130 10, 160 40" stroke="#e8d44d" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.5"/>
        </svg>

        {/* Top-right loop */}
        <svg className="absolute top-10 -right-10 w-44 opacity-10" viewBox="0 0 180 180" fill="none">
          <path d="M160 20 C120 10, 80 60, 100 100 S60 160, 30 140 S10 80, 50 60 S130 70, 140 40" stroke="#e8d44d" strokeWidth="3" strokeLinecap="round" fill="none"/>
        </svg>

        {/* Bottom-left speech bubble doodle */}
        <svg className="absolute bottom-20 -left-6 w-40 opacity-8" viewBox="0 0 160 160" fill="none">
          <path d="M20 30 Q20 10, 40 10 L120 10 Q140 10, 140 30 L140 90 Q140 110, 120 110 L60 110 L30 140 L40 110 L40 110 Q20 110, 20 90 Z" stroke="#e8d44d" strokeWidth="2.5" strokeLinejoin="round" fill="none"/>
          <line x1="45" y1="45" x2="115" y2="45" stroke="#e8d44d" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
          <line x1="45" y1="65" x2="95" y2="65" stroke="#e8d44d" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
        </svg>

        {/* Bottom-right wavy line */}
        <svg className="absolute bottom-10 -right-4 w-52 opacity-10" viewBox="0 0 220 120" fill="none">
          <path d="M10 60 C30 20, 60 100, 90 60 S150 20, 180 60 S210 100, 220 60" stroke="#e8d44d" strokeWidth="3" strokeLinecap="round" fill="none"/>
          <path d="M10 80 C30 50, 55 110, 85 80 S140 40, 170 80" stroke="#e8d44d" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.4"/>
        </svg>

        {/* Middle-right scattered dots */}
        <svg className="absolute top-1/2 right-8 -translate-y-1/2 w-16 opacity-10" viewBox="0 0 60 120" fill="none">
          <circle cx="10" cy="15" r="3" fill="#e8d44d"/>
          <circle cx="40" cy="35" r="2" fill="#e8d44d"/>
          <circle cx="20" cy="60" r="3.5" fill="#e8d44d"/>
          <circle cx="50" cy="80" r="2" fill="#e8d44d"/>
          <circle cx="15" cy="105" r="2.5" fill="#e8d44d"/>
        </svg>

        {/* Top-center small star doodle */}
        <svg className="absolute top-24 left-1/2 -translate-x-1/2 w-12 opacity-8" viewBox="0 0 50 50" fill="none">
          <path d="M25 5 L28 20 L43 20 L31 29 L35 44 L25 35 L15 44 L19 29 L7 20 L22 20 Z" stroke="#e8d44d" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
        </svg>
      </div>

      {/* Nav */}
      <nav className="relative z-40 sticky top-0 border-b border-white/5 bg-[#0e0e0e]/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/tong-icon.svg" alt="Tong" className="h-8 w-8" />
            <span className="text-lg font-bold tracking-tight">Tong Chat</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm text-white/60 hover:text-white transition-colors px-4 py-2">
              Sign In
            </Link>
            <Link
              to={isAuthenticated ? '/app' : '/register'}
              className="bg-[#e8d44d] text-black text-sm font-semibold px-5 py-2 rounded-lg hover:bg-[#f0df5a] transition-colors"
            >
              {isAuthenticated ? 'Open App' : 'Get Started'}
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="grid gap-16 md:grid-cols-2 md:items-center">

          {/* Left — text */}
          <div>
            <span className="inline-block mb-5 text-xs font-semibold uppercase tracking-widest text-[#e8d44d] border border-[#e8d44d]/30 rounded-full px-3 py-1">
              Bangladesh's Digital Adda
            </span>
            <h1 className="text-4xl font-extrabold leading-tight md:text-5xl lg:text-6xl">
              Your digital tong.{' '}
              <span className="text-[#e8d44d]">Where every adda begins.</span>
            </h1>
            <p className="mt-5 text-base text-white/50 leading-relaxed max-w-sm">
              At the tong, no topic is off-limits. Tong Chat brings that same free-flowing adda to your phone — private chats, group conversations, voice notes, media sharing, all without leaving your seat.
            </p>

            <div className="mt-8 flex items-center gap-4">
              <Link
                to={isAuthenticated ? '/app' : '/register'}
                className="bg-[#e8d44d] text-black font-semibold px-6 py-3 rounded-lg hover:bg-[#f0df5a] transition-colors"
              >
                {isAuthenticated ? 'Go to Inbox' : 'Start for Free'}
              </Link>
              <Link to="/login" className="text-sm text-white/50 hover:text-white transition-colors underline underline-offset-4">
                Already have an account?
              </Link>
            </div>

            {/* Pills */}
            <div className="mt-10 flex flex-wrap gap-3">
              {[
                { icon: <Zap className="h-3.5 w-3.5" />, label: 'Instant delivery' },
                { icon: <ShieldCheck className="h-3.5 w-3.5" />, label: 'Secure & private' },
                { icon: <Users className="h-3.5 w-3.5" />, label: 'Group chats' },
              ].map(({ icon, label }) => (
                <span key={label} className="flex items-center gap-1.5 text-xs text-white/50 bg-white/5 border border-white/10 rounded-full px-3 py-1.5">
                  <span className="text-[#e8d44d]">{icon}</span>
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Right — mock phone UI */}
          <div className="flex justify-center md:justify-end">
            <div className="relative w-64 md:w-72">
              {/* Phone frame */}
              <div className="relative bg-[#1a1a1a] border border-white/10 rounded-[2.5rem] p-3 shadow-2xl shadow-black/60">
                {/* Notch */}
                <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-white/10" />

                {/* Chat header */}
                <div className="flex items-center gap-2.5 px-3 pb-3 border-b border-white/5">
                  <div className="h-8 w-8 rounded-full bg-[#e8d44d]/20 flex items-center justify-center text-[#e8d44d] text-xs font-bold">N</div>
                  <div>
                    <div className="text-xs font-semibold">Nehal</div>
                    <div className="text-[10px] text-green-400">● online</div>
                  </div>
                </div>

                {/* Messages */}
                <div className="space-y-2.5 px-1 py-3 min-h-[360px]">
                  {/* Text */}
                  <div className="flex justify-start">
                    <div className="bg-white/8 rounded-2xl rounded-tl-sm px-3 py-2 text-[11px] text-white/80 max-w-[75%]">
                      Hey! What's up? 👋
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="bg-[#e8d44d] rounded-2xl rounded-tr-sm px-3 py-2 text-[11px] text-black font-medium max-w-[75%]">
                      Not much, just tried Tong 😄
                    </div>
                  </div>

                  {/* Image bubble — received */}
                  <div className="flex justify-start">
                    <div className="bg-white/8 rounded-2xl rounded-tl-sm overflow-hidden max-w-[75%]">
                      <div className="w-28 h-20 bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
                        <svg className="h-6 w-6 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.5"/>
                          <circle cx="8.5" cy="8.5" r="1.5" strokeWidth="1.5"/>
                          <path d="M21 15l-5-5L5 21" strokeWidth="1.5"/>
                        </svg>
                      </div>
                      <div className="px-2 py-1 text-[9px] text-white/40">photo.jpg</div>
                    </div>
                  </div>

                  {/* Text bubble — sent */}
                  <div className="flex justify-end">
                    <div className="bg-[#e8d44d] rounded-2xl rounded-tr-sm px-3 py-2 text-[11px] text-black font-medium max-w-[75%]">
                      Haha nice shot! 🔥
                    </div>
                  </div>

                  {/* Audio bubble — received */}
                  <div className="flex justify-start">
                    <div className="bg-white/8 rounded-2xl rounded-tl-sm px-3 py-2 flex items-center gap-2 max-w-[75%]">
                      <div className="h-6 w-6 rounded-full bg-[#e8d44d]/20 flex items-center justify-center flex-shrink-0">
                        <svg className="h-3 w-3 text-[#e8d44d]" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      </div>
                      {/* Waveform bars */}
                      <div className="flex items-center gap-[2px]">
                        {[3,5,8,6,10,7,4,9,6,5,3,7].map((h, i) => (
                          <div key={i} className="w-[2px] rounded-full bg-white/30" style={{ height: `${h}px` }} />
                        ))}
                      </div>
                      <span className="text-[9px] text-white/30 ml-1">0:12</span>
                    </div>
                  </div>

                  {/* Audio bubble — sent */}
                  <div className="flex justify-end">
                    <div className="bg-[#e8d44d] rounded-2xl rounded-tr-sm px-3 py-2 flex items-center gap-2 max-w-[75%]">
                      <div className="h-6 w-6 rounded-full bg-black/15 flex items-center justify-center flex-shrink-0">
                        <svg className="h-3 w-3 text-black" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      </div>
                      <div className="flex items-center gap-[2px]">
                        {[4,7,5,9,6,8,4,10,5,7,3,6].map((h, i) => (
                          <div key={i} className="w-[2px] rounded-full bg-black/30" style={{ height: `${h}px` }} />
                        ))}
                      </div>
                      <span className="text-[9px] text-black/40 ml-1">0:08</span>
                    </div>
                  </div>

                  {/* Final text */}
                  <div className="flex justify-start">
                    <div className="bg-white/8 rounded-2xl rounded-tl-sm px-3 py-2 text-[11px] text-white/80 max-w-[75%]">
                      Groups work great too 🙌
                    </div>
                  </div>
                </div>

                {/* Input bar */}
                <div className="flex items-center gap-2 bg-white/5 rounded-2xl px-3 py-2 mt-1">
                  <span className="flex-1 text-[10px] text-white/25">Type a message…</span>
                  <div className="h-5 w-5 rounded-full bg-[#e8d44d] flex items-center justify-center">
                    <svg className="h-2.5 w-2.5 text-black" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
                    </svg>
                  </div>
                </div>

                {/* Home indicator */}
                <div className="mx-auto mt-3 h-1 w-20 rounded-full bg-white/10" />
              </div>

              {/* Floating second card */}
              <div className="absolute -right-8 top-10 w-44 bg-[#1a1a1a] border border-white/10 rounded-2xl p-3 shadow-xl shadow-black/50">
                <div className="text-[10px] text-white/40 mb-2 font-medium">Dev Team</div>
                <div className="space-y-2">
                  {['Makky', 'Ramjan', 'Sadik', 'You'].map((name, i) => (
                    <div key={name} className="flex items-center gap-2">
                      <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold ${i === 2 ? 'bg-[#e8d44d]/20 text-[#e8d44d]' : 'bg-white/10 text-white/60'}`}>
                        {name[0]}
                      </div>
                      <div className="flex-1">
                        <div className="text-[10px] text-white/70">{name}</div>
                        <div className="h-1.5 rounded-full bg-white/5 mt-0.5" style={{ width: `${60 - i * 10}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8">
        <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/30">
          <span>© {new Date().getFullYear()} Tong Chat. All rights reserved.</span>
          <div className="flex gap-5">
            <Link to="/login" className="hover:text-white/60 transition-colors">Sign In</Link>
            <Link to="/register" className="hover:text-white/60 transition-colors">Register</Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
