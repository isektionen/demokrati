"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// --- Supabase credentials ---
const SUPABASE_URL = "https://qegwcetrhbaaplkaeppd.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
  + "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlZ3djZXRyaGJhYXBsa2FlcHBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg3ODY4MTYsImV4cCI6MjA1NDM2MjgxNn0."
  + "M7CZVaull1RQgKSSAduoY5ZAuR7000L2PUB6Go8a-us";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function AdminDashPage() {
  // ----------------------------------------------------------------
  // 1) State: Role (election) from Supabase
  // ----------------------------------------------------------------
  const [role, setRole] = useState("");

  // ----------------------------------------------------------------
  // 2) State: Candidates from Supabase
  // ----------------------------------------------------------------
  const [candidateName, setCandidateName] = useState("");
  const [candidates, setCandidates] = useState<string[]>([]);

  // ----------------------------------------------------------------
  // 3) State: Voting Results (from Supabase `votes` table)
  // ----------------------------------------------------------------
  const [results, setResults] = useState<{ [candidate: string]: number }>({});

  // ----------------------------------------------------------------
  // 4) On mount, load the single `elections` row & candidates
  // ----------------------------------------------------------------
  useEffect(() => {
    const loadSupabaseData = async () => {
      // (A) Get all rows in `elections`; ensure we keep only one
      const { data: electionRows, error: electionErr } = await supabase
        .from("elections")
        .select("*");

      if (electionErr) {
        console.error("Error fetching elections:", electionErr);
        return;
      }
      if (!electionRows) {
        console.error("No data returned from `elections` table");
        return;
      }

      if (electionRows.length === 0) {
        // If no rows, insert one empty
        const { data: inserted, error: insertErr } = await supabase
          .from("elections")
          .insert({ election: "" })
          .select()
          .single();
        if (insertErr) {
          console.error("Error inserting default row:", insertErr);
          return;
        }
        setRole(inserted.election || "");
      } else {
        // If there's at least 1 row, keep the first, delete the rest
        const first = electionRows[0];
        setRole(first.election || "");
        if (electionRows.length > 1) {
          const idsToDelete = electionRows.slice(1).map((r) => r.id);
          await supabase.from("elections").delete().in("id", idsToDelete);
        }
      }

      // (B) Fetch all `candidates`
      const { data: candidatesData, error: candidatesErr } = await supabase
        .from("candidates")
        .select("candidate");
      if (candidatesErr) {
        console.error("Error fetching candidates:", candidatesErr);
      } else if (candidatesData && Array.isArray(candidatesData)) {
        setCandidates(candidatesData.map((row) => row.candidate));
      }
    };

    loadSupabaseData();
  }, []);

  // ----------------------------------------------------------------
  // 5) Save the single role -> delete all elections -> insert one row
  // ----------------------------------------------------------------
  const handleRoleChange = async () => {
    // Delete all old roles
    const { error: deleteError } = await supabase
      .from("elections")
      .delete()
      .gt("id", "00000000-0000-0000-0000-000000000000"); 
      // to satisfy "WHERE" requirement

    if (deleteError) {
      alert("Error clearing old roles: " + deleteError.message);
      return;
    }

    // Insert new row
    const { data: newRow, error: insertError } = await supabase
      .from("elections")
      .insert({ election: role })
      .select()
      .single();
    if (insertError) {
      alert("Error inserting new role: " + insertError.message);
      return;
    }

    setRole(newRow.election || "");
    alert(`Role saved as "${newRow.election}". Only one row remains in 'elections'.`);
  };

  // ----------------------------------------------------------------
  // 6) Add Candidate
  // ----------------------------------------------------------------
  const handleAddCandidate = async () => {
    const trimmed = candidateName.trim();
    if (!trimmed) return;
    setCandidateName("");

    const { error } = await supabase
      .from("candidates")
      .insert({ candidate: trimmed });
    if (error) {
      alert("Error inserting candidate: " + error.message);
      return;
    }

    setCandidates((prev) => [...prev, trimmed]);
  };

  // ----------------------------------------------------------------
  // 7) Remove Candidate
  // ----------------------------------------------------------------
  const handleRemoveCandidate = async (cand: string) => {
    const { error } = await supabase
      .from("candidates")
      .delete()
      .eq("candidate", cand);
    if (error) {
      alert("Error removing candidate: " + error.message);
      return;
    }
    setCandidates((prev) => prev.filter((c) => c !== cand));
  };

  // ----------------------------------------------------------------
  // 8) Reset Attendance
  // ----------------------------------------------------------------
  const handleResetAttendance = async () => {
    try {
      const { error } = await supabase.from("emails").delete();
      if (error) throw error;
      alert("Attendance table in Supabase has been reset!");
    } catch (err) {
      alert("Failed to reset attendance: " + (err as Error).message);
    }
  };

  // ----------------------------------------------------------------
  // 9) Show Current Results -> read from `votes` table
  // ----------------------------------------------------------------
  const handleShowResults = async () => {
    if (!role) {
      alert("No role set. Cannot show results.");
      setResults({});
      return;
    }

    // 9A) Get all votes for the current role
    const { data: votes, error: voteError } = await supabase
      .from("votes")
      .select("candidate")
      .eq("role", role);

    if (voteError) {
      alert("Error fetching votes: " + voteError.message);
      setResults({});
      return;
    }
    if (!votes || votes.length === 0) {
      alert(`No votes found for role: ${role}`);
      setResults({});
      return;
    }

    // 9B) Tally how many votes each candidate got
    const tally: { [candidate: string]: number } = {};
    for (const row of votes) {
      const cand = row.candidate;
      tally[cand] = (tally[cand] || 0) + 1;
    }

    setResults(tally);
  };

  // ----------------------------------------------------------------
  // 10) Reset ALL Voting Data -> clear the `votes` table
  // ----------------------------------------------------------------
  const handleResetVotes = async () => {
    const { error } = await supabase
      .from("votes")
      .delete()
      .gt("id", "00000000-0000-0000-0000-000000000000"); 

    if (error) {
      alert("Failed to reset votes: " + error.message);
    } else {
      setResults({});
      alert("All voting data has been reset. Users can now vote again.");
    }
  };


  // ----------------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------------
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
          <button
            onClick={handleRoleChange}
            className="mt-2 px-4 py-2 rounded font-medium"
            style={{ backgroundColor: "#996633", color: "#FFD700" }}
          >
            Save Role
          </button>
        </div>

        {/* Admin Panel: Add Candidate */}
        <div className="rounded p-4" style={{ backgroundColor: "#2b2b2b" }}>
          <h2 className="text-2xl font-semibold mb-4" style={{ color: "#FFD700" }}>
            Add Candidates
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
