import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameStatus, GameState, MoleState, Question, GameMode, MoleType, GameResult, Difficulty, EndReason, PlayMode, PowerUpType, PowerUp, ActivePowerUp } from './types';
import { generateQuestion, generateDistractors } from './utils/math';
import { HammerCursor } from './components/HammerCursor';
import { Mole } from './components/Mole';
import { playWhackSound, playClangSound, playErrorSound, playExplosionSound, playLevelStartSound } from './utils/audio';

const QUESTION_TIMEOUT = 3000; 
const BASE_MAX_LIVES = 5;
const TIME_LIMIT_SECONDS = 120; // 2 minutes

// 设备兼容性检查
const checkDeviceCompatibility = () => {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isLowEndDevice = navigator.deviceMemory && navigator.deviceMemory < 4;
  const isSlowCPU = navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4;
  const hasTouchSupport = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const hasAudioSupport = typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined';
  const hasCanvasSupport = typeof HTMLCanvasElement !== 'undefined';
  
  return {
    isMobile,
    isLowEndDevice,
    isSlowCPU,
    hasTouchSupport,
    hasAudioSupport,
    hasCanvasSupport,
    isCompatible: hasCanvasSupport // 基本兼容性检查
  };
};

// 获取设备兼容性配置
const getDeviceConfig = () => {
  const deviceInfo = checkDeviceCompatibility();
  
  return {
    deviceInfo,
    // 根据设备性能调整游戏参数
    gameParams: {
      questionTimeout: deviceInfo.isLowEndDevice ? QUESTION_TIMEOUT + 1000 : QUESTION_TIMEOUT,
      maxLives: deviceInfo.isLowEndDevice ? BASE_MAX_LIVES + 1 : BASE_MAX_LIVES,
      // 低端设备减少粒子效果数量
      particleCount: deviceInfo.isLowEndDevice ? 30 : 60,
      // 低端设备禁用音频以提高性能
      enableAudio: !deviceInfo.isLowEndDevice && deviceInfo.hasAudioSupport
    }
  };
};

interface FloatingText {
    id: number;
    x: number;
    y: number;
    content: string;
    color: string;
}

// 道具配置
const POWER_UPS: PowerUp[] = [
    {
        id: PowerUpType.ICE_CREAM,
        name: '冰淇淋',
        description: '1分钟内让倒计时时间变慢',
        icon: '🍦',
        cost: 80,
        duration: 60
    },
    {
        id: PowerUpType.LIFE_POTION,
        name: '生命药',
        description: '增加3条生命',
        icon: '🧪',
        cost: 100,
        duration: 0 // 立即生效，无持续时间
    },
    {
        id: PowerUpType.PAN,
        name: '平底锅',
        description: '1分钟内遇到戴头盔的地鼠可以敲打一次就通关',
        icon: '🍳',
        cost: 50,
        duration: 60
    },
    {
        id: PowerUpType.GOLDEN_LIGHT,
        name: '金光',
        description: '30秒内正确答案的地鼠会亮起金光',
        icon: '✨',
        cost: 150,
        duration: 30
    }
];

// 锤子皮肤配置，用于兼容现有的锤子光标组件
const DEFAULT_HAMMER_SKIN = 'BASIC';

const App: React.FC = () => {
  // 设备配置
  const deviceConfig = getDeviceConfig();
  const [isDeviceCompatible, setIsDeviceCompatible] = useState(true);
  
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    lives: deviceConfig.gameParams.maxLives,
    maxLives: deviceConfig.gameParams.maxLives,
    combo: 0,
    maxCombo: 0,
    status: GameStatus.IDLE,
    playMode: PlayMode.UNLIMITED,
    globalTimeLeft: TIME_LIMIT_SECONDS,
    highScore: parseInt(localStorage.getItem('math_hammer_highscore') || '0'),
    selectedMode: GameMode.MIXED,
    selectedDifficulty: Difficulty.HARD,
    correctCount: 0,
    isExploded: false,
    isWatchingAd: false,
    powerUpsUsed: 0,
    activePowerUps: [],
  });

  const [question, setQuestion] = useState<Question | null>(null);
  const [questionProgress, setQuestionProgress] = useState(100); 
  const [moles, setMoles] = useState<MoleState[]>(
    Array.from({ length: 9 }, (_, i) => ({ 
        id: i, isActive: false, value: null, isCorrect: false, type: MoleType.NORMAL, hitsRequired: 1 
    }))
  );
  const [isShaking, setIsShaking] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showRules, setShowRules] = useState(false); // 游戏规则介绍页面
  const [pendingGameMode, setPendingGameMode] = useState<GameMode | null>(null); // 待开始的游戏模式
  const [adCountdown, setAdCountdown] = useState(0);
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const nextFloatId = useRef(0);
  
  const questionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const globalTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastConfettiTimeRef = useRef<number>(0);
  const powerUpTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // 检查设备兼容性
  useEffect(() => {
    if (!deviceConfig.deviceInfo.isCompatible) {
      setIsDeviceCompatible(false);
      console.warn('Device not compatible:', deviceConfig.deviceInfo);
    } else {
      console.log('Device info:', deviceConfig.deviceInfo);
      console.log('Game params:', deviceConfig.gameParams);
    }
  }, []);
  
  // 检查道具是否激活
  const isPowerUpActive = useCallback((type: PowerUpType): boolean => {
    const now = Date.now();
    return gameState.activePowerUps.some(powerUp => {
      return powerUp.type === type && now < powerUp.startTime + powerUp.duration * 1000;
    });
  }, [gameState.activePowerUps]);
  
  // 更新激活的道具状态
  const updateActivePowerUps = useCallback(() => {
    const now = Date.now();
    setGameState(prev => ({
      ...prev,
      activePowerUps: prev.activePowerUps.filter(powerUp => {
        return now < powerUp.startTime + powerUp.duration * 1000;
      })
    }));
  }, []);
  
  // 使用道具
  const usePowerUp = useCallback((powerUp: PowerUp) => {
    if (gameState.score < powerUp.cost) return false;
    
    const now = Date.now();
    
    setGameState(prev => {
      const updatedScore = prev.score - powerUp.cost;
      const updatedPowerUpsUsed = prev.powerUpsUsed + powerUp.cost;
      
      // 创建新的激活道具
      let newActivePowerUps = [...prev.activePowerUps];
      
      // 处理不同类型的道具
      switch (powerUp.id) {
        case PowerUpType.ICE_CREAM:
          // 添加冰淇淋道具效果
          newActivePowerUps.push({
            type: powerUp.id,
            startTime: now,
            duration: powerUp.duration
          });
          break;
          
        case PowerUpType.LIFE_POTION:
          // 立即增加3条生命
          return {
            ...prev,
            score: updatedScore,
            powerUpsUsed: updatedPowerUpsUsed,
            lives: Math.min(prev.maxLives, prev.lives + 3)
          };
          
        case PowerUpType.PAN:
          // 添加平底锅道具效果
          newActivePowerUps.push({
            type: powerUp.id,
            startTime: now,
            duration: powerUp.duration
          });
          break;
          
        case PowerUpType.GOLDEN_LIGHT:
          // 添加金光道具效果
          newActivePowerUps.push({
            type: powerUp.id,
            startTime: now,
            duration: powerUp.duration
          });
          break;
      }
      
      return {
        ...prev,
        score: updatedScore,
        powerUpsUsed: updatedPowerUpsUsed,
        activePowerUps: newActivePowerUps
      };
    });
    
    return true;
  }, [gameState.score]);

  const addFloatingText = useCallback((x: number, y: number, content: string, color: string) => {
    const id = nextFloatId.current++;
    // 如果是得分显示，固定位置到分数统计区域旁边
    let displayX = x;
    let displayY = y;
    if (content.startsWith('+')) {
      // 固定显示在分数统计区域右边（左上角）
      displayX = 180; // 调整为合适的位置
      displayY = 150;
    }
    setFloatingTexts(prev => [...prev, { id, x: displayX, y: displayY, content, color }]);
    setTimeout(() => {
      setFloatingTexts(prev => prev.filter(t => t.id !== id));
    }, 800);
  }, []);

  const getPerformanceInfo = (score: number): GameResult => {
    if (score === 0) return { grade: "和平主义者", comment: "只要我不动，数学就伤害不了我。Respect！" };
    if (score < 15) return { grade: "算数绝缘体", comment: "你的数学老师正在提刀赶来的路上..." };
    if (score <= 100) return { grade: "气氛组组长", comment: "地鼠连遗言都来不及写就被你敲晕了。别灰心，至少你戳屏幕的姿势很帅。" };
    if (score <= 250) return { grade: "心算小马达", comment: "这就有点秀了！这种运算速度，建议严查兴奋剂！" };
    if (score <= 500) return { grade: "算力天花板", comment: "警告！检测到非人类反应！你就是传说中伪装成人类的 AI 吗？" };
    return { grade: "掌管数字的神", comment: "人类的算力极限已被你突破。此刻，你就是真理！" };
  };

  const endGame = useCallback((reason: EndReason, currentQuestion: Question | null) => {
    if (questionTimerRef.current) clearInterval(questionTimerRef.current);
    if (globalTimerRef.current) clearInterval(globalTimerRef.current);
    if (powerUpTimerRef.current) clearInterval(powerUpTimerRef.current);

    setGameState(prev => {
      // 计算最终分数：答对题累积分数 - 道具消耗分数
      const finalScore = prev.score - prev.powerUpsUsed;
      const result = getPerformanceInfo(finalScore);
      const newHighScore = Math.max(prev.highScore, finalScore);
      
      // 更新最高分
      if (finalScore > prev.highScore) localStorage.setItem('math_hammer_highscore', finalScore.toString());

      return {
        ...prev,
        status: GameStatus.GAMEOVER,
        isExploded: reason === 'EXPLOSION',
        endReason: reason,
        lastQuestion: currentQuestion,
        result,
        highScore: newHighScore,
        isTrial: false,
      };
    });
  }, []);

  const triggerCelebration = useCallback(() => {
    const now = Date.now();
    if (now - lastConfettiTimeRef.current < 600) return;
    lastConfettiTimeRef.current = now;

    if (!(window as any).confetti) return;
    try {
      (window as any).confetti({
        particleCount: deviceConfig.gameParams.particleCount,
        spread: 60,            
        origin: { y: 0.7 },
        colors: ['#ff0000', '#ffa500', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#ee82ee'],
        gravity: 1.6,
        scalar: 0.8,
        ticks: 100
      });
    } catch (error) {
      console.warn('Failed to trigger celebration:', error);
    }
  }, [deviceConfig.gameParams.particleCount]);

  const startNewLevel = useCallback((mode: GameMode, difficulty: Difficulty, currentCorrectCount: number) => {
    if (questionTimerRef.current) clearInterval(questionTimerRef.current);
    playLevelStartSound();
    
    const q = generateQuestion(mode, difficulty);
    setQuestion(q);
    setQuestionProgress(100);

    // 检查冰淇淋道具是否激活，减慢倒计时
    const timeFactor = isPowerUpActive(PowerUpType.ICE_CREAM) ? 0.8 : 1.0;
    const step = (100 / (QUESTION_TIMEOUT / 50)) * timeFactor;

    questionTimerRef.current = setInterval(() => {
      setQuestionProgress(prev => {
        if (prev <= 0) {
          if (questionTimerRef.current) clearInterval(questionTimerRef.current);
          handleError('TIMEOUT', q);
          return 0;
        }
        return prev - step;
      });
    }, 50);

    const distractors = generateDistractors(q.answer);
    const holeIndices = Array.from({ length: 9 }, (_, i) => i).sort(() => Math.random() - 0.5);
    const newMoles: MoleState[] = Array.from({ length: 9 }, (_, i) => ({
      id: i, isActive: false, value: null, isCorrect: false, type: MoleType.NORMAL, hitsRequired: 1
    }));

    // 检查金光道具是否激活，正确答案地鼠亮金光
    const isHinted = isPowerUpActive(PowerUpType.GOLDEN_LIGHT);
    const numericSpots = [{ value: q.answer, isCorrect: true }, { value: distractors[0], isCorrect: false }, { value: distractors[1], isCorrect: false }].sort(() => Math.random() - 0.5);

    numericSpots.forEach((spot, i) => {
        const holeIdx = holeIndices[i];
        const shouldBeHardened = currentCorrectCount >= 5 && Math.random() < 0.2;
        // 检查平底锅道具是否激活，戴头盔的地鼠只需要一次击打
        const hitsRequired = shouldBeHardened && !isPowerUpActive(PowerUpType.PAN) ? 2 : 1;
        
        newMoles[holeIdx] = { 
            id: holeIdx, isActive: true, value: spot.value, isCorrect: spot.isCorrect, 
            type: shouldBeHardened ? MoleType.HARDENED : MoleType.NORMAL, 
            hitsRequired: hitsRequired, 
            isHinted: spot.isCorrect && isHinted 
        };
    });

    if (currentCorrectCount > 3 && Math.random() > 0.7) {
      const bombIdx = holeIndices[3];
      newMoles[bombIdx] = { id: bombIdx, isActive: true, value: null, isCorrect: false, type: MoleType.BOMB, hitsRequired: 1 };
    }
    setMoles(newMoles);
  }, [isPowerUpActive]);

  const handleError = useCallback((reason: EndReason, q: Question | null) => {
    try {
      playErrorSound();
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 300);

      setGameState(prev => {
        const resetCombo = 0;
        if (prev.mistakeShields > 0) {
          return { ...prev, mistakeShields: prev.mistakeShields - 1, combo: resetCombo };
        }
        const nextLives = prev.lives - 1;
        if (nextLives <= 0) {
          setTimeout(() => endGame(reason, q), 10);
          return { ...prev, lives: 0, combo: resetCombo };
        }
        return { ...prev, lives: nextLives, combo: resetCombo };
      });

      setGameState(prev => {
          if (prev.lives > 0 || prev.mistakeShields > 0) {
              startNewLevel(prev.selectedMode, prev.selectedDifficulty, prev.correctCount);
          }
          return prev;
      });
    } catch (error) {
      console.warn('Error in handleError:', error);
    }
  }, [endGame, startNewLevel]);

  const startGame = (mode: GameMode) => {
    setShowSummary(false);
    
    let startingMaxLives = gameState.playMode === PlayMode.TIME_LIMITED ? 3 : BASE_MAX_LIVES;

    setGameState(prev => ({
        ...prev, 
        score: 0, 
        lives: startingMaxLives, 
        maxLives: startingMaxLives,
        combo: 0, 
        maxCombo: 0, 
        correctCount: 0, 
        status: GameStatus.PLAYING,
        selectedMode: mode, 
        globalTimeLeft: TIME_LIMIT_SECONDS,
        isExploded: false, 
        endReason: undefined, 
        lastQuestion: null,
        isWatchingAd: false,
        powerUpsUsed: 0,
        activePowerUps: [],
    }));

    // 设置道具定时器，每秒更新一次激活状态
    if (powerUpTimerRef.current) clearInterval(powerUpTimerRef.current);
    powerUpTimerRef.current = setInterval(updateActivePowerUps, 1000);

    if (gameState.playMode === PlayMode.TIME_LIMITED) {
        if (globalTimerRef.current) clearInterval(globalTimerRef.current);
        globalTimerRef.current = setInterval(() => {
            setGameState(prev => {
                if (prev.globalTimeLeft <= 1) {
                    if (globalTimerRef.current) clearInterval(globalTimerRef.current);
                    endGame('TIME_UP', question);
                    return { ...prev, globalTimeLeft: 0 };
                }
                return { ...prev, globalTimeLeft: prev.globalTimeLeft - 1 };
            });
        }, 1000);
    }

    startNewLevel(mode, gameState.selectedDifficulty, 0);
  };

  const handleWatchAd = () => {
    setGameState(prev => ({ ...prev, isWatchingAd: true }));
    setAdCountdown(3);
    const timer = setInterval(() => {
        setAdCountdown(prev => {
            if (prev <= 1) {
                clearInterval(timer);
                reviveGame();
                return 0;
            }
            return prev - 1;
        });
    }, 1000);
  };

  const reviveGame = () => {
    setGameState(prev => {
        const revivedState = {
            ...prev,
            status: GameStatus.PLAYING,
            lives: 1, 
            isExploded: false,
            endReason: undefined,
            isWatchingAd: false,
            combo: 0 
        };
        startNewLevel(revivedState.selectedMode, revivedState.selectedDifficulty, revivedState.correctCount);
        
        if (revivedState.playMode === PlayMode.TIME_LIMITED) {
            if (globalTimerRef.current) clearInterval(globalTimerRef.current);
            globalTimerRef.current = setInterval(() => {
                setGameState(p => {
                    if (p.globalTimeLeft <= 1) {
                        if (globalTimerRef.current) clearInterval(globalTimerRef.current);
                        endGame('TIME_UP', question);
                        return { ...p, globalTimeLeft: 0 };
                    }
                    return { ...p, globalTimeLeft: p.globalTimeLeft - 1 };
                });
            }, 1000);
        }

        return revivedState;
    });
  };



  const handleMoleClick = useCallback((id: number, e: React.MouseEvent) => {
    try {
      if (gameState.status !== GameStatus.PLAYING) return;
      const mole = moles[id];
      if (!mole || !mole.isActive) return;

      if (mole.type === MoleType.BOMB) {
        playExplosionSound();
        handleError('EXPLOSION', question);
        return;
      }

      if (mole.isCorrect) {
        // 检查平底锅道具是否激活，戴头盔的地鼠只需要一次击打
        const isPanActive = isPowerUpActive(PowerUpType.PAN);
        if (mole.type === MoleType.HARDENED && mole.hitsRequired > 1 && !isPanActive) {
          playClangSound();
          const updatedMoles = [...moles];
          updatedMoles[id] = { ...mole, hitsRequired: mole.hitsRequired - 1 };
          setMoles(updatedMoles);
          addFloatingText(e.clientX, e.clientY, "DUP!", "#6b7280");
          return;
        }
        
        triggerCelebration();
        playWhackSound();

        const nextCombo = gameState.combo + 1;
        let basePoints = 5;
        if (nextCombo > 20) basePoints = 20;
        else if (nextCombo > 10) basePoints = 15;
        else if (nextCombo > 5) basePoints = 10;

        const scoreAdd = basePoints;

        let floatColor = "#22c55e"; 
        if (nextCombo > 20) floatColor = "#ef4444"; 
        else if (nextCombo > 10) floatColor = "#f97316"; 
        
        addFloatingText(e.clientX, e.clientY, `+${scoreAdd}`, floatColor);

        const nextCorrectCount = gameState.correctCount + 1;
        setGameState(prev => {
            const newMaxCombo = Math.max(prev.maxCombo, nextCombo);
            return { 
              ...prev, 
              score: prev.score + scoreAdd, 
              combo: nextCombo, 
              maxCombo: newMaxCombo,
              correctCount: nextCorrectCount 
            };
        });
        
        startNewLevel(gameState.selectedMode, gameState.selectedDifficulty, nextCorrectCount);
      } else {
        handleError('WRONG', question);
      }
    } catch (error) {
      console.warn('Error in handleMoleClick:', error);
    }
  }, [gameState, moles, isPowerUpActive, addFloatingText, triggerCelebration, handleError, startNewLevel, question]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`min-h-screen flex flex-col items-center justify-start p-3 pb-12 bg-gradient-to-b from-blue-300 via-green-400 to-green-600 transition-colors duration-500 ${isShaking ? 'shake bg-red-900' : ''} ${gameState.combo >= 15 ? 'fever-border' : ''}`}>

      {/* 设备兼容性错误提示 */}
      {!isDeviceCompatible && (
        <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl text-center border-4 border-orange-500">
            <h2 className="text-2xl text-orange-600 font-black mb-4">⚠️ 设备兼容性问题</h2>
            <p className="text-gray-600 mb-6">您的设备可能无法完全支持本游戏的所有功能。</p>
            <div className="bg-blue-50 p-4 rounded-2xl mb-6 text-left">
              <h3 className="font-black text-blue-700 mb-2">最低设备要求：</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• 至少 4GB 内存</li>
                <li>• 支持 HTML5 Canvas</li>
                <li>• 现代浏览器（Chrome、Safari、Firefox）</li>
              </ul>
            </div>
            <button 
              onClick={() => setIsDeviceCompatible(true)}
              className="w-full bg-green-500 text-white py-4 rounded-3xl text-xl font-black shadow-xl border-b-4 border-green-700 hover:bg-green-400 transition-all"
            >
              尝试继续游戏
            </button>
          </div>
        </div>
      )}
      
      <HammerCursor />
      
      {floatingTexts.map(t => (
          <div key={t.id} className="float-text text-2xl" style={{ left: t.x, top: t.y, color: t.color }}>
              {t.content}
          </div>
      ))}

      {/* 顶部醒目的限时挑战计时器 */}
      {gameState.status === GameStatus.PLAYING && gameState.playMode === PlayMode.TIME_LIMITED && (
        <div className={`mb-1 px-5 py-1 rounded-full text-xl sm:text-2xl font-black shadow-2xl border-3 border-white z-50 transition-all duration-300 transform -translate-y-1
          ${gameState.globalTimeLeft <= 10 ? 'bg-red-600 text-white animate-bounce scale-105' : 'bg-purple-700 text-white animate-pulse'}`}>
          ⏳ {formatTime(gameState.globalTimeLeft)}
        </div>
      )}

      {/* 状态看板区域 */}
      <div className={`w-full max-w-xl bg-white/95 backdrop-blur-md rounded-3xl p-4 mt-1 shadow-2xl flex flex-col gap-2 border-4 border-white/50 relative z-10 transition-all ${gameState.combo >= 10 ? 'ring-4 ring-orange-500' : ''}`}>
        <div className="flex items-center justify-between">
          <div className="flex flex-col items-center min-w-[70px]">
            <span className="text-gray-400 text-xs font-black">得分</span>
            <span className="text-4xl text-orange-500 font-black tracking-tight">{gameState.score}</span>
          </div>
          
          <div className="flex-1 px-4 flex flex-col items-center justify-center">
            <div className={`w-full bg-yellow-400 py-3 px-2 rounded-3xl border-4 border-yellow-600 shadow-inner text-center transition-all duration-300 flex items-center justify-center overflow-hidden ${gameState.combo > 5 ? 'scale-105 border-orange-500' : ''} ${gameState.combo > 20 ? 'fever-glow' : ''}`}>
              <span className={`text-xl sm:text-2xl md:text-3xl text-yellow-950 font-black transition-all whitespace-nowrap overflow-hidden text-ellipsis ${gameState.combo > 10 ? 'text-red-700' : ''}`}>
              {question ? question.text : '准备敲击!'}
            </span>
            </div>
          </div>

          <div className="flex flex-col items-center min-w-[70px]">
            <span className="text-gray-400 text-xs font-black">生命</span>
            <span className="text-3xl text-red-500 font-black">❤️{gameState.lives}</span>
          </div>
        </div>

        {/* 进度与血量 */}
        <div className="flex flex-col gap-1 mt-1">
            <div className="flex items-center gap-2">
                <span className="text-xl">❤️</span>
                <div className="flex-1 h-5 bg-gray-200 rounded-full border-2 border-gray-300 overflow-hidden relative shadow-inner">
                    <div className={`h-full transition-all duration-300 ${gameState.lives > (gameState.maxLives / 2) ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${(gameState.lives / gameState.maxLives) * 100}%` }}></div>
                </div>
                <span className="text-sm font-black text-gray-700 whitespace-nowrap">{gameState.lives} / {gameState.maxLives}</span>
            </div>
            {gameState.status === GameStatus.PLAYING && (
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden border border-gray-300">
                    <div className="h-full bg-blue-500 transition-all duration-75" style={{ width: `${questionProgress}%` }}></div>
                </div>
            )}
        </div>
      </div>

      {/* 道具使用区域 */}
      {gameState.status === GameStatus.PLAYING && (
        <div className="w-full max-w-xl flex justify-center gap-3 mt-3">
          {POWER_UPS.map(powerUp => {
            const isActive = isPowerUpActive(powerUp.id);
            const canUse = gameState.score >= powerUp.cost;
            
            return (
              <button
                key={powerUp.id}
                onClick={() => {
                  if (canUse && usePowerUp(powerUp)) {
                    addFloatingText(window.innerWidth / 2, window.innerHeight / 2, `-${powerUp.cost}`, '#ef4444');
                  }
                }}
                className={`flex flex-col items-center gap-1 px-4 py-2 rounded-2xl font-black transition-all shadow-lg border-b-4 ${
                  canUse 
                    ? 'bg-blue-500 text-white hover:bg-blue-400 active:border-b-0' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                } ${
                  isActive ? 'ring-2 ring-yellow-400 animate-pulse' : ''
                }`}
                disabled={!canUse}
              >
                <span className="text-2xl">{powerUp.icon}</span>
                <span className="text-xs">{powerUp.name}</span>
                <span className="text-xs">{powerUp.cost}分</span>
                {isActive && (
                  <div className="text-xs text-yellow-300">
                    激活中
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* 连击 (Combo) 独立显示区域 */}
      <div className="h-12 w-full flex items-center justify-center relative z-20 pointer-events-none mt-1">
          {gameState.combo > 1 && (
              <div 
                  key={gameState.combo}
                  className={`px-6 py-1.5 rounded-xl text-xl sm:text-2xl font-black border-3 border-white shadow-lg animate-combo-pop transition-all duration-300 bg-rose-600 text-white flex items-center gap-2
                      ${gameState.combo > 20 ? 'fever-glow scale-110 animate-heartbeat' : ''}`}
              >
                  <span className="text-2xl sm:text-3xl">✨</span>
                  <span>{gameState.combo > 10 ? '疯狂连击' : '连击'} x {gameState.combo}</span>
              </div>
          )}
      </div>

      {/* 地鼠阵列区域 */}
      <div className="mt-1 mb-8 grid grid-cols-3 gap-2 sm:gap-3 w-full max-w-md p-3 sm:p-4 bg-green-900/40 rounded-[30px] sm:rounded-[40px] shadow-2xl border-4 border-white/30 relative z-0">
        {moles.map((m) => <Mole key={m.id} {...m} onClick={(id) => handleMoleClick(id, {} as any)} />)}
      </div>

      {/* IDLE UI (主菜单) */}
      {gameState.status === GameStatus.IDLE && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white rounded-[40px] p-8 max-w-md w-full shadow-2xl text-center border-8 border-yellow-400 flex flex-col items-center animate-in zoom-in">
            {/* 品牌标识 - 中英文一行展示 */}
            <div className="text-center mb-2">
              <div className="text-gray-700 font-bold text-sm sm:text-base">向上书院 Up Academy</div>
            </div>
            <h1 className="text-4xl text-blue-600 mb-2 font-black">疯狂算鼠锤 🐹</h1>
            <p className="text-gray-400 mb-6 text-sm font-bold tracking-widest">挑战你的计算极限</p>
            
            <div className="flex flex-col items-center w-full gap-2 mb-6">
              <div className="flex bg-gray-100 p-1.5 rounded-3xl w-full shadow-inner border border-gray-200">
                  <button 
                      onClick={() => setGameState(p => ({ ...p, playMode: PlayMode.UNLIMITED }))}
                      className={`flex-1 py-3 rounded-2xl text-sm font-black transition-all ${gameState.playMode === PlayMode.UNLIMITED ? 'bg-blue-500 text-white shadow-lg' : 'text-gray-400'}`}
                  >
                      🏃 无限模式
                  </button>
                  <button 
                      onClick={() => setGameState(p => ({ ...p, playMode: PlayMode.TIME_LIMITED }))}
                      className={`flex-1 py-3 rounded-2xl text-sm font-black transition-all ${gameState.playMode === PlayMode.TIME_LIMITED ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400'}`}
                  >
                      ⏱️ 限时挑战
                  </button>
              </div>
              <div className="h-6 flex items-center justify-center">
                  <p className="text-gray-500 text-xs font-bold animate-pulse">
                      {gameState.playMode === PlayMode.UNLIMITED ? '“无限时间，冲击最高分！”' : '“120秒，你能打多少只？”'}
                  </p>
              </div>
            </div>

            <div className="mb-6 flex justify-center gap-2">
                {Object.values(Difficulty).map(d => (
                    <button key={d} onClick={() => setGameState(p => ({ ...p, selectedDifficulty: d }))} 
                        className={`px-4 py-2 text-xs rounded-full font-black border-2 transition-all ${gameState.selectedDifficulty === d ? 'bg-blue-500 text-white border-blue-600 scale-110' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                        {d === Difficulty.SIMPLE ? '简单' : d === Difficulty.HARD ? '困难' : '专家'}
                    </button>
                ))}
            </div>

            <div className="w-full flex flex-col gap-4">
              <button onClick={() => { setShowRules(true); }} className="bg-yellow-500 text-white py-2 rounded-3xl text-lg font-black shadow-xl border-b-4 border-yellow-700 active:border-b-0 hover:bg-yellow-400 transition-all w-3/4 mx-auto">📋 游戏规则</button>
              <button onClick={() => startGame(GameMode.ADD_SUB)} className="bg-sky-500 text-white py-4 rounded-3xl text-2xl font-black shadow-xl border-b-6 border-sky-700 active:border-b-0 hover:bg-sky-400 transition-all">加减法 ➕</button>
              <button onClick={() => startGame(GameMode.MUL_DIV)} className="bg-indigo-500 text-white py-4 rounded-3xl text-2xl font-black shadow-xl border-b-6 border-indigo-700 active:border-b-0 hover:bg-indigo-400 transition-all">乘除法 ✖️</button>
              <button onClick={() => startGame(GameMode.MIXED)} className="bg-rose-500 text-white py-4 rounded-3xl text-2xl font-black shadow-xl border-b-6 border-rose-700 active:border-b-0 hover:bg-rose-400 transition-all">混合大作战 ♾️</button>
            </div>
          </div>
        </div>
      )}

      {/* GAMEOVER UI */}
      {gameState.status === GameStatus.GAMEOVER && !showSummary && !gameState.isWatchingAd && (
        <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-sm w-full shadow-2xl text-center border-4 border-orange-500 animate-in zoom-in duration-300 relative">
<h3 className="text-xl text-orange-600 font-black mb-1">本次得分</h3>
            <div className="text-8xl text-orange-500 font-black mb-8 drop-shadow-md">{gameState.score}</div>
            
            <div className="flex flex-col gap-3">
                {gameState.endReason !== 'TIME_UP' && (
                    <button onClick={handleWatchAd} className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-white py-5 rounded-3xl text-xl font-black shadow-xl border-b-4 border-orange-700 hover:brightness-110 transition-all">
                        📺 复活继续！(HP+1)
                    </button>
                )}
                <button onClick={() => setShowSummary(true)} className="w-full bg-blue-500 text-white py-5 rounded-3xl text-xl font-black shadow-xl border-b-4 border-blue-700 hover:bg-blue-400 transition-all">
                    查看战报
                </button>
            </div>
          </div>
        </div>
      )}

      {/* SUMMARY UI (战报汇总) */}
      {showSummary && (
        <div className="fixed inset-0 z-[200] bg-black/85 flex items-center justify-center p-4 backdrop-blur-md">
            <div className="bg-white rounded-[50px] p-8 max-w-sm w-full shadow-2xl text-center border-8 border-orange-400 flex flex-col items-center animate-in zoom-in relative">
<h2 className="text-4xl text-orange-600 font-black mb-4">🏆 荣耀战报 🏆</h2>
                <div className="mb-6 px-6 py-2 bg-gradient-to-r from-orange-100 to-yellow-100 border-4 border-orange-400 rounded-2xl shadow-md transform -rotate-1">
                    <span className="text-xs text-orange-400 block font-black uppercase tracking-tighter">获得称号</span>
                    <span className="text-2xl text-orange-600 font-black">{gameState.result?.grade || '算术新人'}</span>
                </div>
                <div className="w-full bg-zinc-50 rounded-[40px] p-8 border-2 border-zinc-100 mb-6 flex flex-col gap-5">
                    <div className="flex justify-between items-center">
                        <span className="text-gray-400 font-black">最终得分</span>
                        <span className="text-5xl text-orange-500 font-black drop-shadow-sm">{gameState.score - gameState.powerUpsUsed}</span>
                    </div>
                    <div className="flex justify-between items-center border-t pt-4">
                        <span className="text-gray-400 font-black">击中地鼠</span>
                        <span className="text-3xl text-green-600 font-black">{gameState.correctCount}</span>
                    </div>
                    <div className="flex justify-between items-center border-t pt-4">
                        <span className="text-gray-400 font-black">最高连击</span>
                        <span className="text-3xl text-rose-500 font-black">{gameState.maxCombo} x</span>
                    </div>
                    <div className="flex justify-between items-center border-t pt-4">
                        <span className="text-gray-400 font-black">道具消耗</span>
                        <span className="text-3xl text-red-500 font-black">-{gameState.powerUpsUsed}</span>
                    </div>
                </div>
                <p className="text-gray-500 font-bold mb-8 text-lg px-4 leading-relaxed italic border-l-4 border-orange-200 pl-6">“{gameState.result?.comment}”</p>
                <button onClick={() => { setShowSummary(false); setGameState(p => ({ ...p, status: GameStatus.IDLE })); }} 
                    className="w-full bg-green-500 text-white py-5 rounded-[30px] text-3xl font-black shadow-2xl border-b-8 border-green-700 transition-all hover:scale-105 active:translate-y-2 active:border-b-0">
                    返回首页
                </button>
            </div>
        </div>
      )}



      {/* 游戏规则介绍页面 */}
      {showRules && (
          <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-4 backdrop-blur-md">
              <div className="bg-white rounded-[40px] p-8 max-w-2xl w-full shadow-2xl text-center border-8 border-yellow-400 overflow-y-auto max-h-[90vh] relative">
<h1 className="text-4xl text-blue-600 mb-4 font-black">🎮 游戏规则介绍</h1>
                  
                  {/* 本关游戏基本规则说明 */}
                  <div className="mb-6 text-left bg-blue-50 rounded-2xl p-6 border-2 border-blue-200">
                      <h2 className="text-2xl text-blue-700 font-black mb-3 flex items-center gap-2">
                          <span>📋</span> 游戏基本规则
                      </h2>
                      <ul className="space-y-2 text-gray-700">
                          <li className="flex items-start gap-2">
                              <span className="text-blue-500 font-bold">•</span>
                              <span><strong>游戏目标：</strong>快速计算并点击带有正确答案的地鼠，获得高分。</span>
                          </li>
                          <li className="flex items-start gap-2">
                              <span className="text-blue-500 font-bold">•</span>
                              <span><strong>操作方式：</strong>使用鼠标点击地鼠，使用锤子光标击打。</span>
                          </li>
                          <li className="flex items-start gap-2">
                              <span className="text-blue-500 font-bold">•</span>
                              <span><strong>时间限制：</strong>限时挑战模式下有120秒时间限制，无限模式下无时间限制。</span>
                          </li>
                          <li className="flex items-start gap-2">
                              <span className="text-blue-500 font-bold">•</span>
                              <span><strong>生命值：</strong>初始5条生命，答错或超时会扣除生命值，生命值耗尽游戏结束。</span>
                          </li>
                      </ul>
                  </div>
                  
                  {/* 地鼠类型展示与特性说明 */}
                  <div className="mb-6 text-left bg-green-50 rounded-2xl p-6 border-2 border-green-200">
                      <h2 className="text-2xl text-green-700 font-black mb-3 flex items-center gap-2">
                          <span>🐹</span> 地鼠类型说明
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-white rounded-xl p-4 shadow-md border-2 border-green-100">
                              <div className="flex items-center gap-3 mb-2">
                                  <span className="text-4xl">🐹</span>
                                  <div>
                                      <h3 className="font-black text-green-800">普通地鼠</h3>
                                      <p className="text-sm text-gray-600">出现概率最高</p>
                                  </div>
                              </div>
                              <p className="text-sm text-gray-700">带有数字的普通地鼠，点击正确答案获得5-20分。</p>
                          </div>
                          <div className="bg-white rounded-xl p-4 shadow-md border-2 border-green-100">
                              <div className="flex items-center gap-3 mb-2">
                                  <span className="text-4xl">⚔️</span>
                                  <div>
                                      <h3 className="font-black text-green-800">带盔地鼠</h3>
                                      <p className="text-sm text-gray-600">出现概率中等</p>
                                  </div>
                              </div>
                              <p className="text-sm text-gray-700">带有头盔的地鼠，需要击打2次才能消除，使用平底锅道具可1次消除。</p>
                          </div>
                          <div className="bg-white rounded-xl p-4 shadow-md border-2 border-green-100">
                              <div className="flex items-center gap-3 mb-2">
                                  <span className="text-4xl">💣</span>
                                  <div>
                                      <h3 className="font-black text-red-600">炸弹地鼠</h3>
                                      <p className="text-sm text-gray-600">出现概率较低</p>
                                  </div>
                              </div>
                              <p className="text-sm text-gray-700">带有炸弹的地鼠，点击会导致游戏失败，生命值直接归零。</p>
                          </div>
                      </div>
                  </div>
                  
                  {/* 连击机制与记分规则详解 */}
                  <div className="mb-6 text-left bg-yellow-50 rounded-2xl p-6 border-2 border-yellow-200">
                      <h2 className="text-2xl text-yellow-700 font-black mb-3 flex items-center gap-2">
                          <span>🔥</span> 连击与记分规则
                      </h2>
                      <div className="space-y-3">
                          <p className="text-gray-700"><strong>连击机制：</strong>连续点击正确答案可获得连击加成，连击次数越高，每次得分越高。</p>
                          <div className="bg-white rounded-xl p-4 shadow-md border-2 border-yellow-100">
                              <h3 className="font-black text-yellow-800 mb-2">连击分数加成表</h3>
                              <table className="w-full text-left">
                                  <thead className="bg-yellow-100">
                                      <tr>
                                          <th className="p-2 border-b">连击次数</th>
                                          <th className="p-2 border-b">每次得分</th>
                                      </tr>
                                  </thead>
                                  <tbody>
                                      <tr>
                                          <td className="p-2 border-b">1-5</td>
                                          <td className="p-2 border-b">5分</td>
                                      </tr>
                                      <tr>
                                          <td className="p-2 border-b">6-10</td>
                                          <td className="p-2 border-b">10分</td>
                                      </tr>
                                      <tr>
                                          <td className="p-2 border-b">11-20</td>
                                          <td className="p-2 border-b">15分</td>
                                      </tr>
                                      <tr>
                                          <td className="p-2">20+</td>
                                          <td className="p-2">20分</td>
                                      </tr>
                                  </tbody>
                              </table>
                          </div>
                      </div>
                  </div>
                  
                  {/* 道具系统功能说明 */}
                  <div className="mb-6 text-left bg-purple-50 rounded-2xl p-6 border-2 border-purple-200">
                      <h2 className="text-2xl text-purple-700 font-black mb-3 flex items-center gap-2">
                          <span>✨</span> 道具系统说明
                      </h2>
                      <div className="grid grid-cols-2 gap-4">
                          {POWER_UPS.map(powerUp => (
                              <div key={powerUp.id} className="bg-white rounded-xl p-4 shadow-md border-2 border-purple-100">
                                  <div className="flex items-center gap-3 mb-2">
                                      <span className="text-3xl">{powerUp.icon}</span>
                                      <div>
                                          <h3 className="font-black text-purple-800">{powerUp.name}</h3>
                                          <p className="text-sm text-gray-600">{powerUp.cost}分</p>
                                      </div>
                                  </div>
                                  <p className="text-sm text-gray-700">{powerUp.description}</p>
                                  {powerUp.duration > 0 && (
                                      <p className="text-xs text-purple-600 mt-1">持续时间：{powerUp.duration}秒</p>
                                  )}
                              </div>
                          ))}
                      </div>
                  </div>
                  
                  {/* 游戏模式选择 */}
                  <div className="mt-6">
                      <h2 className="text-xl text-blue-700 font-black mb-3">选择游戏模式开始</h2>
                      <div className="grid grid-cols-1 gap-3">
                          <button 
                              onClick={() => {
                                  setShowRules(false);
                                  startGame(GameMode.ADD_SUB);
                              }}
                              className="bg-sky-500 text-white py-4 rounded-3xl text-xl font-black shadow-xl border-b-4 border-sky-700 hover:bg-sky-400 active:border-b-0 transition-all"
                          >
                              ➕ 加减法
                          </button>
                          <button 
                              onClick={() => {
                                  setShowRules(false);
                                  startGame(GameMode.MUL_DIV);
                              }}
                              className="bg-indigo-500 text-white py-4 rounded-3xl text-xl font-black shadow-xl border-b-4 border-indigo-700 hover:bg-indigo-400 active:border-b-0 transition-all"
                          >
                              ✖️ 乘除法
                          </button>
                          <button 
                              onClick={() => {
                                  setShowRules(false);
                                  startGame(GameMode.MIXED);
                              }}
                              className="bg-rose-500 text-white py-4 rounded-3xl text-xl font-black shadow-xl border-b-4 border-rose-700 hover:bg-rose-400 active:border-b-0 transition-all"
                          >
                              ♾️ 混合大作战
                          </button>
                      </div>
                  </div>
                  
                  {/* 关闭按钮 */}
                  <div className="mt-4">
                      <button 
                          onClick={() => setShowRules(false)}
                          className="w-full bg-gray-500 text-white py-3 rounded-3xl text-lg font-black shadow-xl border-b-4 border-gray-700 hover:bg-gray-400 active:border-b-0 transition-all"
                      >
                          ❌ 关闭
                      </button>
                  </div>
              </div>
          </div>
      )}
      
      {/* WATCHING AD UI */}
      {gameState.isWatchingAd && (
          <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center p-8 text-white relative">
<div className="text-center">
                  <h2 className="text-3xl font-black mb-8 tracking-widest">精彩广告中...</h2>
                  <div className="w-72 h-6 bg-gray-800 rounded-full overflow-hidden mb-8 border-4 border-white/10 p-1">
                      <div className="h-full bg-yellow-400 rounded-full transition-all duration-1000 ease-linear" style={{ width: `${(3 - adCountdown) / 3 * 100}%` }}></div>
                  </div>
                  <p className="text-8xl font-black animate-bounce">{adCountdown}</p>
                  <p className="mt-12 text-gray-400 italic text-lg">“稍等片刻，体力回复中！”</p>
              </div>
          </div>
      )}
    </div>
  );
};

export default App;