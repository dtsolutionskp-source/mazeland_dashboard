'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/dashboard/Header'
import { Card, CardHeader, Button, Input, Select } from '@/components/ui'
import { cn } from '@/lib/utils'
import {
  Plus,
  Edit,
  Trash2,
  X,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  Building2,
  Shield,
  Save,
  RefreshCw,
} from 'lucide-react'

interface Account {
  id: string
  email: string
  password: string
  name: string
  role: string
  companyCode: string
  companyName: string
  createdAt: string
}

const ROLES = [
  { value: 'SKP_ADMIN', label: 'SKP 관리자' },
  { value: 'PARTNER_ADMIN', label: '파트너 관리자' },
  { value: 'AGENCY_ADMIN', label: '대행사 관리자' },
]

const COMPANIES = [
  { value: 'SKP', label: 'SK플래닛' },
  { value: 'MAZE', label: '메이즈랜드' },
  { value: 'CULTURE', label: '컬처커넥션' },
  { value: 'FMC', label: 'FMC' },
]

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({})
  
  // 폼 상태
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'PARTNER_ADMIN',
    companyCode: 'MAZE',
  })

  // 계정 목록 조회
  const fetchAccounts = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/accounts')
      if (!response.ok) throw new Error('계정 조회 실패')
      const data = await response.json()
      setAccounts(data.accounts || [])
    } catch (err) {
      console.error('Fetch accounts error:', err)
      setError('계정 목록을 불러오는데 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      name: '',
      role: 'PARTNER_ADMIN',
      companyCode: 'MAZE',
    })
  }

  const handleEdit = (account: Account) => {
    setEditingAccount(account)
    setFormData({
      email: account.email,
      password: '', // 비밀번호는 보안상 빈값으로
      name: account.name,
      role: account.role,
      companyCode: account.companyCode,
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    
    try {
      const url = editingAccount 
        ? `/api/admin/accounts/${editingAccount.id}` 
        : '/api/admin/accounts'
      const method = editingAccount ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '저장 실패')
      }
      
      await fetchAccounts()
      setShowModal(false)
      setEditingAccount(null)
      resetForm()
    } catch (err: any) {
      console.error('Submit error:', err)
      setError(err.message || '저장 중 오류가 발생했습니다.')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('정말 이 계정을 삭제하시겠습니까?')) return
    
    try {
      const response = await fetch(`/api/admin/accounts/${id}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        throw new Error('삭제 실패')
      }
      
      await fetchAccounts()
    } catch (err) {
      console.error('Delete error:', err)
      setError('삭제 중 오류가 발생했습니다.')
    }
  }

  const togglePasswordVisibility = (id: string) => {
    setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const getRoleLabel = (role: string) => {
    return ROLES.find(r => r.value === role)?.label || role
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
      case 'SKP_ADMIN':
        return 'bg-blue-500/20 text-blue-400'
      case 'PARTNER_ADMIN':
        return 'bg-green-500/20 text-green-400'
      case 'AGENCY_ADMIN':
        return 'bg-orange-500/20 text-orange-400'
      default:
        return 'bg-gray-500/20 text-gray-400'
    }
  }

  return (
    <div className="min-h-screen">
      <Header
        title="계정 관리"
        description="시스템 사용자 계정을 관리합니다"
      />
      
      <div className="p-8 space-y-6">
        {/* 에러 메시지 */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 text-sm">
            {error}
          </div>
        )}

        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-maze-500/20 rounded-xl">
              <KeyRound className="w-6 h-6 text-maze-500" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-dashboard-text">전체 계정 목록</h2>
              <p className="text-sm text-dashboard-muted">총 {accounts.length}개의 계정</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={fetchAccounts}>
              <RefreshCw className="w-4 h-4 mr-2" />
              새로고침
            </Button>
            <Button onClick={() => { resetForm(); setEditingAccount(null); setShowModal(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              계정 추가
            </Button>
          </div>
        </div>

        {/* 계정 목록 */}
        <Card>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-maze-500" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-dashboard-muted">등록된 계정이 없습니다.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-dashboard-border">
                    <th className="text-left py-4 px-4 text-sm font-semibold text-dashboard-muted">이름</th>
                    <th className="text-left py-4 px-4 text-sm font-semibold text-dashboard-muted">이메일</th>
                    <th className="text-left py-4 px-4 text-sm font-semibold text-dashboard-muted">비밀번호</th>
                    <th className="text-left py-4 px-4 text-sm font-semibold text-dashboard-muted">소속</th>
                    <th className="text-left py-4 px-4 text-sm font-semibold text-dashboard-muted">권한</th>
                    <th className="text-center py-4 px-4 text-sm font-semibold text-dashboard-muted">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account) => (
                    <tr 
                      key={account.id} 
                      className="border-b border-dashboard-border/50 hover:bg-dashboard-border/30 transition-colors"
                    >
                      <td className="py-4 px-4">
                        <span className="text-sm font-medium text-dashboard-text">{account.name}</span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-dashboard-muted" />
                          <span className="text-sm text-dashboard-text">{account.email}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-dashboard-muted font-mono">
                            {showPasswords[account.id] ? account.password : '••••••••'}
                          </span>
                          <button
                            onClick={() => togglePasswordVisibility(account.id)}
                            className="p-1 text-dashboard-muted hover:text-dashboard-text transition-colors"
                          >
                            {showPasswords[account.id] ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-dashboard-muted" />
                          <span className="text-sm text-dashboard-text">{account.companyName}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className={cn(
                          'px-2 py-1 rounded-full text-xs font-medium',
                          getRoleBadgeColor(account.role)
                        )}>
                          {getRoleLabel(account.role)}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleEdit(account)}
                            className="p-2 text-dashboard-muted hover:text-dashboard-text hover:bg-dashboard-border rounded-lg transition-colors"
                            title="수정"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(account.id)}
                            className="p-2 text-dashboard-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* 등록/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dashboard-card border border-dashboard-border rounded-2xl w-full max-w-lg animate-slide-up">
            <div className="flex items-center justify-between p-6 border-b border-dashboard-border">
              <h2 className="text-xl font-semibold text-dashboard-text">
                {editingAccount ? '계정 수정' : '새 계정 추가'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false)
                  setEditingAccount(null)
                  resetForm()
                }}
                className="p-2 text-dashboard-muted hover:text-dashboard-text hover:bg-dashboard-border rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <Input
                label="이름"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="사용자 이름"
                required
              />
              
              <Input
                label="이메일"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="이메일 주소"
                required
              />
              
              <Input
                label={editingAccount ? "비밀번호 (변경 시에만 입력)" : "비밀번호"}
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={editingAccount ? "변경하지 않으려면 비워두세요" : "비밀번호"}
                required={!editingAccount}
              />
              
              <Select
                label="소속 회사"
                value={formData.companyCode}
                onChange={(e) => setFormData({ ...formData, companyCode: e.target.value })}
                options={COMPANIES}
              />
              
              <Select
                label="권한"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                options={ROLES}
              />
              
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowModal(false)
                    setEditingAccount(null)
                    resetForm()
                  }}
                >
                  취소
                </Button>
                <Button type="submit">
                  <Save className="w-4 h-4 mr-2" />
                  {editingAccount ? '저장' : '추가'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
