'use client'

import { useState } from 'react'
import { Header } from '@/components/dashboard/Header'
import { Card, CardHeader, Button, Select } from '@/components/ui'
import { SalesChart, ChannelChart } from '@/components/charts'
import { formatNumber, formatCurrency, formatPercent } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  Download,
  TrendingUp,
  TrendingDown,
  Calendar,
} from 'lucide-react'

// 임시 데이터
const salesData = [
  { date: '11/8', online: 35, offline: 62, total: 97 },
  { date: '11/9', online: 42, offline: 58, total: 100 },
  { date: '11/10', online: 38, offline: 71, total: 109 },
  { date: '11/11', online: 45, offline: 65, total: 110 },
  { date: '11/12', online: 52, offline: 78, total: 130 },
  { date: '11/13', online: 48, offline: 82, total: 130 },
  { date: '11/14', online: 55, offline: 90, total: 145 },
  { date: '11/15', online: 40, offline: 68, total: 108 },
  { date: '11/16', online: 38, offline: 55, total: 93 },
  { date: '11/17', online: 60, offline: 95, total: 155 },
  { date: '11/18', online: 35, offline: 48, total: 83 },
  { date: '11/19', online: 42, offline: 52, total: 94 },
  { date: '11/20', online: 38, offline: 58, total: 96 },
  { date: '11/21', online: 45, offline: 62, total: 107 },
  { date: '11/22', online: 50, offline: 70, total: 120 },
  { date: '11/23', online: 55, offline: 85, total: 140 },
  { date: '11/24', online: 62, offline: 92, total: 154 },
  { date: '11/25', online: 38, offline: 55, total: 93 },
  { date: '11/26', online: 42, offline: 60, total: 102 },
  { date: '11/27', online: 48, offline: 68, total: 116 },
  { date: '11/28', online: 45, offline: 65, total: 110 },
  { date: '11/29', online: 52, offline: 75, total: 127 },
  { date: '11/30', online: 35, offline: 43, total: 78 },
]

const channelData = [
  { name: '네이버 메이즈랜드25년', value: 300, color: '#22c55e', fee: 10 },
  { name: '메이즈랜드 입장권', value: 200, color: '#3b82f6', fee: 12 },
  { name: '메이즈랜드 입장권(단품)', value: 180, color: '#f59e0b', fee: 12 },
  { name: '일반채널 입장권', value: 150, color: '#ef4444', fee: 15 },
]

const categoryData = [
  { name: '개인', value: 1200, color: '#22c55e' },
  { name: '여행사', value: 580, color: '#3b82f6' },
  { name: '택시', value: 320, color: '#f59e0b' },
  { name: '도민', value: 187, color: '#8b5cf6' },
]

export default function SalesPage() {
  const [period, setPeriod] = useState('month')
  
  const totalOnline = salesData.reduce((sum, d) => sum + d.online, 0)
  const totalOffline = salesData.reduce((sum, d) => sum + d.offline, 0)
  const totalVisitors = totalOnline + totalOffline
  const totalRevenue = totalVisitors * 3000

  // 채널별 수수료 계산
  const channelWithFee = channelData.map(c => ({
    ...c,
    revenue: c.value * 3000,
    feeAmount: Math.round(c.value * 3000 * (c.fee / 100)),
    netRevenue: Math.round(c.value * 3000 * (1 - c.fee / 100)),
  }))
  
  const totalFee = channelWithFee.reduce((sum, c) => sum + c.feeAmount, 0)

  return (
    <div className="min-h-screen">
      <Header
        title="판매 분석"
        description="채널별, 구분별 판매 현황을 상세히 분석합니다"
      />
      
      <div className="p-8 space-y-6">
        {/* 필터 및 액션 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              options={[
                { value: 'week', label: '최근 1주' },
                { value: 'month', label: '최근 1개월' },
                { value: '3months', label: '최근 3개월' },
              ]}
              className="w-40"
            />
          </div>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            데이터 내보내기
          </Button>
        </div>

        {/* 요약 통계 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="text-center">
            <p className="text-sm text-dashboard-muted">전체 방문객</p>
            <p className="text-2xl font-bold text-dashboard-text mt-1">{formatNumber(totalVisitors)}명</p>
          </Card>
          <Card className="text-center">
            <p className="text-sm text-dashboard-muted">인터넷 판매</p>
            <p className="text-2xl font-bold text-maze-500 mt-1">{formatNumber(totalOnline)}명</p>
            <p className="text-xs text-dashboard-muted">{formatPercent((totalOnline / totalVisitors) * 100)}</p>
          </Card>
          <Card className="text-center">
            <p className="text-sm text-dashboard-muted">현장 판매</p>
            <p className="text-2xl font-bold text-blue-500 mt-1">{formatNumber(totalOffline)}명</p>
            <p className="text-xs text-dashboard-muted">{formatPercent((totalOffline / totalVisitors) * 100)}</p>
          </Card>
          <Card className="text-center">
            <p className="text-sm text-dashboard-muted">총 매출</p>
            <p className="text-2xl font-bold text-dashboard-text mt-1">{formatCurrency(totalRevenue)}</p>
          </Card>
          <Card className="text-center">
            <p className="text-sm text-dashboard-muted">채널 수수료</p>
            <p className="text-2xl font-bold text-orange-500 mt-1">{formatCurrency(totalFee)}</p>
          </Card>
        </div>

        {/* 일별 추이 */}
        <Card>
          <CardHeader
            title="일별 방문객 추이"
            description="인터넷/현장 판매 구분"
          />
          <SalesChart data={salesData} height={350} />
        </Card>

        {/* 채널별 & 구분별 분석 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader
              title="채널별 판매 현황"
              description="인터넷 판매 채널별 분석"
            />
            <ChannelChart data={channelData} height={250} />
          </Card>
          
          <Card>
            <CardHeader
              title="구분별 판매 현황"
              description="고객 유형별 분석"
            />
            <ChannelChart data={categoryData} height={250} />
          </Card>
        </div>

        {/* 채널별 상세 테이블 */}
        <Card>
          <CardHeader
            title="채널별 수수료 상세"
            description="채널별 매출 및 수수료 현황"
          />
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dashboard-border">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-dashboard-muted">채널</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-dashboard-muted">인원</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-dashboard-muted">매출</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-dashboard-muted">수수료율</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-dashboard-muted">수수료</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-dashboard-muted">순매출</th>
                </tr>
              </thead>
              <tbody>
                {channelWithFee.map((channel, index) => (
                  <tr 
                    key={channel.name}
                    className="border-b border-dashboard-border/50 hover:bg-dashboard-border/30 transition-colors"
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: channel.color }}
                        />
                        <span className="text-dashboard-text">{channel.name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right text-dashboard-text">
                      {formatNumber(channel.value)}명
                    </td>
                    <td className="py-4 px-4 text-right text-dashboard-text">
                      {formatCurrency(channel.revenue)}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-500/20 text-orange-500">
                        {channel.fee}%
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right text-orange-500">
                      {formatCurrency(channel.feeAmount)}
                    </td>
                    <td className="py-4 px-4 text-right font-semibold text-maze-500">
                      {formatCurrency(channel.netRevenue)}
                    </td>
                  </tr>
                ))}
                {/* 현장 판매 행 */}
                <tr className="border-b border-dashboard-border/50 hover:bg-dashboard-border/30 transition-colors">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <span className="text-dashboard-text">현장 판매</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right text-dashboard-text">
                    {formatNumber(totalOffline)}명
                  </td>
                  <td className="py-4 px-4 text-right text-dashboard-text">
                    {formatCurrency(totalOffline * 3000)}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-maze-500/20 text-maze-500">
                      0%
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right text-dashboard-muted">
                    -
                  </td>
                  <td className="py-4 px-4 text-right font-semibold text-maze-500">
                    {formatCurrency(totalOffline * 3000)}
                  </td>
                </tr>
                {/* 합계 */}
                <tr className="bg-dashboard-border/30 font-semibold">
                  <td className="py-4 px-4 text-dashboard-text">합계</td>
                  <td className="py-4 px-4 text-right text-dashboard-text">
                    {formatNumber(totalVisitors)}명
                  </td>
                  <td className="py-4 px-4 text-right text-dashboard-text">
                    {formatCurrency(totalRevenue)}
                  </td>
                  <td className="py-4 px-4 text-right text-dashboard-muted">-</td>
                  <td className="py-4 px-4 text-right text-orange-500">
                    {formatCurrency(totalFee)}
                  </td>
                  <td className="py-4 px-4 text-right text-maze-500">
                    {formatCurrency(totalRevenue - totalFee)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}



