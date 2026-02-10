import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'

const COMPANY_NAMES: Record<string, string> = {
  SKP: 'SK플래닛',
  MAZE: '메이즈랜드',
  CULTURE: '컬처커넥션',
  FMC: 'FMC',
}

// 계정 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    if (user.role !== 'SUPER_ADMIN' && user.role !== 'SKP_ADMIN') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const { id } = params
    const body = await request.json()
    const { email, password, name, role, companyCode } = body

    // 기존 사용자 조회
    const existingUser = await prisma.user.findUnique({
      where: { id },
      include: { company: true },
    })

    if (!existingUser) {
      return NextResponse.json({ error: '계정을 찾을 수 없습니다.' }, { status: 404 })
    }

    // 이메일 중복 체크 (자신 제외)
    if (email && email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({ where: { email } })
      if (emailExists) {
        return NextResponse.json({ error: '이미 사용 중인 이메일입니다.' }, { status: 400 })
      }
    }

    // 회사 변경 시 처리
    let companyId = existingUser.companyId
    if (companyCode && companyCode !== existingUser.company?.code) {
      let company = await prisma.company.findUnique({ where: { code: companyCode } })
      if (!company) {
        company = await prisma.company.create({
          data: {
            code: companyCode,
            name: COMPANY_NAMES[companyCode] || companyCode,
          },
        })
      }
      companyId = company.id
    }

    // 비밀번호 해시 (변경 시에만)
    let hashedPassword: string | undefined
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10)
    }

    // 업데이트
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        ...(email && { email }),
        ...(hashedPassword && { password: hashedPassword }),
        ...(name && { name }),
        ...(role && { role }),
        ...(companyId && { companyId }),
      },
      include: { company: true },
    })

    const account = {
      id: updatedUser.id,
      email: updatedUser.email,
      password: '********',
      name: updatedUser.name,
      role: updatedUser.role,
      companyCode: updatedUser.company?.code || '',
      companyName: updatedUser.company?.name || '',
      createdAt: updatedUser.createdAt.toISOString(),
    }

    return NextResponse.json({ account })
  } catch (error) {
    console.error('Update account error:', error)
    return NextResponse.json({ error: '계정 수정 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 계정 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    if (user.role !== 'SUPER_ADMIN' && user.role !== 'SKP_ADMIN') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const { id } = params

    // 기존 사용자 조회
    const existingUser = await prisma.user.findUnique({
      where: { id },
      include: { company: true },
    })

    if (!existingUser) {
      return NextResponse.json({ error: '계정을 찾을 수 없습니다.' }, { status: 404 })
    }

    // SKP 계정은 삭제 불가
    if (existingUser.company?.code === 'SKP') {
      return NextResponse.json({ error: 'SKP 관리자 계정은 삭제할 수 없습니다.' }, { status: 400 })
    }

    // 삭제 대신 비활성화 (soft delete)
    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete account error:', error)
    return NextResponse.json({ error: '계정 삭제 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
