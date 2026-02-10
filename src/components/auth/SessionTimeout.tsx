'use client'

import { useEffect, useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface SessionTimeoutProps {
  timeoutMinutes?: number // 타임아웃 시간 (분)
  warningMinutes?: number // 경고 시간 (분)
}

export function SessionTimeout({ 
  timeoutMinutes = 10, 
  warningMinutes = 1 
}: SessionTimeoutProps) {
  const router = useRouter()
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const warningRef = useRef<NodeJS.Timeout | null>(null)
  const [showWarning, setShowWarning] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState(0)

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch (error) {
      console.error('Logout error:', error)
    }
    
    // 로컬 스토리지 정리
    localStorage.removeItem('lastActivity')
    sessionStorage.clear()
    
    // 로그인 페이지로 이동
    router.push('/login?reason=timeout')
  }, [router])

  // 마지막 토큰 갱신 시간 추적
  const lastRefreshRef = useRef<number>(Date.now())
  const REFRESH_INTERVAL = 5 * 60 * 1000 // 5분마다 토큰 갱신

  const resetTimer = useCallback(() => {
    // 마지막 활동 시간 저장
    const now = Date.now()
    localStorage.setItem('lastActivity', now.toString())
    
    // 5분마다 토큰 자동 갱신 (활동 중일 때)
    if (now - lastRefreshRef.current >= REFRESH_INTERVAL) {
      fetch('/api/auth/refresh', { method: 'POST' })
        .catch(err => console.error('Auto refresh error:', err))
      lastRefreshRef.current = now
    }
    
    // 기존 타이머 정리
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (warningRef.current) clearTimeout(warningRef.current)
    
    setShowWarning(false)

    // 경고 타이머 설정
    const warningTime = (timeoutMinutes - warningMinutes) * 60 * 1000
    warningRef.current = setTimeout(() => {
      setShowWarning(true)
      setRemainingSeconds(warningMinutes * 60)
    }, warningTime)

    // 로그아웃 타이머 설정
    const timeoutTime = timeoutMinutes * 60 * 1000
    timeoutRef.current = setTimeout(logout, timeoutTime)
  }, [timeoutMinutes, warningMinutes, logout])

  // 페이지 로드 시 마지막 활동 시간 체크
  useEffect(() => {
    const lastActivity = localStorage.getItem('lastActivity')
    if (lastActivity) {
      const elapsed = Date.now() - parseInt(lastActivity)
      const timeoutMs = timeoutMinutes * 60 * 1000
      
      if (elapsed >= timeoutMs) {
        // 이미 타임아웃됨
        logout()
        return
      }
    }
    
    resetTimer()
  }, [timeoutMinutes, logout, resetTimer])

  // 사용자 활동 감지
  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']
    
    const handleActivity = () => {
      resetTimer()
    }

    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true })
    })

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity)
      })
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (warningRef.current) clearTimeout(warningRef.current)
    }
  }, [resetTimer])

  // 경고 카운트다운
  useEffect(() => {
    if (!showWarning) return

    const interval = setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [showWarning])

  // 세션 연장 (쿠키도 갱신)
  const extendSession = async () => {
    try {
      await fetch('/api/auth/refresh', { method: 'POST' })
    } catch (error) {
      console.error('Session refresh error:', error)
    }
    resetTimer()
  }

  if (!showWarning) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
      <div className="bg-dashboard-card border border-dashboard-border rounded-2xl p-6 max-w-md mx-4 animate-slide-up">
        <div className="text-center">
          <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-dashboard-text mb-2">
            세션 만료 경고
          </h2>
          <p className="text-dashboard-muted mb-4">
            {remainingSeconds}초 후 자동으로 로그아웃됩니다.
            <br />
            계속 사용하시려면 세션을 연장해주세요.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={logout}
              className="px-4 py-2 text-dashboard-muted hover:text-dashboard-text transition-colors"
            >
              로그아웃
            </button>
            <button
              onClick={extendSession}
              className="px-6 py-2 bg-maze-500 text-white rounded-lg hover:bg-maze-600 transition-colors"
            >
              세션 연장
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
