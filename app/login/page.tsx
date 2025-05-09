import { FaDiscord, FaGoogle } from "react-icons/fa";

export default function Home() {
  return (
    <div className="grid items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="text-center flex flex-col gap-[12px] row-start-2 items-center">
        <div className="flex">
        <h1 className="text-2xl mb-2 font-bold">CSGames</h1><span className="text-2xl mb-2">.dev</span>
        </div>
        <div className="w-48 justify-center items-center flex border-[#7289da] bg-[#7289da] text-white p-2 rounded-lg border-2">
            <FaDiscord className=" mr-2"></FaDiscord>
        <button>Login with Discord</button>
        </div>
        <div className="w-48 justify-center items-center flex border-black text-white p-2 rounded-lg border-2">
            <FaGoogle className="text-black mr-2"></FaGoogle>
            <button className="text-black">Login with Google</button>
        </div>
      </main>
      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
      </footer>
    </div>
  );
}
