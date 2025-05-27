"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FaArrowLeft, FaPlay, FaSync, FaGamepad } from "react-icons/fa";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { RealtimeChannel } from "@supabase/supabase-js";
import React from "react";
import GenerateCodeButton from "../../components/GenerateCodeButton";
import LobbyMiniGame from "../../components/MiniGame";
import type { User } from "@supabase/supabase-js";

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
  status: "waiting" | "playing" | "finished" | "pending";
  created_at?: string;
  updated_at?: string;
  ai_opponent?: boolean;
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
  const [showAIOption, setShowAIOption] = useState(false);
  const [isSettingUpAI, setIsSettingUpAI] = useState(false);
  const [showMiniGame, setShowMiniGame] = useState(false);

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
        let gameData: Game | null = null;
        if (lobbyData?.game_id) {
          const { data: fetchedGameData, error: gameError } = await supabase
            .from("games")
            .select("*")
            .eq("id", lobbyData.game_id)
            .single();

          if (gameError) throw gameError;
          gameData = fetchedGameData;
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

            // If this is a Tic Tac Toe game and the creator just created it (status is pending),
            // show the AI option
            if (
              gameData?.title === "Tic Tac Toe" &&
              gameStateData.status === "waiting" &&
              gameStateData.player1 === session.user.id &&
              !gameStateData.ai_opponent
            ) {
              setShowAIOption(true);
            }
          }

          // Fetch player profiles
          const playerIds = [gameStateData.player1, gameStateData.player2].filter((id): id is string => id !== null);

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

              const playerIds = [payload.new.player1, payload.new.player2].filter((id): id is string => id !== null);
              if (playerIds.length > 0) {
                fetchPlayerProfiles(playerIds);
              }
            },
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
      const { data, error } = await supabase.from("profiles").select("*").in("id", playerIds);

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

        const playerIds = [gameStateData.player1, gameStateData.player2].filter((id): id is string => id !== null);
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

  async function setupAIOpponent() {
    if (!gameState || !currentUser) return;

    setIsSettingUpAI(true);

    try {
      // Set up the AI opponent
      const { error } = await supabase.rpc("setup_ai_opponent", {
        p_lobby_id: resolvedParams.id,
      });

      if (error) {
        console.error("Error setting up AI opponent:", error);
        return;
      }

      // Redirect to the game page
      router.push(`/game/${resolvedParams.id}`);
    } catch (err) {
      console.error("Error in setupAIOpponent:", err);
    } finally {
      setIsSettingUpAI(false);
    }
  }

  function waitForHumanOpponent() {
    if (!gameState) return;

    supabase
      .from("game_states")
      .update({ status: "waiting" })
      .eq("id", gameState.id)
      .then(({ error }) => {
        if (error) {
          console.error("Error updating game state:", error);
          return;
        }
        setShowAIOption(false);
      });
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
      <div className="bg-gradient-to-b from-white to-gray-50 min-h-screen font-[family-name:var(--font-geist-sans)]">
        <header className="max-w-4xl mx-auto p-8">
          <div className="flex justify-between items-center">
            <Link href="/explore" className="flex items-center text-black hover:text-gray-600 transition-colors duration-200 text-sm sm:text-base">
              <FaArrowLeft className="mr-2" />
              <span>Back to Games</span>
            </Link>
            <div className="flex items-center">
              <h1 className="text-xl sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">CSGames</h1>
              <span className="text-black text-xl sm:text-2xl">.dev</span>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto p-8">
          <div className="text-center animate-fadeIn">
            <div className="mb-8 relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full blur-xl opacity-70"></div>
              <svg
                className="mx-auto h-24 w-24 text-gray-400 relative transform transition-transform hover:scale-110 duration-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="text-4xl font-bold text-gray-900 mb-4 tracking-tight">Lobby Not Found</h2>
            <p className="text-gray-600 mb-8 max-w-md mx-auto text-lg">
              {error || "We couldn't find the lobby you're looking for. It may have expired or been deleted."}
            </p>

            <div className="space-y-6">
              <div className="bg-white shadow-lg rounded-2xl p-8 max-w-md mx-auto transform hover:scale-[1.02] transition-all duration-300">
                <h3 className="text-xl font-semibold mb-6 text-gray-900">What you can do:</h3>
                <ul className="text-left space-y-4">
                  <li className="flex items-center p-2 hover:bg-gray-50 rounded-lg transition-colors duration-200">
                    <div className="rounded-full bg-green-100 p-2 mr-4">
                      <svg
                        className="h-5 w-5 text-green-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <span className="text-gray-700">Check if you entered the correct lobby ID</span>
                  </li>
                </ul>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center max-w-md mx-auto">
                <Link
                  href="/explore"
                  className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-xl flex items-center justify-center hover:opacity-90 transition-all duration-300 shadow-md hover:shadow-xl"
                >
                  <FaGamepad className="mr-2" />
                  Browse Games
                </Link>
                <Link
                  href="/"
                  className="w-full sm:w-auto bg-white text-gray-900 px-8 py-3 rounded-xl flex items-center justify-center hover:bg-gray-50 transition-all duration-300 shadow-md border border-gray-200"
                >
                  <FaArrowLeft className="mr-2" />
                  Return Home
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const isCreator = lobby.created_by === currentUser?.id;
  const isInGame = gameState && (gameState.player1 === currentUser?.id || gameState.player2 === currentUser?.id);
  const canJoin = gameState && gameState.player2 === null && !isInGame && !isCreator && gameState.status === "waiting";
  const isGameFull = gameState && gameState.player1 && gameState.player2;
  const isWaiting = gameState && gameState.status === "waiting";

  // If showing AI option, render that instead of the regular lobby
  if (showAIOption && game?.title === "Tic Tac Toe" && currentUser) {
    return (
      <div className="bg-white min-h-screen p-4 sm:p-8 font-[family-name:var(--font-geist-sans)]">
        <header className="max-w-4xl mx-auto mb-6 sm:mb-8">
          <div className="flex justify-between items-center">
            <Link href="/explore" className="flex items-center text-black text-sm sm:text-base">
              <FaArrowLeft className="mr-2" />
              <span>Back to Games</span>
            </Link>
            <div className="flex">
              <h1 className="text-xl sm:text-2xl font-bold text-black">CSGames</h1>
              <span className="text-black text-xl sm:text-2xl">.dev</span>
            </div>
          </div>
        </header>

        <main className="text-black max-w-4xl mx-auto">
          <div className="mb-6">
            <h2 className="text-3xl font-bold text-black mb-4">Tic Tac Toe</h2>

            <div className="bg-white p-6 rounded-lg shadow-lg max-w-md mx-auto">
              <h2 className="text-2xl font-bold text-center mb-6">Choose Your Opponent</h2>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <button
                  className="p-4 rounded-lg border-2 flex flex-col items-center justify-center hover:bg-gray-50 transition-colors"
                  onClick={waitForHumanOpponent}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mb-2"
                  >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                  <span className="font-medium">Human</span>
                  <span className="text-xs text-gray-500 mt-1">Play against another player</span>
                </button>

                <button
                  className="p-4 rounded-lg border-2 flex flex-col items-center justify-center hover:bg-gray-50 transition-colors"
                  onClick={setupAIOpponent}
                  disabled={isSettingUpAI}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mb-2"
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="9" cy="10" r="2"></circle>
                    <circle cx="15" cy="10" r="2"></circle>
                    <path d="M9 16h6"></path>
                    <path d="m21 3-6 6"></path>
                  </svg>
                  <span className="font-medium">AI</span>
                  <span className="text-xs text-gray-500 mt-1">Play against the computer</span>
                </button>
              </div>

              {isSettingUpAI && (
                <div className="text-center text-gray-600 animate-pulse">Setting up AI opponent...</div>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen p-4 sm:p-8 font-[family-name:var(--font-geist-sans)]">
      <header className="max-w-4xl mx-auto mb-6 sm:mb-8">
        <div className="flex justify-between items-center">
          <Link href="/explore" className="flex items-center text-black text-sm sm:text-base">
            <FaArrowLeft className="mr-2" />
            <span>Back to Games</span>
          </Link>
          <div className="flex">
            <h1 className="text-xl sm:text-2xl font-bold text-black">CSGames</h1>
            <span className="text-black text-xl sm:text-2xl">.dev</span>
          </div>
        </div>
      </header>

      <main className="text-black max-w-4xl mx-auto">
        <div className="border-2 border-black rounded-lg p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-black">{game?.title || "Connect Four"} Lobby</h2>

            <div className="flex space-x-2">
              <button
                onClick={() => setShowMiniGame(!showMiniGame)}
                className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                aria-label="Play mini game"
              >
                <FaGamepad className="text-black" />
              </button>
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
          </div>

          {/* Mini Game Section */}
          {showMiniGame && (
            <div className="mb-4 sm:mb-6">
              <LobbyMiniGame onClose={() => setShowMiniGame(false)} />
            </div>
          )}

          <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col gap-2 text-sm sm:text-base">
              <p className="text-black">
                <strong>Lobby ID:</strong> {resolvedParams.id}
              </p>
              <p className="text-black">
                <strong>Status:</strong> {gameState?.status || "Waiting for players"}
              </p>
              <p className="text-black">
                <strong>Created by:</strong> {getPlayerName(gameState?.player1)}
              </p>
            </div>

            {isCreator && (
              <div className="mt-4 p-3 sm:p-4 border-2 border-black rounded-lg bg-gray-50">
                <h3 className="text-base sm:text-lg font-bold mb-2">Invitation Code</h3>
                <p className="text-xs sm:text-sm mb-3">Generate a short code that others can use to join this lobby.</p>
                <GenerateCodeButton lobbyId={resolvedParams.id} />
              </div>
            )}

            <div className="mt-6">
              <h3 className="text-lg sm:text-xl font-bold text-black mb-4">Players</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="border-2 border-black rounded-lg p-4 relative overflow-hidden transition-all duration-300 hover:shadow-lg group">
                  <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="absolute -bottom-2 -left-2 w-12 h-12 rounded-full bg-red-500 opacity-20"></div>
                  <p className="font-bold mb-2 flex items-center">
                    Player 1{" "}
                    <span className="ml-2 inline-block w-4 h-4 rounded-full bg-red-500"></span>
                  </p>
                  <p className="relative z-10">{getPlayerName(gameState?.player1)}</p>
                  {gameState?.player1 === currentUser?.id && (
                    <div className="flex items-center mt-2 text-xs text-gray-600">
                      <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1"></span>
                      <p>That&apos;s you!</p>
                    </div>
                  )}
                </div>

                <div className="border-2 border-black rounded-lg p-4 relative overflow-hidden transition-all duration-300 hover:shadow-lg group">
                  <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="absolute -bottom-2 -left-2 w-12 h-12 rounded-full bg-yellow-500 opacity-20"></div>
                  <p className="font-bold mb-2 flex items-center">
                    Player 2
                    <span className="ml-2 inline-block w-4 h-4 rounded-full bg-yellow-500"></span>
                  </p>
                  <p className="relative z-10">
                    {gameState?.ai_opponent ? (
                      <span className="flex items-center">
                        <svg
                          className="w-5 h-5 mr-1"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect x="3" y="4" width="18" height="16" rx="2" ry="2"></rect>
                          <circle cx="9" cy="10" r="2"></circle>
                          <circle cx="15" cy="10" r="2"></circle>
                          <path d="M9 16h6"></path>
                        </svg>
                        AI Opponent
                      </span>
                    ) : (
                      getPlayerName(gameState?.player2)
                    )}
                  </p>
                  {gameState?.player2 === currentUser?.id && (
                    <div className="flex items-center mt-2 text-xs text-gray-600">
                      <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1"></span>
                      <p>That&apos;s you!</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200">
              <h3 className="text-base sm:text-lg font-bold mb-3">Game Status</h3>
              <div className="flex items-center mb-4">
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-500 ${
                      gameState?.status === "playing"
                        ? "bg-green-600 w-full"
                        : gameState?.status === "waiting" && isGameFull
                        ? "bg-yellow-500 w-3/4"
                        : "bg-blue-500 w-1/4"
                    }`}
                  ></div>
                </div>
                <span className="ml-3 text-sm font-medium">
                  {gameState?.status === "playing"
                    ? "In Progress"
                    : gameState?.status === "waiting" && isGameFull
                    ? "Ready to Start"
                    : "Waiting for Players"}
                </span>
              </div>

              {isGameFull && isWaiting && isCreator && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-700 mb-2">
                    All players are ready! As the creator of this lobby, you can start the game.
                  </p>
                  <Link href={`/game/${resolvedParams.id}`}>
                    <button className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-6 py-2 rounded-lg flex items-center hover:from-yellow-600 hover:to-orange-600 transition-all duration-300 transform hover:scale-105 shadow-md">
                      <FaPlay className="mr-2" />
                      Start Game
                    </button>
                  </Link>
                </div>
              )}

              {isGameFull && isWaiting && !isCreator && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg animate-pulse">
                  <div className="flex items-center">
                    <svg
                      className="w-5 h-5 text-blue-600 mr-2 animate-spin"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="10"></circle>
                      <path d="M12 6v6l4 2"></path>
                    </svg>
                    <p className="text-sm text-blue-700">Waiting for the host to start the game...</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex-grow w-full sm:w-auto">
                {!isInGame && !canJoin && !isCreator && gameState?.status !== "waiting" && (
                  <div className="p-3 bg-gray-100 rounded-lg border border-gray-200">
                    <p className="text-gray-600 text-sm">This game is already in progress.</p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 w-full sm:w-auto">
                {isInGame && gameState?.status === "playing" && (
                  <Link href={`/game/${resolvedParams.id}`} className="w-full sm:w-auto">
                    <button className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-lg flex items-center justify-center hover:from-purple-700 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105 shadow-md">
                      <FaPlay className="mr-2" />
                      Go to Game
                    </button>
                  </Link>
                )}

                {canJoin && (
                <button
                  onClick={() => joinGame()}
                  disabled={joining}
                  className="relative overflow-hidden bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-lg flex items-center hover:from-green-600 hover:to-emerald-700 transition-all duration-300 shadow-md disabled:opacity-70"
                >
                  {joining ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Joining...
                    </>
                  ) : (
                    <>
                      Join Game
                      <span className="absolute -top-10 -right-10 w-20 h-20 bg-white/20 rotate-45 transform translate-x-1/2 -translate-y-1/2 transition-transform duration-700 ease-in-out group-hover:translate-y-full"></span>
                    </>
                  )}
                </button>
              )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

