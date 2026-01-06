import React from 'react';

/**
 * Border-based spinner component for reliable rendering
 * Uses border animation for cross-browser compatibility
 * Automatically adapts to theme using Tailwind classes
 */
export default function Spinner(): JSX.Element {
  return (
    <div className="min-h-[210px] flex items-center justify-center">
      <div
        className="w-10 h-10 rounded-full border-4 border-gray-200 dark:border-gray-700"
        style={{
          borderTopColor: 'rgb(255, 136, 0)',
          animation: 'spin 1s linear infinite'
        }}
      />
      <style>{`
        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
