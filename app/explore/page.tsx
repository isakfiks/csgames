'use client';
import Link from "next/link";
import { FaGamepad, FaCompass  } from "react-icons/fa";
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';


const supabase = createClientComponentClient();

export default function Home() {
  return (
    <div className="bg-white grid items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="text-black text-center flex flex-col row-start-2 items-center">
        <div>
            <h1 className="mb-8">Explore Games</h1>

            <div className="justify-center flex bg-gradient-to-r from-stone-800 to-stone-900 rounded-lg h-84 w-80">
              <div className="flex flex-col justify-end items-center h-full w-full">
                <h1 className="text-white mb-4">Clapping Bird Duels</h1>
                <div className="justify-center items-center bg-white rounded-lg p-2 mb-8 flex">
                  <FaGamepad className="w-8 mr-1"></FaGamepad>
                <button className="">Create Lobby</button>
              </div>
              </div>
            </div>
            </div>
      </main>
      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
      </footer>
    </div>
  );
}
