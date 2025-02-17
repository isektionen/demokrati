"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client for admin-side operations.
const SUPABASE_URL: string = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY: string = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// AdminDashPage: Provides controls to set the election role, manage candidates, and view results.
export default function AdminDashPage() {
  const router = useRouter();

  // New state to store privileges received from admin verification.
  const [privileges, setPrivileges] = useState<"" | "all" | "Valberedning" | "Results">("");

  // Compute modification permission: superadmin ("all") or "Valberedning" can modify.
  const canModify = privileges === "all" || privileges === "Valberedning";

  // Protection check: verify admin status before showing admin dashboard.
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const res = await fetch("/api/verify-admin");
        const data = await res.json();
        if (!data.isAdmin) {
          router.push("/admin");
        } else {
          setPrivileges(data.privileges || "");
        }
      } catch (err) {
        console.error("Error verifying admin:", err);
        router.push("/admin");
      }
    };
    checkAdmin();
  }, [router]);

  // State variables for election role, candidate list, and voting results.
  const [role, setRole] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [candidates, setCandidates] = useState<string[]>([]);
  const [results, setResults] = useState<{ [candidate: string]: number }>({});

  // Load election role and candidates on mount
  useEffect(() => {
    const loadSupabaseData = async () => {
      // Get all rows from the "elections" table
      const { data: electionRows, error: electionErr } = await supabase
        .from("elections")
        .select("*");
      if (electionErr || !electionRows) {
        console.error("Error fetching elections:", electionErr);
        return;
      }
      if (electionRows.length === 0) {
        // Insert a default (empty) row if none exist
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
        // Keep the first row and delete any extra rows
        const first = electionRows[0];
        setRole(first.election || "");
        if (electionRows.length > 1) {
          const idsToDelete = electionRows.slice(1).map((r) => r.id);
          await supabase.from("elections").delete().in("id", idsToDelete);
        }
      }

      // Fetch all candidates from the "candidates" table
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

  // Save the election role by deleting old roles and inserting one new row
  const handleRoleChange = async () => {
    const { error: deleteError } = await supabase
      .from("elections")
      .delete()
      .gt("id", "00000000-0000-0000-0000-000000000000");
    if (deleteError) {
      alert("Error clearing old roles: " + deleteError.message);
      return;
    }
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

  // Add a new candidate to the "candidates" table
  const handleAddCandidate = async () => {
    const trimmed = candidateName.trim();
    if (!trimmed) return;
    setCandidateName("");
    const { error } = await supabase.from("candidates").insert({ candidate: trimmed });
    if (error) {
      alert("Error inserting candidate: " + error.message);
      return;
    }
    setCandidates((prev) => [...prev, trimmed]);
  };

  // Remove a candidate from the "candidates" table
  const handleRemoveCandidate = async (cand: string) => {
    const { error } = await supabase.from("candidates").delete().eq("candidate", cand);
    if (error) {
      alert("Error removing candidate: " + error.message);
      return;
    }
    setCandidates((prev) => prev.filter((c) => c !== cand));
  };

  // Updated handleResetAttendance function
  const handleResetAttendance = async () => {
    try {
      const { error } = await supabase
        .from("emails")
        .delete()
        .not("id", "is", null); // Added WHERE clause to match all rows
      if (error) throw error;
      alert("Attendance table in Supabase has been reset!");
    } catch (err) {
      alert("Failed to reset attendance: " + (err as Error).message);
    }
  };

  // Show voting results by tallying votes from the "votes" table
  const handleShowResults = async () => {
    if (!role) {
      alert("No role set. Cannot show results.");
      setResults({});
      return;
    }
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
    // Tally up votes per candidate
    const tally: { [candidate: string]: number } = {};
    for (const row of votes) {
      const cand = row.candidate;
      tally[cand] = (tally[cand] || 0) + 1;
    }
    setResults(tally);
  };

  // Updated handleResetVotes function, if intended to delete from "emails"
  const handleResetVotes = async () => {
    const { error } = await supabase
      .from("emails")
      .delete()
      .not("id", "is", null); // Added WHERE clause to match all rows
    if (error) {
      alert("Failed to reset attendance: " + error.message);
      return;
    }
    alert("Attendance table in Supabase has been reset!");
  };

  // New handler to globally logout all admins.
  const handleGlobalLogout = async () => {
    // Call the logout-all endpoint to increment the session version.
    await fetch("/api/logout-all", { method: "POST" });
    // Optionally, also clear current session by calling normal logout.
    await fetch("/api/logout", { method: "POST" });
    router.push("/admin"); // Redirect back to the admin login page.
  };

  // New handler for a universal logout
  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.push("/admin");
  };

  // RENDER: Display admin controls for setting role, managing candidates, and viewing/resetting voting data.
  return (
    <>
      <div className="min-h-screen bg-black p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Global Logout button: superadmin ("all") can logout all */}
          {privileges === "all" && (
            <button
              onClick={handleGlobalLogout}
              className="w-full py-2 rounded font-medium mb-4"
              style={{ backgroundColor: "#D32F2F", color: "#FFF" }}
            >
              Logout All Admins
            </button>
          )}

          {/* Removed original universal logout button */}
          {/*
          <button
            onClick={handleLogout}
            className="w-full py-2 rounded font-medium mb-4"
            style={{ backgroundColor: "#424242", color: "#FFF" }}
          >
            Logout
          </button>
          */}

          {canModify && (
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
                disabled={privileges === "Results"}
              />
              <button
                onClick={handleRoleChange}
                className="mt-2 px-4 py-2 rounded font-medium"
                style={{ backgroundColor: "#996633", color: "#FFD700" }}
                disabled={privileges === "Results"}
              >
                Save Role
              </button>
            </div>
          )}

          {canModify && (
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
                  disabled={privileges === "Results"}
                />
                <button
                  onClick={handleAddCandidate}
                  className="px-4 py-2 rounded font-medium"
                  style={{ backgroundColor: "#996633", color: "#FFD700" }}
                  disabled={privileges === "Results"}
                >
                  Add Candidate
                </button>
              </div>
            </div>
          )}

          {/* Candidate list and remove functionality; remove button should be hidden for Results */}
          <div className="rounded p-4" style={{ backgroundColor: "#2b2b2b" }}>
            <h3 className="text-xl font-semibold mb-2" style={{ color: "#FFD700" }}>
              Current Candidates:
            </h3>
            {candidates.length > 0 ? (
              <ul className="space-y-2">
                {candidates.map((cand) => (
                  <li key={cand} className="flex justify-between items-center">
                    <span style={{ color: "#FFF176" }}>{cand}</span>
                    {canModify && (
                      <button
                        onClick={() => handleRemoveCandidate(cand)}
                        className="px-3 py-1 rounded"
                        style={{ backgroundColor: "#D32F2F", color: "#FFF" }}
                      >
                        Remove
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ color: "#FFF176" }}>No candidates yet.</p>
            )}
          </div>

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
            {/* ...existing results display... */}
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
            {canModify && (
              <button
                onClick={handleResetVotes}
                className="w-full py-2 rounded font-medium"
                style={{ backgroundColor: "#F44336", color: "#FFF" }}
                disabled={privileges === "Results"}
              >
                Reset All Voting Data
              </button>
            )}
          </div>

          <div className="rounded p-4" style={{ backgroundColor: "#2b2b2b" }}>
            <h3 className="text-xl font-semibold mb-4" style={{ color: "#FFD700" }}>
              Manage Attendance
            </h3>
            {canModify && (
              <button
                onClick={handleResetAttendance}
                className="px-4 py-2 rounded font-medium"
                style={{ backgroundColor: "#F44336", color: "#FFF" }}
                disabled={privileges === "Results"}
              >
                Reset Attendance Table
              </button>
            )}
          </div>
        </div>
      </div>

      {/* New Logout button fixed at the bottom for all credentials */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "10px",
          backgroundColor: "#2b2b2b",
          textAlign: "center"
        }}
      >
        <button
          onClick={handleLogout}
          className="w-full py-2 rounded font-medium"
          style={{ backgroundColor: "#D32F2F", color: "#FFF" }}
        >
          Logout
        </button>
      </div>
    </>
  );
}
