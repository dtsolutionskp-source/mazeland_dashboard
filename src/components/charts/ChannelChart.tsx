'use client'

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts'
import { formatNumber, formatPercent } from '@/lib/utils'

interface ChannelData {
  name: string
  value: number
  color: string
}

interface ChannelChartProps {
  data: ChannelData[]
  title?: string
  height?: number
}

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export function ChannelChart({ data, title, height = 300 }: ChannelChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0)

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload
      const percent = (item.value / total) * 100
      
      return (
        <div className="bg-dashboard-card border border-dashboard-border rounded-lg p-3 shadow-xl">
          <p className="text-dashboard-text font-medium">{item.name}</p>
          <p className="text-sm text-dashboard-muted">
            {formatNumber(item.value)}명 ({formatPercent(percent)})
          </p>
        </div>
      )
    }
    return null
  }

  const renderLegend = () => (
    <div className="flex flex-wrap justify-center gap-4 mt-4">
      {data.map((entry, index) => (
        <div key={entry.name} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color || COLORS[index % COLORS.length] }}
          />
          <span className="text-sm text-dashboard-muted">{entry.name}</span>
        </div>
      ))}
    </div>
  )

  return (
    <div>
      {title && (
        <h3 className="text-lg font-semibold text-dashboard-text mb-4">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color || COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      {renderLegend()}
      <div className="text-center mt-4">
        <p className="text-2xl font-bold text-dashboard-text">{formatNumber(total)}</p>
        <p className="text-sm text-dashboard-muted">총 인원</p>
      </div>
    </div>
  )
}



