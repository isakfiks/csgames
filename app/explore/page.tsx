'use client';
import Link from "next/link";
import { FaInfoCircle, FaCompass  } from "react-icons/fa";
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useState, useEffect } from 'react';

const supabase = createClientComponentClient();

export default function Home() {
  return (
    <div className="bg-white grid items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="text-black text-center flex flex-col row-start-2 items-center">
        <div className="flex">
            <h1>Explore Games</h1>
            </div>
      </main>
      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
      </footer>
    </div>
  );
}
