"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FaArrowLeft, FaPlay, FaSync } from "react-icons/fa";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { RealtimeChannel } from "@supabase/supabase-js";
import React from "react";
import GenerateCodeButton from "../../components/GenerateCodeButton";
import { User } from "@supabase/supabase-js";
const supabase = createClientComponentClient();

const POLLING_INTERVAL = 3000;

interface SupabaseError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

interface Lobby {
  id: string;
  created_by: string;
  game_id: string | null;
  status: string;
  created_at: string;
  [key: string]: unknown;
}

interface Game {
  id: string;
  title: string;
  [key: string]: unknown;
  singlePlayer?: boolean;
}

interface Player {
  id: string;
  username: string;
  [key: string]: unknown;
}

interface GameState {
  id: string;
  lobby_id: string;
  player1: string | null;
  player2: string | null;
  status: "waiting" | "playing" | "finished";
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

interface RealtimePayload {
  new: GameState;
  old?: Partial<GameState>;
  event: "INSERT" | "UPDATE" | "DELETE";
}

export default function LobbyPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const subscriptionRef = useRef<RealtimeChannel | null>(null);
  const gameStateIdRef = useRef<string | null>(null);

  const resolvedParams = React.use(params);

  useEffect(() => {
    let isActive = true;

    async function fetchLobbyData() {
      try {
        console.log("Fetching lobby data for:", resolvedParams.id);

        // Get current user
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.push("/");
          return;
        }

        if (isActive) setCurrentUser(session.user);

        // Fetch lobby data
        const { data: lobbyData, error: lobbyError } = await supabase
          .from("lobbies")
          .select("*")
          .eq("id", resolvedParams.id)
          .single();

        if (lobbyError) throw lobbyError;
        if (isActive) setLobby(lobbyData);

        // Fetch game data
        if (lobbyData?.game_id) {
          const { data: gameData, error: gameError } = await supabase
            .from("games")
            .select("*")
            .eq("id", lobbyData.game_id)
            .single();

          if (gameError) throw gameError;
          if (isActive) setGame(gameData);

          // If it's a single-player game, redirect directly to the game page
          if (gameData?.singlePlayer) {
            router.push(`/game/${resolvedParams.id}`);
            return;
          }
        }

        // Fetch game state
        const { data: gameStateData, error: gameStateError } = await supabase
          .from("game_states")
          .select("*")
          .eq("lobby_id", resolvedParams.id)
          .maybeSingle();

        if (gameStateError && gameStateError.code !== "PGRST116") {
          throw gameStateError;
        }

        if (gameStateData) {
          if (isActive) {
            setGameState(gameStateData);
            gameStateIdRef.current = gameStateData.id;
          }

          // Fetch player profiles
          const playerIds = [gameStateData.player1, gameStateData.player2].filter(
            (id): id is string => id !== null
          );

          if (playerIds.length > 0) {
            const { data: playerData, error: playerError } = await supabase
              .from("profiles")
              .select("*")
              .in("id", playerIds);

            if (playerError) {
              console.error("Error fetching players:", playerError);
            } else if (isActive) {
              setPlayers(playerData || []);
            }
          }
        } else {
          // If no game state exists yet, try to create one
          await joinGame(true);
        }

        // Set up real-time subscription for game state changes
        if (subscriptionRef.current) {
          subscriptionRef.current.unsubscribe();
        }

        const gameStateSubscription = supabase
          .channel("lobby_game_state_changes")
          .on(
            "postgres_changes" as unknown as "system",
            {
              event: "*",
              schema: "public",
              table: "game_states",
              filter: `lobby_id=eq.${resolvedParams.id}`,
            },
            (payload: RealtimePayload) => {
              console.log("Game state changed in lobby:", payload);
              if (!isActive) return;

              // Update the game state
              setGameState(payload.new);

              // If the game has started, go to the game page
              if (payload.new.status === "playing" && payload.old?.status === "waiting") {
                router.push(`/game/${resolvedParams.id}`);
              }

              const playerIds = [payload.new.player1, payload.new.player2].filter(
                (id): id is string => id !== null
              );
              if (playerIds.length > 0) {
                fetchPlayerProfiles(playerIds);
              }
            }
          )
          .subscribe((status) => {
            console.log("Lobby game state subscription status:", status);
          });

        subscriptionRef.current = gameStateSubscription;

        startPolling();
      } catch (err: unknown) {
        const error = err as SupabaseError;
        console.error("Error fetching lobby data:", error);
        if (isActive) setError(error.message || "Failed to load lobby data");
      } finally {
        if (isActive) setLoading(false);
      }
    }

    fetchLobbyData();

    return () => {
      isActive = false;
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
      stopPolling();
    };
  }, [resolvedParams.id, router]);

  // Start polling for updates
  function startPolling() {
    console.log("Starting polling for lobby updates");

    stopPolling();

    pollingIntervalRef.current = setInterval(() => {
      console.log("Polling for lobby updates");
      refreshLobbyData();
    }, POLLING_INTERVAL);
  }

  // Stop polling
  function stopPolling() {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }

  // Fetch player profiles
  async function fetchPlayerProfiles(playerIds: string[]) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .in("id", playerIds);

      if (error) {
        console.error("Error fetching player profiles:", error);
        return;
      }
      setPlayers(data || []);
    } catch (err: unknown) {
      console.error("Error in fetchPlayerProfiles:", err);
    }
  }

  async function refreshLobbyData() {
    try {
      // Check if the game is single-player
      if (game?.singlePlayer) {
        router.push(`/game/${resolvedParams.id}`);
        return;
      }

      const { data: gameStateData, error: gameStateError } = await supabase
        .from("game_states")
        .select("*")
        .eq("lobby_id", resolvedParams.id)
        .maybeSingle();

      if (gameStateError && gameStateError.code !== "PGRST116") {
        console.error("Error fetching game state:", gameStateError);
        return;
      }

      if (gameStateData) {
        setGameState(gameStateData);
        gameStateIdRef.current = gameStateData.id;

        if (gameStateData.status === "playing") {
          router.push(`/game/${resolvedParams.id}`);
          return;
        }

        const playerIds = [gameStateData.player1, gameStateData.player2].filter(
          (id): id is string => id !== null
        );
        if (playerIds.length > 0) {
          fetchPlayerProfiles(playerIds);
        }
      }
    } catch (err: unknown) {
      console.error("Error in refreshLobbyData:", err);
    }
  }

  async function handleManualRefresh() {
    setIsRefreshing(true);
    await refreshLobbyData();
    setTimeout(() => setIsRefreshing(false), 500);
  }

  async function joinGame(silent = false) {
    try {
      if (!silent) setJoining(true);

      const { data, error } = await supabase.rpc("join_lobby_simple", {
        p_id: resolvedParams.id,
      });

      if (error) {
        console.error("Error joining game:", error);
        if (!silent) setError(error.message || "Failed to join game");
        return;
      }

      console.log("Joined game:", data);

      // Refresh state data
      await refreshLobbyData();
    } catch (err: unknown) {
      const error = err as SupabaseError;
      console.error("Error joining game:", error);
      if (!silent) setError(error.message || "Failed to join game");
    } finally {
      if (!silent) setJoining(false);
    }
  }

  function getPlayerName(playerId: string | null | undefined) {
      if (!playerId) return "Waiting for player...";
  
      const player = players.find((p) => p.id === playerId);
      return player?.username || "Unknown player";
    }

  if (loading) {
    return (
      <div className="bg-white min-h-screen p-8 flex items-center justify-center font-[family-name:var(--font-geist-sans)]">
        <p className="text-black">Loading lobby...</p>
      </div>
    );
  }

  if (error || !lobby) {
    return (
      <div className="bg-white min-h-screen p-8 flex flex-col items-center justify-center font-[family-name:var(--font-geist-sans)]">
        <p className="text-black mb-4">Error: {error || "Lobby not found"}</p>
        <Link href="/explore" className="text-black underline">
          Return to Explore Games
        </Link>
      </div>
    );
  }

  const isCreator = lobby.created_by === currentUser?.id;
  const isInGame =
    gameState && (gameState.player1 === currentUser?.id || gameState.player2 === currentUser?.id);
  const canJoin = gameState && gameState.player2 === null && !isInGame && !isCreator;
  const isGameFull = gameState && gameState.player1 && gameState.player2;

  return (
    <div className="bg-white min-h-screen p-8 font-[family-name:var(--font-geist-sans)]">
      <header className="max-w-4xl mx-auto mb-8">
        <div className="flex justify-between items-center">
          <Link href="/explore" className="flex items-center text-black">
            <FaArrowLeft className="mr-2" />
            <span>Back to Games</span>
          </Link>
          <div className="flex">
            <h1 className="text-2xl font-bold text-black">CSGames</h1>
            <span className="text-black text-2xl">.dev</span>
          </div>
        </div>
      </header>

      <main className="text-black max-w-4xl mx-auto">
        <div className="border-2 border-black rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-3xl font-bold text-black">{game?.title || "Connect Four"} Lobby</h2>

            <button
              onClick={handleManualRefresh}
              className={`p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors ${
                isRefreshing ? "animate-spin" : ""
              }`}
              aria-label="Refresh lobby"
              disabled={isRefreshing}
            >
              <FaSync className="text-black" />
            </button>
          </div>

          <div className="mb-6">
            <p className="text-black mb-2">
              <strong>Lobby ID:</strong> {resolvedParams.id}
            </p>
            <p className="text-black mb-2">
              <strong>Status:</strong> {gameState?.status || "Waiting for players"}
            </p>
            <div className="mb-6">
              <p className="text-black mb-2">
                <strong>Created by:</strong> {getPlayerName(gameState?.player1)}
              </p>

              {isCreator && (
                <div className="mt-4 p-4 border-2 border-black rounded-lg bg-gray-50">
                  <h3 className="text-lg font-bold mb-2">Invitation Code</h3>
                  <p className="text-sm mb-3">Generate a short code that others can use to join this lobby.</p>
                  <GenerateCodeButton lobbyId={resolvedParams.id} />
                </div>
              )}
            </div>
            <p className="text-black">
              <strong>Created by:</strong> {getPlayerName(gameState?.player1)}
            </p>
          </div>

          <div className="mb-6">
            <h3 className="text-xl font-bold text-black mb-4">Players</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border-2 border-black rounded-lg p-4">
                <p className="font-bold mb-2">Player 1 (Red)</p>
                <p>{getPlayerName(gameState?.player1)}</p>
                {gameState?.player1 === currentUser?.id && (
                  <p className="text-xs text-gray-500 mt-1">(You)</p>
                )}
              </div>
              <div className="border-2 border-black rounded-lg p-4">
                <p className="font-bold mb-2">Player 2 (Yellow)</p>
                <p>{getPlayerName(gameState?.player2)}</p>
                {gameState?.player2 === currentUser?.id && (
                  <p className="text-xs text-gray-500 mt-1">(You)</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            {isInGame && gameState?.status === "playing" && (
              <Link href={`/game/${resolvedParams.id}`}>
                <button className="bg-black text-white px-6 py-3 rounded-lg flex items-center">
                  <FaPlay className="mr-2" />
                  Go to Game
                </button>
              </Link>
            )}

            {canJoin && (
              <button
                onClick={() => joinGame()}
                disabled={joining}
                className="bg-black text-white px-6 py-3 rounded-lg"
              >
                {joining ? "Joining..." : "Join Game"}
              </button>
            )}

            {isGameFull && gameState?.status === "waiting" && (
              <p className="text-gray-600">Waiting for the game to start...</p>
            )}

            {!canJoin && !isInGame && !isCreator && gameState?.status !== "waiting" && (
              <p className="text-gray-600">This game is already in progress.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}