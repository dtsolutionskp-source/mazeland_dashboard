'use client'

import { SessionTimeout } from './SessionTimeout'

interface AuthWrapperProps {
  children: React.ReactNode
}

export function AuthWrapper({ children }: AuthWrapperProps) {
  return (
    <>
      <SessionTimeout timeoutMinutes={10} warningMinutes={1} />
      {children}
    </>
  )
}
