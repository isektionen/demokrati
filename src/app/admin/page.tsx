"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const [adminName, setAdminName] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminName, adminPassword }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        router.push("/admindash");
      } else {
        setError(data.message || "Invalid admin credentials");
      }
    } catch (error) {
      console.error("Error processing admin login:", error);
      setError("Internal server error");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-black p-4">
      <div className="w-full max-w-sm rounded-lg p-6" style={{ backgroundColor: "#2b2b2b" }}>
        <h1 className="text-3xl font-bold text-center mb-6" style={{ color: "#FFD700" }}>Admin Login</h1>
        <form onSubmit={handleAdminLogin} className="space-y-4">
          <div>
            <input
              type="text"
              placeholder="Admin username"
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              required
              className="w-full p-2 rounded border"
              style={{ backgroundColor: "#FFF176", borderColor: "#996633", color: "#000" }}
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="Admin password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              required
              className="w-full p-2 rounded border"
              style={{ backgroundColor: "#FFF176", borderColor: "#996633", color: "#000" }}
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            className="w-full p-2 rounded font-bold"
            style={{ backgroundColor: "#996633", color: "#FFD700" }}
          >
            Login as Admin
          </button>
        </form>
      </div>
    </div>
  );
}
