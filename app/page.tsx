import Link from "next/link";
import { FaInfoCircle, FaCompass  } from "react-icons/fa";

export default function Home() {
  return (
    <div className="bg-white grid items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="text-black text-center flex flex-col row-start-2 items-center">
        <div className="flex">
        <h1 className="text-2xl font-bold">CSGames</h1><span className="text-2xl mb-2">.dev</span>
        </div>

        <div className="flex ">
        <h1 className="mb-8">Developed by </h1><Link href="https://github.com/isakfiks"><h1 className="ml-1 underline mb-8">isakfiks</h1></Link><h1>,</h1><Link href="https://github.com/nopedal"><h1 className="ml-1 underline mb-8">nopedal</h1></Link><h1>,</h1>  <Link href="https://github.com/NightStealPea"><h1 className="ml-1 underline mb-8">nightstealpea</h1></Link>    
        </div>
        <div className="flex items-center justify-center">

        <div className="items-center justify-center flex mr-2 border-black p-2 rounded-lg border-2">
          <FaCompass className="mr-2"></FaCompass>
        <Link href="/explore">
        <button className="">Explore Games</button></Link>
        </div>

        <div className="items-center justify-center flex bg-black text-white border-black p-2 rounded-lg border-2">
          <FaInfoCircle className="mr-2"></FaInfoCircle >
                <Link href="/about">
                <button className="">About</button></Link>
        </div>
      </div>
      </main>
      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
      </footer>
    </div>
  );
}
