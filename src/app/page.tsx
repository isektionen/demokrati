"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [pincode, setPincode] = useState(""); // new state for pincode
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const response = await fetch("/api/check-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: username, pincode }), // include pincode if needed
    });

    const data = await response.json();

    if (data.valid) {
      // Remove sessionStorage sets; relying on cookie from API
      router.push("/dashboard");
    } else {
      setError(data.error || "Unable to login.");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-black p-4">
      {/* Outer container in black */}
      <div className="w-full max-w-sm rounded-lg p-6" style={{ backgroundColor: "#2b2b2b" }}>
        {/* Big title in gold */}
        <h1 className="text-3xl font-bold text-center mb-6" style={{ color: "#FFD700" }}>
          Demokrat-I
        </h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="text"
              placeholder="Skriv in ditt KTH-användarnamn"
              value={username}
              onChange={(e) => {
                let value = e.target.value;
                if (value.includes("@")) {
                  value = value.split("@")[0]; // remove everything after '@'
                }
                setUsername(value);
              }}
              required
              className="w-full p-2 rounded border"
              style={{
                backgroundColor: "#FFF176", // Soft yellow
                borderColor: "#996633",      // Brown-ish border
                color: "#000",
              }}
            />
          </div>
          <div>
            <input
              type="password" // changed to password so pincode is hidden
              placeholder="Ange din 3-siffriga pinkod"
              value={pincode}
              onChange={(e) => {
                const value = e.target.value;
                // allow only numbers and limit to 3 digits
                if (/^\d{0,3}$/.test(value)) {
                  setPincode(value);
                }
              }}
              required
              className="w-full p-2 rounded border"
              style={{
                backgroundColor: "#FFF176",
                borderColor: "#996633",
                color: "#000",
              }}
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            className="w-full p-2 rounded font-bold"
            style={{
              backgroundColor: "#996633", // Brown-ish button
              color: "#FFD700",           // Gold text on button
            }}
          >
            Logga in
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin")}
            className="w-full p-2 rounded font-bold mt-2"
            style={{
              backgroundColor: "#FFD700",
              color: "#000",
            }}
          >
            Admin Login
          </button>
        </form>
      </div>
    </div>
  );
}
