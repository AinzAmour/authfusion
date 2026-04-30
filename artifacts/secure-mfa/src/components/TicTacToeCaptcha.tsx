import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCcw, Trophy, Frown, Handshake } from "lucide-react";

type Cell = "X" | "O" | null;
type GameResult = "win" | "lose" | "draw" | null;

const WIN_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function checkWinner(board: Cell[]): Cell {
  for (const [a, b, c] of WIN_COMBOS) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

function getWinLine(board: Cell[]): number[] | null {
  for (const combo of WIN_COMBOS) {
    const [a, b, c] = combo;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return combo;
    }
  }
  return null;
}

function isDraw(board: Cell[]): boolean {
  return board.every((c) => c !== null) && !checkWinner(board);
}

/**
 * Medium-difficulty AI:
 * 1. Win if possible
 * 2. Block opponent from winning
 * 3. Take center if available
 * 4. Random corner or edge
 */
function getAiMove(board: Cell[]): number {
  const empty = board.map((c, i) => (c === null ? i : -1)).filter((i) => i >= 0);
  if (empty.length === 0) return -1;

  // Try to win
  for (const idx of empty) {
    const test = [...board];
    test[idx] = "O";
    if (checkWinner(test) === "O") return idx;
  }

  // Block player from winning
  for (const idx of empty) {
    const test = [...board];
    test[idx] = "X";
    if (checkWinner(test) === "X") return idx;
  }

  // Take center
  if (board[4] === null) return 4;

  // Random from available (prefer corners)
  const corners = [0, 2, 6, 8].filter((i) => board[i] === null);
  if (corners.length > 0) return corners[Math.floor(Math.random() * corners.length)];

  return empty[Math.floor(Math.random() * empty.length)];
}

interface TicTacToeCaptchaProps {
  onPass: () => void;
}

export function TicTacToeCaptcha({ onPass }: TicTacToeCaptchaProps) {
  const [board, setBoard] = useState<Cell[]>(Array(9).fill(null));
  const [result, setResult] = useState<GameResult>(null);
  const [winLine, setWinLine] = useState<number[] | null>(null);
  const [isThinking, setIsThinking] = useState(false);

  const resetGame = useCallback(() => {
    setBoard(Array(9).fill(null));
    setResult(null);
    setWinLine(null);
    setIsThinking(false);
  }, []);

  const handleCellClick = useCallback(
    (index: number) => {
      if (board[index] || result || isThinking) return;

      const newBoard = [...board];
      newBoard[index] = "X";

      // Check if player won
      const playerWin = checkWinner(newBoard);
      if (playerWin === "X") {
        setBoard(newBoard);
        setWinLine(getWinLine(newBoard));
        setResult("win");
        return;
      }

      // Check draw
      if (isDraw(newBoard)) {
        setBoard(newBoard);
        setResult("draw");
        return;
      }

      setBoard(newBoard);
      setIsThinking(true);

      // AI move with a small delay
      setTimeout(() => {
        const aiIdx = getAiMove(newBoard);
        if (aiIdx >= 0) {
          newBoard[aiIdx] = "O";
          setBoard([...newBoard]);

          const aiWin = checkWinner(newBoard);
          if (aiWin === "O") {
            setWinLine(getWinLine(newBoard));
            setResult("lose");
          } else if (isDraw(newBoard)) {
            setResult("draw");
          }
        }
        setIsThinking(false);
      }, 400);
    },
    [board, result, isThinking]
  );

  const cellVariants = {
    hidden: { scale: 0, opacity: 0 },
    visible: { scale: 1, opacity: 1, transition: { type: "spring" as const, stiffness: 400, damping: 15 } },
  };

  return (
    <div className="flex flex-col items-center">
      <div className="text-center mb-5">
        <p className="text-sm text-muted-foreground">
          {result === null && "Your turn — you are X"}
          {result === "win" && ""}
          {result === "draw" && ""}
          {result === "lose" && ""}
        </p>
      </div>

      {/* Board */}
      <div className="grid grid-cols-3 gap-2 w-[220px] h-[220px] mb-6">
        {board.map((cell, i) => {
          const isWinCell = winLine?.includes(i);
          return (
            <button
              key={i}
              onClick={() => handleCellClick(i)}
              disabled={!!cell || !!result || isThinking}
              className={`
                relative w-full aspect-square rounded-xl border-2 transition-all duration-200
                flex items-center justify-center text-2xl font-bold
                ${!cell && !result && !isThinking
                  ? "hover:bg-primary/5 hover:border-primary/40 cursor-pointer border-border"
                  : "cursor-default border-border"
                }
                ${isWinCell ? "bg-secondary/15 border-secondary" : ""}
                ${cell === "X" ? "text-primary" : "text-destructive"}
              `}
            >
              <AnimatePresence>
                {cell && (
                  <motion.span
                    variants={cellVariants}
                    initial="hidden"
                    animate="visible"
                    className="select-none"
                  >
                    {cell}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          );
        })}
      </div>

      {/* Result */}
      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-center"
          >
            {result === "win" && (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2 text-secondary font-semibold text-lg">
                  <Trophy className="w-5 h-5" />
                  You win! CAPTCHA passed.
                </div>
                <Button onClick={onPass} className="w-full">
                  Continue
                </Button>
              </div>
            )}

            {result === "draw" && (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2 text-amber-600 font-semibold text-lg">
                  <Handshake className="w-5 h-5" />
                  Draw! CAPTCHA passed.
                </div>
                <Button onClick={onPass} className="w-full">
                  Continue
                </Button>
              </div>
            )}

            {result === "lose" && (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2 text-destructive font-semibold">
                  <Frown className="w-5 h-5" />
                  You lost. Try again!
                </div>
                <Button variant="outline" onClick={resetGame} className="w-full">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Play Again
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
