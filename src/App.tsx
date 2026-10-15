import React, { useState, useEffect, useRef } from 'react';
import { PaperCrumpleScene } from './components/PaperCrumpleScene';
import { CuteCatLoader } from './components/CuteCatLoader';
import { LoveLetterQuote } from './data/quotes';
import { Sliders, RefreshCw, Copy, Check, Heart, Sparkles, AlertCircle } from 'lucide-react';

const MIN_SPLASH_DURATION_MS = 3000;

const STAGE_MILESTONES = [
  { at: 0, text: '正在唤醒小猫与收集 100 封心动情书...' },
  { at: 20, text: '正在绘制手绘方格与古典信笺纹理...' },
  { at: 45, text: '正在将浪漫金句研磨入墨、装入纸团...' },
  { at: 70, text: '正在平滑法线与调配 3D 纸张柔韧度...' },
  { at: 90, text: '正在将情书纸团撒向地面物理空间...' },
  { at: 100, text: '情书已就绪！点击展开专属温暖 💌' },
];

export default function App() {
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(12);
  const [loadingStage, setLoadingStage] = useState('正在唤醒小猫与收集 100 封心动情书...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [guiOpen, setGuiOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      return p.get('gui') === 'on';
    }
    return false;
  });
  const [activeQuote, setActiveQuote] = useState<LoveLetterQuote | null>(null);
  const [copied, setCopied] = useState(false);
  const [sceneKey, setSceneKey] = useState(0);

  const sceneLoadedRef = useRef(false);
  const startTimeRef = useRef(Date.now());
  const sceneMethodsRef = useRef<{ shakeScene: () => void } | null>(null);
  const [shaking, setShaking] = useState(false);

  // 控制 3 秒平滑加载动画与真实数据加载同步
  useEffect(() => {
    sceneLoadedRef.current = false;
    startTimeRef.current = Date.now();
    setLoading(true);
    setLoadingProgress(12);
    setLoadingStage(STAGE_MILESTONES[0].text);

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const timeRatio = Math.min(elapsed / MIN_SPLASH_DURATION_MS, 1);

      let targetProgress = Math.round(12 + timeRatio * 88);

      if (!sceneLoadedRef.current && targetProgress > 95) {
        targetProgress = 95;
      }

      setLoadingProgress(targetProgress);

      const currentMilestone = [...STAGE_MILESTONES]
        .reverse()
        .find((m) => targetProgress >= m.at);
      if (currentMilestone) {
        setLoadingStage(currentMilestone.text);
      }

      if (elapsed >= MIN_SPLASH_DURATION_MS && sceneLoadedRef.current) {
        clearInterval(interval);
        setLoadingProgress(100);
        setLoadingStage('情书已就绪！点击展开专属温暖 💌');

        setTimeout(() => {
          setLoading(false);
        }, 320);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [sceneKey]);

  const handleSceneLoaded = () => {
    sceneLoadedRef.current = true;
  };

  const handleReset = () => {
    setActiveQuote(null);
    setErrorMessage(null);
    setSceneKey((k) => k + 1);
  };

  const handleShake = () => {
    setActiveQuote(null);
    if (sceneMethodsRef.current) {
      sceneMethodsRef.current.shakeScene();
      setShaking(true);
      setTimeout(() => setShaking(false), 600);
    }
  };

  const handleCopyQuote = () => {
    if (!activeQuote) return;
    const textToCopy = `「${activeQuote.salutation}」\n\n${activeQuote.content}\n\n${activeQuote.signature}`;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#38ffc3] font-sans select-none">
      {/* 3D 揉皱纸团物理场景 */}
      <PaperCrumpleScene
        key={sceneKey}
        onLoaded={handleSceneLoaded}
        onError={(err) => {
          setLoading(false);
          setErrorMessage(err.message || '加载模型或纹理数据失败，请重试');
        }}
        guiVisible={guiOpen}
        onToggleGui={() => setGuiOpen((prev) => !prev)}
        onCardStateChange={(quote) => setActiveQuote(quote)}
        sceneRef={sceneMethodsRef}
      />

      {/* 数据加载中遮罩与可爱猫猫开屏特效 (持续 3 秒，让用户体验治愈开屏) */}
      {loading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#38ffc3]/94 backdrop-blur-md transition-opacity duration-500">
          <div className="p-8 sm:p-10 rounded-3xl bg-white/50 shadow-2xl border border-white/70 backdrop-blur-sm animate-fade-in pointer-events-auto">
            <CuteCatLoader progress={loadingProgress} stage={loadingStage} />
          </div>
        </div>
      )}

      {/* 错误提示栏 */}
      {errorMessage && (
        <div className="absolute inset-x-4 top-4 z-50 flex justify-center pointer-events-none">
          <div className="bg-red-950/95 border border-red-500/60 text-red-100 px-5 py-3 rounded-xl shadow-2xl text-sm max-w-lg pointer-events-auto flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 flex flex-col gap-1">
              <span className="font-semibold text-white">数据加载异常</span>
              <p className="text-xs text-red-200/90 whitespace-pre-line font-mono">{errorMessage}</p>
              <button
                onClick={handleReset}
                className="mt-2 self-start px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-medium transition-colors"
              >
                重新尝试加载
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 顶部操作工具栏 (z-50 确保不被任何弹层遮挡) */}
      <div className={`absolute top-3 sm:top-4 left-3 sm:left-4 z-50 flex items-center gap-2 pointer-events-auto flex-wrap ${shaking ? 'animate-bounce' : ''}`}>
        <div className="px-3 sm:px-3.5 py-1.5 bg-black/40 backdrop-blur-md text-white/95 rounded-full text-xs tracking-wide border border-white/20 shadow-sm flex items-center gap-1.5">
          <Heart className="w-3.5 h-3.5 text-pink-300 fill-pink-300 animate-pulse shrink-0" />
          <span className="font-semibold">揉皱情书</span>
          <span className="hidden sm:inline text-white/70">· 唯美金句</span>
        </div>

        <button
          onClick={handleShake}
          title="疯狂摇一摇：打乱所有纸团并重新降落"
          aria-label="疯狂摇一摇"
          className="px-3 sm:px-3.5 py-1.5 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white rounded-full backdrop-blur-md border border-white/30 transition-all shadow-md focus:outline-none flex items-center gap-1.5 text-xs font-bold cursor-pointer active:scale-95 animate-pulse"
        >
          <span className="text-sm">📳</span>
          <span>疯狂摇一摇</span>
        </button>

        <button
          onClick={() => setGuiOpen((prev) => !prev)}
          title="切换模拟参数控制面板"
          aria-label="切换控制面板"
          className={`px-3 py-1.5 rounded-full text-xs backdrop-blur-md border border-white/20 transition-all flex items-center gap-1.5 shadow-sm focus:outline-none cursor-pointer ${
            guiOpen
              ? 'bg-white text-zinc-900 font-bold shadow-md ring-2 ring-black/20'
              : 'bg-black/40 hover:bg-black/60 text-white/90 hover:text-white'
          }`}
        >
          <Sliders className="w-3 h-3" />
          <span>{guiOpen ? '关闭调光' : '调光/物理'}</span>
        </button>
      </div>

      {/* 底部浮动交互胶囊条 (极简轻盈无遮挡设计) */}
      <div className="absolute bottom-4 sm:bottom-6 inset-x-0 z-30 flex justify-center pointer-events-none px-4">
        {activeQuote ? (
          <div className="bg-black/55 hover:bg-black/70 backdrop-blur-md border border-white/25 text-white px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full shadow-2xl flex items-center gap-2.5 sm:gap-3 animate-fade-in pointer-events-auto transition-all">
            <div className="flex items-center gap-1.5 sm:gap-2 pr-2 border-r border-white/20">
              <span className="w-2 h-2 rounded-full bg-pink-400 animate-pulse shrink-0" />
              <span className="text-xs font-serif tracking-wide text-white/90 whitespace-nowrap">
                第 {activeQuote.id} 封 · {activeQuote.salutation}
              </span>
            </div>

            <button
              onClick={handleCopyQuote}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 hover:bg-white/35 active:scale-95 text-white text-xs font-medium transition-all cursor-pointer shadow-xs whitespace-nowrap"
              title="复制整篇金句到剪贴板"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  <span className="text-emerald-300 font-bold">已复制金句 ✨</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-amber-200" />
                  <span>复制金句</span>
                </>
              )}
            </button>

            <button
              onClick={() => setActiveQuote(null)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/25 text-white/75 hover:text-white text-xs transition-colors cursor-pointer whitespace-nowrap"
              title="折叠收回纸团"
            >
              <span>收起</span>
            </button>
          </div>
        ) : (
          <div className="bg-black/35 backdrop-blur-sm border border-white/20 text-white/90 px-5 py-2 rounded-full text-xs tracking-wider pointer-events-none shadow-md flex items-center gap-2 font-serif">
            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-spin" style={{ animationDuration: '4s' }} />
            <span>点击地面纸团展开心动情书 · 按住拖拽抓起并甩出投掷</span>
          </div>
        )}
      </div>
    </main>
  );
}
