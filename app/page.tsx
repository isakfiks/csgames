// app/page.tsx
'use client';

import Link from "next/link";
import { FaInfoCircle, FaCompass, FaDiscord, FaGoogle } from "react-icons/fa";
import { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { User } from "@supabase/supabase-js";
import type { Database } from "./types/supabase";

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [supabase, setSupabase] = useState<ReturnType<typeof createClientComponentClient<Database>> | null>(null);

  // Initialize Supabase client safely
  useEffect(() => {
    try {
      const client = createClientComponentClient<Database>();
      setSupabase(client);
    } catch (error) {
      console.error("Failed to initialize Supabase client:", error);
    }
  }, []);

  // Check if user is logged in
  useEffect(() => {
    if (!supabase) return;

    const checkUser = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        setUser(session?.user || null);

        // Listen for changes
        const {
          data: { subscription },
        } = await supabase.auth.onAuthStateChange((_event, session) => {
          setUser(session?.user || null);
        });

        return () => subscription.unsubscribe();
      } catch (error) {
        console.error("Session check error:", error);
      }
    };

    checkUser();
  }, [supabase]);

  // Rest of your component remains the same...
}