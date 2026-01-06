/**
 * DailyChart Component
 * Displays daily hours bar chart
 */

import React from 'react';

interface DailyHoursItem {
  date: string;
  hours: number;
}

interface DailyChartProps {
  dailyHours: DailyHoursItem[];
  formatHours: (hours: number) => string;
  theme?: 'light' | 'dark';
}

export default function DailyChart({ dailyHours, formatHours, theme = 'light' }: DailyChartProps) {
  const isDark = theme === 'dark';
  const secondaryColor = isDark ? '#888888' : '#666666';
  const maxHours = Math.max(...dailyHours.map(d => d.hours));

  return (
    <div>
      <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
        Daily Hours
      </h3>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '200px' }}>
        {dailyHours.map((item) => {
          const heightPercent = maxHours > 0 ? (item.hours / maxHours) * 100 : 0;

          return (
            <div
              key={item.date}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: `${heightPercent}%`,
                  backgroundColor: '#3b82f6',
                  borderRadius: '4px 4px 0 0',
                  minHeight: item.hours > 0 ? '4px' : '0',
                  transition: 'height 0.3s ease',
                  position: 'relative',
                }}
                title={`${formatHours(item.hours)} hours`}
              >
                {heightPercent > 20 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '4px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#ffffff',
                    }}
                  >
                    {formatHours(item.hours)}
                  </div>
                )}
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: secondaryColor,
                  transform: 'rotate(-45deg)',
                  transformOrigin: 'center',
                  whiteSpace: 'nowrap',
                }}
              >
                {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
