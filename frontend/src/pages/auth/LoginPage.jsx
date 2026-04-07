import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, MessageCircle, Lock, Mail, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import useAuthStore from '@/store/authStore'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, isLoading } = useAuthStore()

  const [form, setForm] = useState({ email: '', password: '', totp_code: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [requires2FA, setRequires2FA] = useState(false)
  const [errors, setErrors] = useState({})

  const validate = () => {
    const e = {}
    if (!form.email) e.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email'
    if (!form.password) e.password = 'Password is required'
    if (requires2FA && !form.totp_code) e.totp_code = '2FA code required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    const result = await login(form.email, form.password, form.totp_code || undefined)

    if (result.success) {
      toast.success('Welcome back!')
      navigate('/')
    } else if (result.requires2FA) {
      setRequires2FA(true)
      toast('Enter your 2FA code to continue', { icon: '🔐' })
    } else {
      toast.error(result.message || 'Login failed')
    }
  }

  return (
    <div className="auth-bg min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-accent-yellow rounded-2xl mb-4 shadow-lg shadow-accent-yellow/20">
            <MessageCircle className="w-7 h-7 text-black" />
          </div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">tong</h1>
          <p className="text-text-secondary text-sm mt-1">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="glass-panel p-8">
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type="email"
                  className={`input-field pl-10 ${errors.email ? 'border-busy' : ''}`}
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  autoComplete="email"
                />
              </div>
              {errors.email && <p className="text-busy text-xs mt-1">{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className={`input-field pl-10 pr-10 ${errors.password ? 'border-busy' : ''}`}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-busy text-xs mt-1">{errors.password}</p>}
            </div>

            {/* 2FA */}
            {requires2FA && (
              <div className="animate-fade-in">
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  2FA Code
                </label>
                <div className="relative">
                  <ShieldCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    className={`input-field pl-10 tracking-widest text-center text-xl ${errors.totp_code ? 'border-busy' : ''}`}
                    placeholder="000000"
                    value={form.totp_code}
                    onChange={(e) => setForm({ ...form, totp_code: e.target.value.replace(/\D/g, '') })}
                    autoFocus
                  />
                </div>
                {errors.totp_code && <p className="text-busy text-xs mt-1">{errors.totp_code}</p>}
              </div>
            )}

            {/* Forgot password */}
            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-sm text-accent-yellow hover:text-accent-yellow-dim transition-colors">
                Forgot password?
              </Link>
            </div>

            {/* Submit */}
            <button type="submit" className="btn-primary w-full" disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        {/* Register link */}
        <p className="text-center text-text-secondary text-sm mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-accent-yellow hover:text-accent-yellow-dim transition-colors font-medium">
            Create account
          </Link>
        </p>
      </div>
    </div>
  )
}
