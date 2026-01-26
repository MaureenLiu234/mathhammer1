
import { Question, GameMode, Difficulty } from '../types';

export const generateQuestion = (mode: GameMode, difficulty: Difficulty): Question => {
  // 定义不同难度的配置
  const configs = {
    [Difficulty.SIMPLE]: { addSubMax: 10, mulDivMax: 5 },
    [Difficulty.HARD]: { addSubMax: 25, mulDivMax: 9 },
    [Difficulty.MASTER]: { addSubMax: 100, mulDivMax: 15 }
  };

  const config = configs[difficulty];

  const operations = {
    ADD: (): Question => {
      const a = Math.floor(Math.random() * (config.addSubMax - 1)) + 1;
      const b = Math.floor(Math.random() * (config.addSubMax - a)) + 0;
      return { text: `${a} + ${b} = ?`, answer: a + b };
    },
    SUB: (): Question => {
      const a = Math.floor(Math.random() * (config.addSubMax - 1)) + 1;
      const b = Math.floor(Math.random() * (a + 1));
      return { text: `${a} - ${b} = ?`, answer: a - b };
    },
    MUL: (): Question => {
      const a = Math.floor(Math.random() * (config.mulDivMax - 1)) + 2;
      const b = Math.floor(Math.random() * (config.mulDivMax - 1)) + 1;
      return { text: `${a} × ${b} = ?`, answer: a * b };
    },
    DIV: (): Question => {
      const b = Math.floor(Math.random() * (config.mulDivMax - 1)) + 2;
      const answer = Math.floor(Math.random() * (config.mulDivMax - 1)) + 1;
      const a = b * answer;
      return { text: `${a} ÷ ${b} = ?`, answer };
    }
  };

  let selectedOp: () => Question;

  if (mode === GameMode.ADD_SUB) {
    selectedOp = Math.random() > 0.5 ? operations.ADD : operations.SUB;
  } else if (mode === GameMode.MUL_DIV) {
    selectedOp = Math.random() > 0.5 ? operations.MUL : operations.DIV;
  } else {
    const allOps = [operations.ADD, operations.SUB, operations.MUL, operations.DIV];
    selectedOp = allOps[Math.floor(Math.random() * allOps.length)];
  }

  return selectedOp();
};

export const generateDistractors = (correct: number): number[] => {
  const distractors = new Set<number>();
  while (distractors.size < 2) {
    const offset = (Math.floor(Math.random() * 5) + 1) * (Math.random() > 0.5 ? 1 : -1);
    const d = correct + offset;
    if (d >= 0 && d !== correct) {
      distractors.add(d);
    }
  }
  return Array.from(distractors);
};
