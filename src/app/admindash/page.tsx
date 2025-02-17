"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client initialization for admin-side operations.
 * Uses environment variables for the Supabase URL and anon key.
 */
const SUPABASE_URL: string = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY: string = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * AdminDashPage component: 
 * - Verifies admin privileges.
 * - Allows setting an election role, adding/removing candidates, and showing/resetting voting results.
 * - Manages attendance reset.
 * - Supports logout actions.
 */
export default function AdminDashPage() {
  const router = useRouter();

  // State to store privileges received from admin verification.
  // Possible values: "", "all", "Valberedning", "Results".
  const [privileges, setPrivileges] = useState<"" | "all" | "Valberedning" | "Results">("");

  // Determine if the user can modify data. Only superadmin ("all") or "Valberedning" can modify.
  const canModify = privileges === "all" || privileges === "Valberedning";

  /**
   * useEffect to verify admin status on component mount.
   * - If not an admin, redirects to /admin (login page).
   * - Otherwise, sets the privileges state.
   */
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

  // State variables for election role, candidate name, list of candidates, and voting results.
  const [role, setRole] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [candidates, setCandidates] = useState<string[]>([]);
  const [results, setResults] = useState<{ [candidate: string]: number }>({});

  /**
   * useEffect to load the election role and candidates from Supabase on mount.
   * - Fetches "elections" table; ensures only one row remains.
   * - Fetches "candidates" table; stores candidate names in state.
   */
  useEffect(() => {
    const loadSupabaseData = async () => {
      // Fetch all rows from the "elections" table
      const { data: electionRows, error: electionErr } = await supabase
        .from("elections")
        .select("*");

      if (electionErr || !electionRows) {
        console.error("Error fetching elections:", electionErr);
        return;
      }

      // If no rows exist, insert a default row
      if (electionRows.length === 0) {
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
        // If multiple rows exist, keep the first and delete the rest
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

  /**
   * Handle saving the election role to Supabase.
   * - Deletes old roles.
   * - Inserts one new row with the current 'role'.
   */
  const handleRoleChange = async () => {
    // Delete all rows where id > "00000000-0000-0000-0000-000000000000"
    // (Ensures only one row remains)
    const { error: deleteError } = await supabase
      .from("elections")
      .delete()
      .gt("id", "00000000-0000-0000-0000-000000000000");

    if (deleteError) {
      alert("Error clearing old roles: " + deleteError.message);
      return;
    }

    // Insert the new role
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

  /**
   * Handle adding a new candidate to the "candidates" table.
   * - Trims the input, inserts into the table, updates local state.
   */
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

  /**
   * Handle removing a candidate from the "candidates" table.
   * - Deletes the candidate by name, updates local state.
   */
  const handleRemoveCandidate = async (cand: string) => {
    const { error } = await supabase.from("candidates").delete().eq("candidate", cand);

    if (error) {
      alert("Error removing candidate: " + error.message);
      return;
    }

    setCandidates((prev) => prev.filter((c) => c !== cand));
  };

  /**
   * Reset the attendance table by deleting all rows in "emails".
   * - If successful, alerts the user.
   * - If error, alerts the user with the error message.
   */
  const handleResetAttendance = async () => {
    try {
      const { error } = await supabase
        .from("emails")
        .delete()
        .not("id", "is", null); // Match all rows

      if (error) throw error;

      alert("Attendance table in Supabase has been reset!");
    } catch (err) {
      alert("Failed to reset attendance: " + (err as Error).message);
    }
  };

  /**
   * Handle showing current voting results.
   * - Fetches votes from the "votes" table for the current role.
   * - Tally votes by candidate, updates results state.
   */
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

    // Tally votes
    const tally: { [candidate: string]: number } = {};
    for (const row of votes) {
      const cand = row.candidate;
      tally[cand] = (tally[cand] || 0) + 1;
    }
    setResults(tally);
  };

  /**
   * Handle resetting all voting data in the "votes" table.
   * - Deletes all rows from "votes".
   * - Alerts the user upon success or error.
   */
  const handleResetVotes = async () => {
    const { error } = await supabase
      .from("votes")
      .delete()
      .not("id", "is", null); // Match all rows

    if (error) {
      alert("Failed to reset voting data: " + error.message);
      return;
    }

    alert("Voting data in Supabase has been reset!");
  };

  /**
   * Handle global logout of all admins:
   * - Calls '/api/logout-all' to increment session version (invalidates all admin sessions).
   * - Calls normal logout for the current user.
   * - Redirects to /admin.
   */
  const handleGlobalLogout = async () => {
    await fetch("/api/logout-all", { method: "POST" });
    await fetch("/api/logout", { method: "POST" });
    router.push("/admin");
  };

  /**
   * Handle logout for the current admin:
   * - Calls '/api/logout'.
   * - Redirects to /admin.
   */
  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.push("/admin");
  };

  // Render the admin dashboard UI
  return (
    <>
      <div className="min-h-screen bg-black p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Section for setting the election role */}
          <div className="rounded p-4" style={{ backgroundColor: "#2b2b2b" }}>
            <h2 className="text-2xl font-semibold mb-4" style={{ color: "#FFD700" }}>
              What post are we electing?
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
              Change Post
            </button>
          </div>

          {/* Section for adding candidates (only visible if canModify) */}
          {canModify && (
            <div className="rounded p-4" style={{ backgroundColor: "#2b2b2b" }}>
              <h2 className="text-2xl font-semibold mb-4" style={{ color: "#FFD700" }}>
                Current Candidates
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

          {/* List of current candidates, with remove functionality if canModify */}
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

          {/* Section for viewing voting results and resetting votes if canModify */}
          <div className="rounded p-4 space-y-4" style={{ backgroundColor: "#2b2b2b" }}>
            <h3 className="text-xl font-semibold" style={{ color: "#FFD700" }}>
              Voting Results
            </h3>
            <button
              onClick={handleShowResults}
              className="w-full py-2 rounded font-medium mb-2"
              style={{ backgroundColor: "#996633", color: "#FFD700" }}
            >
              Show Voting Results
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
              <p className="italic" style={{ color: "#FFF176" }}></p>
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

          {/* Section for managing attendance and handling logout actions */}
          <div className="rounded p-4" style={{ backgroundColor: "#2b2b2b" }}>
            <h3 className="text-xl font-semibold mb-4" style={{ color: "#FFD700" }}>
              Manage Attendance
            </h3>
            {canModify && (
              <div className="flex gap-2">
                <button
                  onClick={handleResetAttendance}
                  className="flex-1 px-4 py-2 rounded font-medium"
                  style={{ backgroundColor: "#F44336", color: "#FFF" }}
                  disabled={privileges === "Results"}
                >
                  Reset Attendance
                </button>
                {privileges === "all" && (
                  <button
                    onClick={handleGlobalLogout}
                    className="flex-1 px-4 py-2 rounded font-medium"
                    style={{ backgroundColor: "#D32F2F", color: "#FFF" }}
                  >
                    Logout All Admins
                  </button>
                )}
              </div>
            )}
            
            <button
              onClick={handleLogout}
              className="w-full py-2 rounded font-medium mt-4"
              style={{ backgroundColor: "#D32F2F", color: "#FFF" }}
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
