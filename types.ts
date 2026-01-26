export enum GameStatus {
  IDLE = 'IDLE',
  PLAYING = 'PLAYING',
  GAMEOVER = 'GAMEOVER'
}

export enum Difficulty {
  SIMPLE = 'SIMPLE',
  HARD = 'HARD',
  MASTER = 'MASTER'
}

export enum GameMode {
  ADD_SUB = 'ADD_SUB',
  MUL_DIV = 'MUL_DIV',
  MIXED = 'MIXED'
}

export enum PlayMode {
  UNLIMITED = 'UNLIMITED',
  TIME_LIMITED = 'TIME_LIMITED'
}

export enum MoleType {
  NORMAL = 'NORMAL',
  BOMB = 'BOMB',
  HARDENED = 'HARDENED'
}

export enum HammerSkin {
  BASIC = 'BASIC',
  THOR = 'THOR',
  GOLDEN = 'GOLDEN',
  ICE = 'ICE',
  WAND = 'WAND',
  PAN = 'PAN',
  CAT = 'CAT'
}

export interface Question {
  text: string;
  answer: number;
}

export interface MoleState {
  id: number;
  isActive: boolean;
  value: number | null;
  isCorrect: boolean;
  type: MoleType;
  hitsRequired: number;
  isHinted?: boolean;
}

export interface GameResult {
  grade: string;
  comment: string;
}

export type EndReason = 'TIMEOUT' | 'WRONG' | 'EXPLOSION' | 'TIME_UP';

export enum PowerUpType {
  ICE_CREAM = 'ICE_CREAM',
  LIFE_POTION = 'LIFE_POTION',
  PAN = 'PAN',
  GOLDEN_LIGHT = 'GOLDEN_LIGHT'
}

export interface PowerUp {
  id: PowerUpType;
  name: string;
  description: string;
  icon: string;
  cost: number;
  duration: number; // seconds
}

export interface ActivePowerUp {
  type: PowerUpType;
  startTime: number;
  duration: number;
}

export interface GameState {
  score: number;
  lives: number;
  maxLives: number;
  combo: number;
  maxCombo: number;
  status: GameStatus;
  playMode: PlayMode;
  globalTimeLeft: number;
  highScore: number;
  selectedMode: GameMode;
  selectedDifficulty: Difficulty;
  correctCount: number;
  isExploded: boolean;
  result?: GameResult;
  endReason?: EndReason;
  lastQuestion?: Question | null;
  isWatchingAd: boolean;
  powerUpsUsed: number; // Total points spent on power-ups
  activePowerUps: ActivePowerUp[];
}