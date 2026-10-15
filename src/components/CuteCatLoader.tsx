import React from 'react';

interface CuteCatLoaderProps {
  progress: number;
  stage: string;
}

export const CuteCatLoader: React.FC<CuteCatLoaderProps> = ({ progress, stage }) => {
  return (
    <div className="flex flex-col items-center justify-center select-none text-zinc-800">
      {/* 动态卡哇伊猫猫角色与纸团互动 */}
      <div className="relative w-48 h-44 flex items-center justify-center">
        {/* 背景可爱光晕与悬浮小气泡/星光 */}
        <div className="absolute w-36 h-36 rounded-full bg-white/70 blur-xl animate-pulse pointer-events-none" />
        
        {/* 飘浮的可爱小装饰星光 */}
        <span className="absolute -top-1 left-4 text-emerald-600/60 text-lg animate-bounce select-none" style={{ animationDuration: '2s' }}>✦</span>
        <span className="absolute top-6 right-3 text-pink-400 text-sm animate-ping select-none" style={{ animationDuration: '2.5s' }}>♥</span>
        <span className="absolute bottom-6 left-2 text-yellow-500 text-base animate-pulse select-none">✨</span>

        {/* SVG 精致手绘风卡哇伊小猫 */}
        <svg
          viewBox="0 0 200 180"
          className="w-44 h-40 drop-shadow-lg filter transition-transform hover:scale-105"
        >
          <defs>
            {/* 柔软毛色渐变 */}
            <linearGradient id="catBody" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#fff5ee" />
            </linearGradient>
            {/* 耳朵粉嫩内侧 */}
            <linearGradient id="earPink" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffb6c1" />
              <stop offset="100%" stopColor="#ff9aa2" />
            </linearGradient>
            {/* 纸团渐变 */}
            <linearGradient id="paperBall" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#e2e8f0" />
            </linearGradient>
          </defs>

          {/* 摇摆的小尾巴 */}
          <path
            d="M 148 135 C 175 140, 185 110, 175 95 C 168 85, 155 92, 160 102 C 165 112, 155 125, 140 130 Z"
            fill="#ffffff"
            stroke="#2d3748"
            strokeWidth="3.5"
            strokeLinecap="round"
            className="origin-bottom-left"
            style={{
              animation: 'swayTail 1.6s ease-in-out infinite alternate',
              transformOrigin: '145px 135px',
            }}
          />

          {/* 猫猫身体 */}
          <ellipse
            cx="100"
            cy="125"
            rx="52"
            ry="40"
            fill="url(#catBody)"
            stroke="#2d3748"
            strokeWidth="3.5"
          />

          {/* 左耳 */}
          <g>
            <polygon
              points="60,65 42,22 84,48"
              fill="url(#catBody)"
              stroke="#2d3748"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            {/* 耳内粉肉色 */}
            <polygon
              points="60,58 48,29 76,47"
              fill="url(#earPink)"
            />
          </g>

          {/* 右耳 */}
          <g>
            <polygon
              points="140,65 158,22 116,48"
              fill="url(#catBody)"
              stroke="#2d3748"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            {/* 耳内粉肉色 */}
            <polygon
              points="140,58 152,29 124,47"
              fill="url(#earPink)"
            />
          </g>

          {/* 圆滚滚猫头 */}
          <ellipse
            cx="100"
            cy="78"
            rx="56"
            ry="46"
            fill="url(#catBody)"
            stroke="#2d3748"
            strokeWidth="3.5"
          />

          {/* 头顶呆毛 */}
          <path
            d="M 100 32 Q 103 22 108 26 Q 102 28 100 32"
            fill="#ffb7b2"
          />

          {/* 扑闪扑闪的大眼睛 (带可爱高光) */}
          <g className="animate-pulse" style={{ animationDuration: '3s' }}>
            {/* 左眼 */}
            <ellipse cx="78" cy="74" rx="8" ry="11" fill="#2d3748" />
            <circle cx="75" cy="70" r="4" fill="#ffffff" />
            <circle cx="81" cy="77" r="1.8" fill="#ffffff" />
            {/* 右眼 */}
            <ellipse cx="122" cy="74" rx="8" ry="11" fill="#2d3748" />
            <circle cx="119" cy="70" r="4" fill="#ffffff" />
            <circle cx="125" cy="77" r="1.8" fill="#ffffff" />
          </g>

          {/* 标志性红晕腮红 */}
          <ellipse cx="64" cy="85" rx="9" ry="5.5" fill="#ff9aa2" opacity="0.65" />
          <ellipse cx="136" cy="85" rx="9" ry="5.5" fill="#ff9aa2" opacity="0.65" />

          {/* 小巧粉色猫鼻头 */}
          <polygon points="98,82 102,82 100,85" fill="#ff758f" />

          {/* 萌萌哒「w」猫咪嘴 */}
          <path
            d="M 94 86 Q 97 91 100 86 Q 103 91 106 86"
            fill="none"
            stroke="#2d3748"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* 可爱猫胡须 */}
          <line x1="50" y1="78" x2="30" y2="76" stroke="#4a5568" strokeWidth="2" strokeLinecap="round" />
          <line x1="50" y1="84" x2="28" y2="86" stroke="#4a5568" strokeWidth="2" strokeLinecap="round" />
          <line x1="150" y1="78" x2="170" y2="76" stroke="#4a5568" strokeWidth="2" strokeLinecap="round" />
          <line x1="150" y1="84" x2="172" y2="86" stroke="#4a5568" strokeWidth="2" strokeLinecap="round" />

          {/* 踩奶/玩耍的小山竹猫爪 (带有呼吸动画) */}
          {/* 左爪 */}
          <ellipse
            cx="80"
            cy="142"
            rx="12"
            ry="9"
            fill="#ffffff"
            stroke="#2d3748"
            strokeWidth="3"
            style={{
              animation: 'pawKneadLeft 1.2s ease-in-out infinite alternate',
              transformOrigin: '80px 142px',
            }}
          />
          {/* 右爪（正在拨弄小纸团） */}
          <ellipse
            cx="120"
            cy="140"
            rx="12"
            ry="9"
            fill="#ffffff"
            stroke="#2d3748"
            strokeWidth="3"
            style={{
              animation: 'pawKneadRight 1.2s ease-in-out infinite alternate',
              transformOrigin: '120px 140px',
            }}
          />

          {/* 猫猫面前的小纸团（随着爪子轻轻滚动） */}
          <g
            style={{
              animation: 'paperRoll 1.2s ease-in-out infinite alternate',
              transformOrigin: '100px 146px',
            }}
          >
            <polygon
              points="94,142 103,138 109,144 105,152 96,150"
              fill="url(#paperBall)"
              stroke="#2d3748"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            {/* 纸团折痕线 */}
            <path d="M 96 142 L 105 146 L 102 151" stroke="#a0aec0" strokeWidth="1.5" fill="none" />
            <path d="M 103 138 L 105 146" stroke="#a0aec0" strokeWidth="1.5" fill="none" />
          </g>
        </svg>
      </div>

      {/* 文案与进度显示 */}
      <div className="flex flex-col items-center gap-2 mt-1">
        <div className="flex items-center gap-2">
          <span className="inline-block text-lg animate-bounce">🐾</span>
          <p className="font-bold text-lg tracking-wide text-zinc-900 font-sans">
            猫猫正在帮你揉纸团...
          </p>
          <span className="inline-block text-lg animate-bounce" style={{ animationDelay: '0.2s' }}>🐾</span>
        </div>

        <p className="text-xs font-mono font-medium text-emerald-950/80 bg-white/70 px-3 py-1 rounded-full shadow-xs backdrop-blur-xs">
          {stage}
        </p>

        {/* 甜美马卡龙圆润进度条 */}
        <div className="flex items-center gap-3 mt-1.5 w-60">
          <div className="flex-1 h-3 bg-white/60 p-0.5 rounded-full shadow-inner border border-white/80 overflow-hidden">
            <div
              className="h-full bg-linear-to-r from-emerald-400 via-teal-400 to-pink-400 rounded-full transition-all duration-300 shadow-sm"
              style={{ width: `${Math.max(8, Math.min(100, progress))}%` }}
            />
          </div>
          <span className="text-xs font-mono font-extrabold text-zinc-800 w-10 text-right">
            {Math.round(progress)}%
          </span>
        </div>
      </div>

      {/* 嵌入猫猫动画关键帧 */}
      <style>{`
        @keyframes swayTail {
          0% { transform: rotate(-8deg); }
          100% { transform: rotate(14deg); }
        }
        @keyframes pawKneadLeft {
          0% { transform: translateY(0px) scale(1); }
          100% { transform: translateY(-5px) scale(1.05); }
        }
        @keyframes pawKneadRight {
          0% { transform: translateY(-4px) scale(1.05); }
          100% { transform: translateY(1px) scale(0.98); }
        }
        @keyframes paperRoll {
          0% { transform: rotate(-10deg) translateX(-2px); }
          100% { transform: rotate(15deg) translateX(3px); }
        }
      `}</style>
    </div>
  );
};
