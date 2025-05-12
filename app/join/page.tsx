"use client";
import { useState } from "react"
import Link from "next/link";

export default function Join() {
    const [isLoading, setIsLoading] = useState(false)
    const [notFound, setNotFound] = useState(false)

    async function joinGame(){
        // Refresh values
        setIsLoading(false)
        setNotFound(false)

        const code = document.getElementById("code") as HTMLInputElement

        if (code.value.length <=0) {
            console.log(code)
            console.log("Wrong format")
            alert("Code field can not be empty")
            return
        }

        
        //setIsLoading(true);
        //setNotFound(true)
        
        location.href = "/lobby/"+code.value
    }

return (
    <div className="bg-gradient-to-b from-white to-gray-50 min-h-screen font-[family-name:var(--font-geist-sans)] relative">
        
        <div className="place-items-center min-h-screen p-8 flex justify-center">
        <div className="justify-center align-center text-center">

        <h1 className="mb-2 text-xl font-bold">Enter Code</h1>
        <div className="flex justify-center">
        <h1 className="opacity-90">if you don't have a code, go to </h1><Link href="/explore"><h1 className="opacity-90 ml-1 text-slate-500">explore</h1></Link>
        </div>
        <input id="code"  placeholder="1234.." className="mt-8 rounded-lg p-3 text-black border-black border-2"></input>
        <button onClick={joinGame} className="bg-stone-700 p-3 text-white rounded-lg border-black border-2 ml-2">{isLoading ? "Joining.." : "Join"}</button>
        { notFound ? <h1 className="mt-2 text-red-600">invalid or expired code..</h1>: ""}
        </div>

        </div>
    </div>
)
}