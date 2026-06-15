import React from 'react';
import { XAxis } from 'recharts';
import {
  formatHourAxisTick,
  HOURLY_X_AXIS_DOMAIN,
  HOURLY_X_AXIS_TICKS,
} from '@/utils/hourlyProjections';

export const hourlyChartMargins = {
  sm: { top: 4, right: 2, left: 2, bottom: 16 },
  md: { top: 8, right: 8, left: 8, bottom: 24 },
  lg: { top: 8, right: 12, left: 12, bottom: 28 },
};

export default function HourlyChartXAxis({
  tickFontSize = 8,
  tickFill = '#94a3b8',
  height = 22,
  tickDy = 10,
  ...props
}) {
  const renderTick = ({ x, y, payload }) => {
    const value = Number(payload?.value);
    const label = formatHourAxisTick(value);
    if (!label) return null;
    const textAnchor = value === 0 ? 'start' : value === 24 ? 'end' : 'middle';
    return (
      <text x={x} y={y + tickDy} textAnchor={textAnchor} fontSize={tickFontSize} fill={tickFill}>
        {label}
      </text>
    );
  };

  return (
    <XAxis
      dataKey="hour"
      type="number"
      domain={HOURLY_X_AXIS_DOMAIN}
      ticks={HOURLY_X_AXIS_TICKS}
      allowDecimals={false}
      axisLine={false}
      tickLine={false}
      tick={renderTick}
      height={height}
      {...props}
    />
  );
}
