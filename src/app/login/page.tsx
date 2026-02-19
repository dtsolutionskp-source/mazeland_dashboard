'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button, Input } from '@/components/ui'
import { Mail, Lock, AlertCircle, Clock } from 'lucide-react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [timeoutMessage, setTimeoutMessage] = useState('')

  // 타임아웃으로 로그아웃된 경우 메시지 표시
  useEffect(() => {
    const reason = searchParams.get('reason')
    if (reason === 'timeout') {
      setTimeoutMessage('10분간 활동이 없어 자동으로 로그아웃되었습니다.')
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      // 이메일과 비밀번호 앞뒤 공백 제거
      const trimmedEmail = email.trim()
      const trimmedPassword = password.trim()
      
      console.log('[Login] Attempting login for:', trimmedEmail)
      
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // 쿠키 포함
        body: JSON.stringify({ email: trimmedEmail, password: trimmedPassword }),
      })

      const data = await res.json()
      console.log('[Login] Response:', res.status, data)

      if (!res.ok) {
        setError(data.error || '로그인에 실패했습니다.')
        return
      }

      // 로그인 성공 - 페이지 새로고침으로 쿠키 적용
      console.log('[Login] Success, redirecting...')
      window.location.href = '/dashboard'
    } catch (err) {
      console.error('[Login] Error:', err)
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-dashboard-card border border-dashboard-border rounded-2xl p-8 shadow-2xl backdrop-blur-xl animate-fade-in">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-maze-500 to-maze-700 rounded-2xl mb-4">
          <span className="text-white font-bold text-2xl">M</span>
        </div>
        <h1 className="text-2xl font-bold text-dashboard-text">메이즈랜드</h1>
        <p className="text-dashboard-muted mt-2">정산/마케팅 통합 대시보드</p>
      </div>

      {/* Timeout Message */}
      {timeoutMessage && (
        <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/50 rounded-lg flex items-center gap-3 text-yellow-400 animate-slide-up">
          <Clock className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{timeoutMessage}</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg flex items-center gap-3 text-red-400 animate-slide-up">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <Input
          label="이메일"
          type="email"
          placeholder="이메일을 입력하세요"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          icon={<Mail className="w-5 h-5" />}
          required
        />

        <Input
          label="비밀번호"
          type="password"
          placeholder="비밀번호를 입력하세요"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          icon={<Lock className="w-5 h-5" />}
          required
        />

        <Button
          type="submit"
          className="w-full"
          size="lg"
          isLoading={isLoading}
        >
          로그인
        </Button>
      </form>

      {/* Footer */}
      <div className="mt-8 text-center">
        <p className="text-xs text-dashboard-muted">
          계정이 없으신가요? 관리자에게 문의하세요.
        </p>
      </div>
    </div>
  )
}

function LoginFormFallback() {
  return (
    <div className="bg-dashboard-card border border-dashboard-border rounded-2xl p-8 shadow-2xl backdrop-blur-xl animate-fade-in">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-maze-500 to-maze-700 rounded-2xl mb-4">
          <span className="text-white font-bold text-2xl">M</span>
        </div>
        <h1 className="text-2xl font-bold text-dashboard-text">메이즈랜드</h1>
        <p className="text-dashboard-muted mt-2">정산/마케팅 통합 대시보드</p>
      </div>
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-maze-500"></div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-dashboard-bg flex items-center justify-center p-4">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-maze-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-maze-600/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-maze-500/10 rounded-full blur-3xl" />
      </div>

      {/* Login Card */}
      <div className="relative w-full max-w-md">
        <Suspense fallback={<LoginFormFallback />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
