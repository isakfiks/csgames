// Define the board type
type Board = (string | null)[][]
type Player = string

// Check if a player can win in the next move
function canWin(board: Board, player: Player): [number, number] | null {
  // Check rows
  for (let row = 0; row < 3; row++) {
    let playerCount = 0
    let emptyCell: [number, number] | null = null

    for (let col = 0; col < 3; col++) {
      if (board[row][col] === player) {
        playerCount++
      } else if (!board[row][col]) {
        emptyCell = [row, col]
      }
    }

    if (playerCount === 2 && emptyCell) {
      return emptyCell
    }
  }

  // Check columns
  for (let col = 0; col < 3; col++) {
    let playerCount = 0
    let emptyCell: [number, number] | null = null

    for (let row = 0; row < 3; row++) {
      if (board[row][col] === player) {
        playerCount++
      } else if (!board[row][col]) {
        emptyCell = [row, col]
      }
    }

    if (playerCount === 2 && emptyCell) {
      return emptyCell
    }
  }

  // Check diagonals
  // First diagonal (top-left to bottom-right)
  let playerCount = 0
  let emptyCell: [number, number] | null = null

  for (let i = 0; i < 3; i++) {
    if (board[i][i] === player) {
      playerCount++
    } else if (!board[i][i]) {
      emptyCell = [i, i]
    }
  }

  if (playerCount === 2 && emptyCell) {
    return emptyCell
  }

  // Second diagonal (top-right to bottom-left)
  playerCount = 0
  emptyCell = null

  for (let i = 0; i < 3; i++) {
    if (board[i][2 - i] === player) {
      playerCount++
    } else if (!board[i][2 - i]) {
      emptyCell = [i, 2 - i]
    }
  }

  if (playerCount === 2 && emptyCell) {
    return emptyCell
  }

  return null
}

// Tries to take center if availabl
function tryCenter(board: Board): [number, number] | null {
  if (!board[1][1]) {
    return [1, 1]
  }
  return null
}

// Tries to take corner if available
function tryCorner(board: Board): [number, number] | null {
  const corners: [number, number][] = [
    [0, 0],
    [0, 2],
    [2, 0],
    [2, 2],
  ]

  // Shuffle corners for some unpredictability
  for (let i = corners.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[corners[i], corners[j]] = [corners[j], corners[i]]
  }

  for (const [row, col] of corners) {
    if (!board[row][col]) {
      return [row, col]
    }
  }

  return null
}

// Make move
export function makeAIMove(board: Board, aiPlayer: Player, humanPlayer: Player): [number, number] | null {
  // First, check if AI can win
  const winningMove = canWin(board, aiPlayer)
  if (winningMove) {
    return winningMove
  }

  // Block opponent if they're about to win
  const blockingMove = canWin(board, humanPlayer)
  if (blockingMove) {
    return blockingMove
  }

  // Take center if available
  const centerMove = tryCenter(board)
  if (centerMove) {
    return centerMove
  }

  // Take a corner if available
  const cornerMove = tryCorner(board)
  if (cornerMove) {
    return cornerMove
  }

  // Otherwise, make a random move
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

// Check if the game is over and return the winner
export function checkGameStatus(board: Board): { isOver: boolean; winner: Player | null } {
  // Check rows
  for (let row = 0; row < 3; row++) {
    if (board[row][0] && board[row][0] === board[row][1] && board[row][0] === board[row][2]) {
      return { isOver: true, winner: board[row][0] }
    }
  }

  // Check columns
  for (let col = 0; col < 3; col++) {
    if (board[0][col] && board[0][col] === board[1][col] && board[0][col] === board[2][col]) {
      return { isOver: true, winner: board[0][col] }
    }
  }

  // Check diagonals
  if (board[0][0] && board[0][0] === board[1][1] && board[0][0] === board[2][2]) {
    return { isOver: true, winner: board[0][0] }
  }

  if (board[0][2] && board[0][2] === board[1][1] && board[0][2] === board[2][0]) {
    return { isOver: true, winner: board[0][2] }
  }

  // Check if board is full (draw)
  let isFull = true
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      if (!board[row][col]) {
        isFull = false
        break
      }
    }
    if (!isFull) break
  }

  if (isFull) {
    return { isOver: true, winner: null }
  }

  // Game is not over
  return { isOver: false, winner: null }
}
