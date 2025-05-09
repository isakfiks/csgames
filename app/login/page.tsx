
export default function Home() {
  return (
    <div className="grid items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="text-center flex flex-col gap-[32px] row-start-2 items-center">
        <h1>CS Games</h1>
        <button className="border-black p-2 rounded-lg border-2">Login with Discord</button>
        <button className="border-black p-2 rounded-lg border-2">Login with Google</button>
      </main>
      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
      </footer>
    </div>
  );
}
