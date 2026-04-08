import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail, User, Phone, CheckCircle2, MessageCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import useAuthStore from '@/store/authStore'
import { authApi } from '@/lib/apiServices'

const STEPS = { FORM: 'form', VERIFY: 'verify', SUCCESS: 'success' }

export default function RegisterPage() {
  const navigate = useNavigate()
  const { register: registerUser, isLoading } = useAuthStore()

  const [step, setStep] = useState(STEPS.FORM)
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    display_name: '',
    phone: '',
  })
  const [otp, setOtp] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [verifying, setVerifying] = useState(false)

  const passwordStrength = (pw) => {
    let score = 0
    if (pw.length >= 8) score++
    if (/[A-Z]/.test(pw)) score++
    if (/[a-z]/.test(pw)) score++
    if (/\d/.test(pw)) score++
    if (/[^A-Za-z0-9]/.test(pw)) score++
    return score
  }

  const strength = passwordStrength(form.password)
  const strengthColors = ['', 'bg-busy', 'bg-away', 'bg-away', 'bg-online', 'bg-online']
  const strengthLabels = ['', 'Too weak', 'Weak', 'Fair', 'Strong', 'Very strong']

  const validate = () => {
    const e = {}
    if (!form.username || form.username.length < 3) e.username = 'Min 3 characters'
    else if (!/^[a-zA-Z0-9_]+$/.test(form.username)) e.username = 'Letters, numbers, _ only'
    if (!form.email || !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Valid email required'
    if (!form.password || form.password.length < 8) e.password = 'Min 8 characters'
    else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(form.password))
      e.password = 'Must include uppercase, lowercase, and number'
    if (!form.display_name) e.display_name = 'Required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    if (!validate()) return

    const result = await registerUser({
      username: form.username,
      email: form.email,
      password: form.password,
      display_name: form.display_name,
      phone: form.phone || undefined,
    })

    if (result.success) {
      setStep(STEPS.VERIFY)
      toast.success('Verification code sent to your email')
    } else {
      if (result.errors) {
        const apiErrors = {}
        result.errors.forEach((err) => {
          apiErrors[err.param] = err.msg
        })
        setErrors(apiErrors)
      } else {
        toast.error(result.message)
      }
    }
  }

  const handleVerify = async (e) => {
    e.preventDefault()
    if (otp.length !== 6) {
      toast.error('Enter the 6-digit code')
      return
    }
    setVerifying(true)
    try {
      await authApi.verifyEmail({ email: form.email, otp })
      setStep(STEPS.SUCCESS)
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid OTP')
    } finally {
      setVerifying(false)
    }
  }

  if (step === STEPS.SUCCESS) {
    return (
      <div className="auth-bg min-h-screen flex items-center justify-center p-4">
        <div className="text-center animate-scale-in">
          <div className="w-20 h-20 bg-online/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-10 h-10 text-online" />
          </div>
          <h2 className="text-2xl font-bold text-text-primary mb-2">Email Verified!</h2>
          <p className="text-text-secondary">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  if (step === STEPS.VERIFY) {
    return (
      <div className="auth-bg min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-accent-yellow rounded-2xl mb-4">
              <MessageCircle className="w-7 h-7 text-black" />
            </div>
            <h1 className="text-2xl font-bold text-text-primary">Verify Email</h1>
            <p className="text-text-secondary text-sm mt-1">
              We sent a 6-digit code to <span className="text-text-primary font-medium">{form.email}</span>
            </p>
          </div>
          <div className="glass-panel p-8">
            <form onSubmit={handleVerify} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Verification Code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  className="input-field tracking-widest text-center text-2xl"
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  autoFocus
                />
              </div>
              <button type="submit" className="btn-primary w-full" disabled={verifying || otp.length !== 6}>
                {verifying ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    Verifying...
                  </span>
                ) : (
                  'Verify Email'
                )}
              </button>
              <button
                type="button"
                className="w-full text-sm text-text-secondary hover:text-text-primary transition-colors py-2"
                onClick={() => setStep(STEPS.FORM)}
              >
                ← Back
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-bg min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <img src="/tong-icon.svg" alt="tong" className="w-16 h-16" />
          </div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">tong</h1>
          <p className="text-text-secondary text-sm mt-1">Create your account</p>
        </div>

        <div className="glass-panel p-8">
          <form onSubmit={handleRegister} className="space-y-4" noValidate>
            {/* Display Name */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Display Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type="text"
                  className={`input-field pl-10 ${errors.display_name ? 'border-busy' : ''}`}
                  placeholder="Your Name"
                  value={form.display_name}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                />
              </div>
              {errors.display_name && <p className="text-busy text-xs mt-1">{errors.display_name}</p>}
            </div>

            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Username</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-sm">@</span>
                <input
                  type="text"
                  className={`input-field pl-8 ${errors.username ? 'border-busy' : ''}`}
                  placeholder="username"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })}
                  autoComplete="username"
                />
              </div>
              {errors.username && <p className="text-busy text-xs mt-1">{errors.username}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Email</label>
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

            {/* Phone (optional) */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                Phone <span className="text-text-muted">(optional)</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type="tel"
                  className="input-field pl-10"
                  placeholder="+880..."
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className={`input-field pl-10 pr-10 ${errors.password ? 'border-busy' : ''}`}
                  placeholder="Min 8 characters"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* Strength bar */}
              {form.password && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                          i <= strength ? strengthColors[strength] : 'bg-border'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-text-muted">{strengthLabels[strength]}</p>
                </div>
              )}
              {errors.password && <p className="text-busy text-xs mt-1">{errors.password}</p>}
            </div>

            <button type="submit" className="btn-primary w-full mt-2" disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Creating account...
                </span>
              ) : (
                'Create Account'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-text-secondary text-sm mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-accent-yellow hover:text-accent-yellow-dim transition-colors font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
