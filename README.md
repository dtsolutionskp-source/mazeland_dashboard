# 메이즈랜드 정산/마케팅 통합 대시보드

제주도 메이즈랜드 테마파크의 매출 분석, 정산 관리, 마케팅 로그 기능을 제공하는 통합 대시보드입니다.

## 🚀 주요 기능

### 1. 대시보드
- 핵심 지표 카드 (방문객, 매출, 성장률)
- 일별 방문객 추이 그래프
- 채널별/구분별 판매 비중
- 회사별 정산 현황

### 2. 데이터 업로드
- 엑셀 파일 드래그 앤 드롭 업로드
- 자동 데이터 파싱 및 검증
- 정산 자동 계산

### 3. 판매 분석
- 인터넷/현장 판매 구분
- 채널별 수수료 계산
- 기간별 추이 분석

### 4. 정산 현황
- 회사별 매출/비용/이익/이익률
- 역할에 따른 데이터 필터링
- 정산 흐름 시각화

### 5. 마케팅 로그
- 캠페인/이슈/날씨 등 이벤트 기록
- 차트와 연동되는 마커 표시
- CRUD 기능

### 6. AI 인사이트
- 주간/월간 자동 분석
- 채널별 성과 분석
- 맞춤 질문 기능
- OpenAI API 연동

### 7. 관리자 기능
- 사용자 관리
- 회사 관리
- 역할 기반 권한 관리

## 🛠 기술 스택

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL + Prisma ORM
- **Charts**: Recharts
- **Auth**: JWT (jose)
- **Excel**: xlsx
- **AI**: OpenAI API

## 📦 설치 및 실행

### 1. 패키지 설치

```bash
cd mazeland-dashboard
npm install
```

### 2. 환경 변수 설정

`.env` 파일을 생성하고 다음 내용을 설정:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/mazeland?schema=public"

# JWT Secret
JWT_SECRET="your-super-secret-jwt-key"

# OpenAI (선택)
OPENAI_API_KEY="sk-your-openai-api-key"
```

### 3. 데이터베이스 설정

```bash
# Prisma 클라이언트 생성
npm run db:generate

# 데이터베이스 마이그레이션
npm run db:push

# 초기 데이터 시드
npm run db:seed
```

### 4. 개발 서버 실행

```bash
npm run dev
```

http://localhost:3000 에서 확인

## 👥 테스트 계정

| 이메일 | 비밀번호 | 역할 |
|--------|----------|------|
| admin@mazeland.com | password123 | 최고 관리자 |
| skp@mazeland.com | password123 | SKP 관리자 |
| maze@mazeland.com | password123 | 메이즈랜드 관리자 |
| culture@mazeland.com | password123 | 컬처커넥션 관리자 |
| agency@mazeland.com | password123 | 운영대행사 관리자 |

## 📊 정산 구조

### 가격 및 수수료

| 항목 | 금액/비율 |
|------|----------|
| 기본 1인당 가격 | 3,000원 |
| 네이버 메이즈랜드25년 | 10% |
| 메이즈랜드 입장권 | 12% |
| 메이즈랜드 입장권(단품) | 12% |
| 일반채널 입장권 | 15% |
| 현장 판매 | 0% |

### 회사별 정산

```
[SKP]
- 매출 = 순매출(인터넷+현장)
- 비용 = 메이즈랜드 1,000원 + 컬처커넥션 500원
- 수익 = 매출 + 플랫폼 이용료 200원
- 이익 = 수익 - 비용

[메이즈랜드]
- 매출 = 1,000원 × 전체인원
- 비용 = 500원 × 전체인원
- 이익 = 500원 × 전체인원

[컬처커넥션]
- 매출 = 1,000원 × 전체인원
- 비용 = 200원 × 전체인원
- 이익 = 800원 × 전체인원

[운영대행사]
- 파라미터화 (기본 0%)
```

## 📁 프로젝트 구조

```
mazeland-dashboard/
├── prisma/
│   ├── schema.prisma      # DB 스키마
│   └── seed.ts            # 초기 데이터
├── src/
│   ├── app/               # Next.js App Router
│   │   ├── (dashboard)/   # 대시보드 페이지들
│   │   ├── api/           # API 라우트
│   │   └── login/         # 로그인 페이지
│   ├── components/
│   │   ├── charts/        # 차트 컴포넌트
│   │   ├── dashboard/     # 레이아웃 컴포넌트
│   │   └── ui/            # 기본 UI 컴포넌트
│   └── lib/
│       ├── settlement/    # 정산 계산 로직
│       ├── auth.ts        # 인증 유틸리티
│       ├── excel-parser.ts # 엑셀 파서
│       └── prisma.ts      # Prisma 클라이언트
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

## 🔐 역할별 권한

| 기능 | SUPER | SKP | MAZE | CULTURE | AGENCY |
|------|-------|-----|------|---------|--------|
| 전체 대시보드 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 자사 대시보드 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 데이터 업로드 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 전체 정산 조회 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 타사 마진 조회 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 마케팅 로그 | ✅ | ✅ | ✅ | ✅ | ✅ |
| AI 인사이트 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 사용자 관리 | ✅ | ❌ | ❌ | ❌ | ❌ |

## 📝 라이선스

ISC
