"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client initialization for admin-side operations.
 * Uses environment variables for the Supabase URL and anon key.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Supabase URL and Anon Key are missing from environment variables");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


/**
 * AdminDashPage component:
 * - Verifies admin privileges.
 * - Allows setting an election role, adding/removing candidates, and showing/resetting voting results.
 * - Manages attendance reset.
 * - Supports logout actions.
 *
 * Possible privilege values: "", "all", "valberedning", "results"
 * - "all"        => super admin can do everything
 * - "valberedning" => can modify data but not do "all" actions
 * - "results"    => can only view results (cannot modify)
 * - ""           => no privileges
 */
export default function AdminDashPage() {
  const router = useRouter();

  // State to store privileges from admin verification: "", "all", "valberedning", or "results".
  const [privileges, setPrivileges] = useState<"" | "all" | "valberedning" | "results">("");

  // Determine if the user can modify data. Only "all" or "valberedning" can modify.
  const canModify = privileges === "all" || privileges === "valberedning";

  /**
   * useEffect to verify admin status on component mount.
   * - If not an admin, redirect to /admin (login page).
   * - Otherwise, store the privileges in state.
   */
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const res = await fetch("/api/verify-admin");
        const data = await res.json();

        if (!data.isAdmin) {
          router.push("/admin");
        } else {
          // The server should return either "", "all", "valberedning", or "results"
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
   * On mount, load the election role and candidates from Supabase.
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
   */
  const handleRoleChange = async () => {
    // Delete all rows where id > "00000000-0000-0000-0000-000000000000"
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
   * Handle adding a new candidate.
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
   * Handle removing a candidate.
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
      if (err instanceof Error) {
        alert("Failed to reset attendance: " + err.message);
      } else {
        alert("Failed to reset attendance (unknown error).");
      }
    }
  };

  /**
   * Handle showing current voting results for the chosen role.
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
   * Handle global logout of all admins.
   */
  const handleGlobalLogout = async () => {
    await fetch("/api/logout-all", { method: "POST" });
    await fetch("/api/logout", { method: "POST" });
    router.push("/admin");
  };

  /**
   * Handle logout for the current admin.
   */
  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.push("/admin");
  };

  // Render the admin dashboard UI
  return (
    <>
      {privileges === "results" ? (
        // Minimal UI for "results" privilege with readonly election role & candidates view
        <div className="min-h-screen bg-black p-4">
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Readonly view of election role */}
            <div className="rounded p-4" style={{ backgroundColor: "#2b2b2b" }}>
              <h2 className="text-2xl font-semibold mb-4" style={{ color: "#FFD700" }}>
                What post are we electing?
              </h2>
              <div 
                className="w-full p-2 rounded border" 
                style={{ backgroundColor: "#FFF176", borderColor: "#996633", color: "#000" }}
              >
                {role || "No post set."}
              </div>
            </div>
            {/* Readonly candidate list view */}
            <div className="rounded p-4" style={{ backgroundColor: "#2b2b2b" }}>
              <h3 className="text-xl font-semibold mb-2" style={{ color: "#FFD700" }}>
                Current Candidates:
              </h3>
              {candidates.length > 0 ? (
                <ul className="space-y-2">
                  {candidates.map((cand) => (
                    <li key={cand} style={{ color: "#FFF176" }}>
                      {cand}
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ color: "#FFF176" }}>No candidates yet.</p>
              )}
            </div>
            {/* Voting Results Section */}
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
                <p className="italic" style={{ color: "#FFF176" }}>
                  No results to display.
                </p>
              )}
            </div>
            {/* Logout Section */}
            <button
              onClick={handleLogout}
              className="w-full py-2 rounded font-medium mt-4"
              style={{ backgroundColor: "#D32F2F", color: "#FFF" }}
            >
              Logout
            </button>
          </div>
        </div>
      ) : (
        // Full admin dashboard for "all" and "valberedning"
        <div className="min-h-screen bg-black p-4">
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Election role section */}
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
              />
              <button
                onClick={handleRoleChange}
                className="mt-2 px-4 py-2 rounded font-medium"
                style={{ backgroundColor: "#996633", color: "#FFD700" }}
              >
                Change Post
              </button>
            </div>
  
            {/* Candidate management section (only for modify privileges) */}
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
            )}
  
            {/* Candidate list section */}
            {canModify && (
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
            )}
  
            {/* Voting results section */}
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
              {canModify && (
                <button
                  onClick={handleResetVotes}
                  className="w-full py-2 rounded font-medium mb-2"
                  style={{ backgroundColor: "#F44336", color: "#FFF" }}
                >
                  Reset Voting Results
                </button>
              )}
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
                  No results to display.
                </p>
              )}
            </div>
  
            {/* Attendance management section */}
            {canModify && (
              <div className="rounded p-4" style={{ backgroundColor: "#2b2b2b" }}>
                <h3 className="text-xl font-semibold mb-4" style={{ color: "#FFD700" }}>
                  Manage Attendance
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={handleResetAttendance}
                    className="flex-1 px-4 py-2 rounded font-medium"
                    style={{ backgroundColor: "#F44336", color: "#FFF" }}
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
              </div>
            )}
  
            {/* Logout button (common for full dashboard) */}
            <button
              onClick={handleLogout}
              className="w-full py-2 rounded font-medium mt-4"
              style={{ backgroundColor: "#D32F2F", color: "#FFF" }}
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </>
  );
}
