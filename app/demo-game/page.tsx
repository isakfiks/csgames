import BalloonGame from "../components/games/balloon-game"

export default function BalloonDemo() {
  return (
    <BalloonGame 
      lobbyId="demo" 
      currentUser={null}
    />
  )
}