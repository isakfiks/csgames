
type Board = (string | null)[][]
type Player = string

// Make random move
export function makeAIMove(board: Board, aiPlayer: Player): [number, number] | null {
  // Find all empty cells
  const emptyCells: [number, number][] = []

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      if (!board[row][col]) {
        emptyCells.push([row, col])
      }
    }
  }

  // No moves available
  if (emptyCells.length === 0) {
    return null
  }

  // Pick a random empty cell
  const randomIndex = Math.floor(Math.random() * emptyCells.length)
  return emptyCells[randomIndex]
}

// Simple function to check if the game is over
export function isGameOver(board: Board): boolean {
  // Check if board is full
  let isFull = true
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      if (!board[row][col]) {
        isFull = false
      }
    }
  }

  return isFull
}
