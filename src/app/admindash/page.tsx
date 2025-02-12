"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// If you're using these exact credentials, replace them with your actual project details.
const SUPABASE_URL = "https://qegwcetrhbaaplkaeppd.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
  + "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlZ3djZXRyaGJhYXBsa2FlcHBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg3ODY4MTYsImV4cCI6MjA1NDM2MjgxNn0."
  + "M7CZVaull1RQgKSSAduoY5ZAuR7000L2PUB6Go8a-us";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function AdminDashPage() {
  // Role (election name)
  const [role, setRole] = useState("");

  // Candidates array
  const [candidateName, setCandidateName] = useState("");
  const [candidates, setCandidates] = useState<string[]>([]);

  // For displaying vote tallies: { "CandidateA": 2, "CandidateB": 1, ... }
  const [results, setResults] = useState<{ [candidate: string]: number }>({});

  // Load role & candidates from localStorage on mount
  useEffect(() => {
    const storedRole = localStorage.getItem("roleName");
    if (storedRole) setRole(storedRole);

    const storedCandidates = localStorage.getItem("candidates");
    if (storedCandidates) {
      try {
        setCandidates(JSON.parse(storedCandidates));
      } catch {
        // If parse fails, ignore
      }
    }
  }, []);

  // Save role & candidates whenever they change
  useEffect(() => {
    localStorage.setItem("roleName", role);
  }, [role]);

  useEffect(() => {
    localStorage.setItem("candidates", JSON.stringify(candidates));
  }, [candidates]);

  // Add a new candidate to the local array
  const handleAddCandidate = () => {
    const trimmed = candidateName.trim();
    if (!trimmed) return;
    setCandidates((prev) => [...prev, trimmed]);
    setCandidateName("");
  };

  // Remove a candidate
  const handleRemoveCandidate = (name: string) => {
    setCandidates((prev) => prev.filter((c) => c !== name));
  };

  // ----- Attendance Reset in Supabase -----
  const handleResetAttendance = async () => {
    try {
      // Wipe entire "emails" table
      const { error } = await supabase.from("emails").delete();
      if (error) throw error;
      alert("Attendance table in Supabase has been reset!");
    } catch (err: any) {
      alert("Failed to reset attendance: " + err.message);
    }
  };

  // ----- Show Results: read localStorage.votedData -----
  const handleShowResults = () => {
    const votedDataRaw = localStorage.getItem("votedData");
    if (!votedDataRaw) {
      alert("No votes found yet (no 'votedData' in localStorage).");
      setResults({});
      return;
    }

    try {
      // The structure might look like:
      // {
      //    "President": { "alice@example.com": "CandidateA", "bob@example.com": "CandidateB" },
      //    "Treasurer": { "alice@example.com": "CandidateC" }
      // }
      const votedData = JSON.parse(votedDataRaw);

      // Check if we have any votes for the current role
      if (!role) {
        alert("No role set. Cannot show results.");
        return;
      }
      if (!votedData[role]) {
        alert(`No votes found for role: ${role}`);
        setResults({});
        return;
      }

      // Tally how many votes each candidate got
      const roleVotes = votedData[role]; // { "alice@example.com": "CandidateA", "bob@example.com": "CandidateB" }
      const counts: { [candidate: string]: number } = {};
      for (const userEmail in roleVotes) {
        const candidate = roleVotes[userEmail];
        counts[candidate] = (counts[candidate] || 0) + 1;
      }

      setResults(counts);
    } catch (err) {
      console.error(err);
      alert("Error parsing votedData");
    }
  };

  // ----- Reset ALL voting data for ALL roles -----
  const handleResetVotes = () => {
    localStorage.removeItem("votedData");
    setResults({});
    alert("All voting data has been reset.");
  };

  return (
    <div className="min-h-screen bg-black p-4">
      <div className="max-w-4xl mx-auto space-y-4">

        {/* Role (Election) */}
        <div className="rounded p-4" style={{ backgroundColor: "#2b2b2b" }}>
          <h2 className="text-2xl font-semibold mb-4" style={{ color: "#FFD700" }}>
            What are we voting for?
          </h2>
          <input
            type="text"
            placeholder="e.g. President"
            className="w-full p-2 rounded border"
            style={{ backgroundColor: "#FFF176", borderColor: "#996633", color: "#000" }}
            value={role}
            onChange={(e) => setRole(e.target.value)}
          />
        </div>

        {/* Admin Panel: Add Candidate */}
        <div className="rounded p-4" style={{ backgroundColor: "#2b2b2b" }}>
          <h2 className="text-2xl font-semibold mb-4" style={{ color: "#FFD700" }}>
            Admin Panel
          </h2>
          <div className="flex space-x-2">
            <input
              type="text"
              placeholder="Candidate name"
              className="flex-1 p-2 rounded border"
              style={{ backgroundColor: "#FFF176", borderColor: "#996633", color: "#000" }}
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
            />
            <button
              onClick={handleAddCandidate}
              className="px-4 py-2 rounded font-medium"
              style={{ backgroundColor: "#996633", color: "#FFD700" }}
            >
              Add Candidate
            </button>
          </div>
        </div>

        {/* Current Candidates */}
        <div className="rounded p-4" style={{ backgroundColor: "#2b2b2b" }}>
          <h3 className="text-xl font-semibold mb-2" style={{ color: "#FFD700" }}>
            Current Candidates:
          </h3>
          {candidates.length > 0 ? (
            <ul className="space-y-2">
              {candidates.map((cand) => (
                <li key={cand} className="flex justify-between items-center">
                  <span style={{ color: "#FFF176" }}>{cand}</span>
                  <button
                    onClick={() => handleRemoveCandidate(cand)}
                    className="px-3 py-1 rounded"
                    style={{ backgroundColor: "#D32F2F", color: "#FFF" }}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ color: "#FFF176" }}>No candidates yet.</p>
          )}
        </div>

        {/* Voting Results */}
        <div className="rounded p-4 space-y-4" style={{ backgroundColor: "#2b2b2b" }}>
          <h3 className="text-xl font-semibold" style={{ color: "#FFD700" }}>
            Voting Results
          </h3>
          <button
            onClick={handleShowResults}
            className="w-full py-2 rounded font-medium mb-2"
            style={{ backgroundColor: "#996633", color: "#FFD700" }}
          >
            Show Current Results
          </button>

          {Object.keys(results).length > 0 ? (
            <ul>
              {Object.entries(results).map(([candidate, count]) => (
                <li key={candidate} style={{ color: "#FFF176" }}>
                  {candidate}: {count} vote{count > 1 ? "s" : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="italic" style={{ color: "#FFF176" }}>
              No votes yet (or no results to show).
            </p>
          )}

          <button
            onClick={handleResetVotes}
            className="w-full py-2 rounded font-medium"
            style={{ backgroundColor: "#F44336", color: "#FFF" }}
          >
            Reset All Voting Data
          </button>
        </div>

        {/* Reset Attendance (Supabase) */}
        <div className="rounded p-4" style={{ backgroundColor: "#2b2b2b" }}>
          <h3 className="text-xl font-semibold mb-4" style={{ color: "#FFD700" }}>
            Manage Attendance
          </h3>
          <button
            onClick={handleResetAttendance}
            className="px-4 py-2 rounded font-medium"
            style={{ backgroundColor: "#F44336", color: "#FFF" }}
          >
            Reset Attendance Table
          </button>
        </div>
      </div>
    </div>
  );
}
