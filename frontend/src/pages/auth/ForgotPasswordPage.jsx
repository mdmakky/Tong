import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { authApi } from '@/lib/apiServices'
import useSeo from '@/hooks/useSeo'

const STEPS = { EMAIL: 'email', OTP: 'otp', NEW_PW: 'new_password', DONE: 'done' }

export default function ForgotPasswordPage() {
  useSeo({
    title: 'Reset Password',
    description: 'Recover access to your Tong Chat account by resetting your password.',
    canonicalPath: '/forgot-password',
    noIndex: true,
  })

  const [step, setStep] = useState(STEPS.EMAIL)
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const sendOtp = async (e) => {
    e.preventDefault()
    if (!email) return toast.error('Enter your email')
    setLoading(true)
    try {
      await authApi.forgotPassword(email)
      setStep(STEPS.OTP)
      toast.success('Reset code sent to your email')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send reset code')
    } finally {
      setLoading(false)
    }
  }

  const resetPassword = async (e) => {
    e.preventDefault()
    if (otp.length !== 6) return toast.error('Enter the 6-digit code')
    if (newPassword.length < 8) return toast.error('Password must be at least 8 characters')
    setLoading(true)
    try {
      await authApi.resetPassword({ email, otp, new_password: newPassword })
      setStep(STEPS.DONE)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reset failed')
    } finally {
      setLoading(false)
    }
  }

  if (step === STEPS.DONE) {
    return (
      <div className="auth-bg min-h-screen flex items-center justify-center p-4">
        <div className="text-center animate-scale-in">
          <div className="w-20 h-20 bg-online/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-10 h-10 text-online" />
          </div>
          <h2 className="text-2xl font-bold text-text-primary mb-2">Password Reset!</h2>
          <p className="text-text-secondary mb-6">You can now sign in with your new password</p>
          <Link to="/login" className="btn-primary inline-block">Sign In</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-bg min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <img src="/tong-icon.svg" alt="tong" className="w-16 h-16" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Reset Password</h1>
          <p className="text-text-secondary text-sm mt-1">
            {step === STEPS.EMAIL ? "We'll send you a reset code" : `Code sent to ${email}`}
          </p>
        </div>

        <div className="glass-panel p-8">
          {step === STEPS.EMAIL ? (
            <form onSubmit={sendOtp} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    type="email"
                    className="input-field pl-10"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? 'Sending...' : 'Send Reset Code'}
              </button>
            </form>
          ) : (
            <form onSubmit={resetPassword} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Verification Code</label>
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
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">New Password</label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="Min 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          )}
        </div>

        <div className="text-center mt-6">
          <Link to="/login" className="text-text-secondary text-sm hover:text-text-primary transition-colors inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" />
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}
