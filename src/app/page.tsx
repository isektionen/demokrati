"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const response = await fetch("/api/check-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: username }),
    });

    const data = await response.json();

    if (data.valid) {
      // -------------------------------------------------------
      // (A) IF BACKEND SAYS USER IS ADMIN, SET isAdmin = "true"
      // -------------------------------------------------------
      // Let's assume your API returns data.isAdmin = true/false
      if (data.isAdmin) {
        sessionStorage.setItem("isAdmin", "true");
      } else {
        // Or if it's not an admin, store "false", or skip
        sessionStorage.setItem("isAdmin", "false");
      }

      // Optionally store the user’s email, if desired
      sessionStorage.setItem("userEmail", username);

      // Redirect to Dashboard
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
          demokrat-I
        </h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="text"
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full p-2 rounded border"
              style={{
                backgroundColor: "#FFF176", // Soft yellow
                borderColor: "#996633",      // Brown-ish border
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
            Login
          </button>
        </form>
      </div>
    </div>
  );
}
