"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

// -----------------------------
// 1) Supabase setup - Retrieve Supabase credentials from environment variables
// -----------------------------
const SUPABASE_URL: string = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY: string = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function VotingDashboard() {
  const router = useRouter();

  // -----------------------------
  // 2) State Variables
  // -----------------------------
  // The logged-in user’s email (from sessionStorage)
  const [email, setEmail] = useState("");
  // The single role we fetched from `elections` (e.g., “President”)
  const [role, setRole] = useState("");
  // The list of candidate names from `candidates`
  const [candidates, setCandidates] = useState<string[]>([]);
  // Which candidate the user chooses
  const [selectedCandidate, setSelectedCandidate] = useState("");
  // Has the user already voted for the current role?
  const [hasVoted, setHasVoted] = useState(false);

  // -----------------------------
  // 3) Check if user is logged in, or redirect
  // -----------------------------
  useEffect(() => {
    const checkUser = async () => {
      const res = await fetch("/api/verify-user");
      if (res.ok) {
        const result = await res.json();
        setEmail(result.email);
      } else {
        router.push("/");
      }
    };
    checkUser();
  }, [router]);

  // -----------------------------
  // 4) Fetch: 1) the single role from `elections`, 2) all candidates, 3) check if user has voted
  // -----------------------------
  useEffect(() => {
    const loadData = async () => {
      // 4A) Get the single row from `elections` (if any)
      const { data: electionData, error: electionErr } = await supabase
        .from("elections")
        .select("election")
        .limit(1); // we only want one row
      if (electionErr) {
        console.error("Error fetching election:", electionErr);
      } else if (electionData && electionData.length > 0) {
        const currentRole = electionData[0].election || "";
        setRole(currentRole);
      } else {
        // If no row, there's no role set
        setRole("");
      }

      // 4B) Get all candidates
      const { data: candidateData, error: candidateErr } = await supabase
        .from("candidates")
        .select("candidate");
      if (candidateErr) {
        console.error("Error fetching candidates:", candidateErr);
      } else if (candidateData) {
        setCandidates(candidateData.map((row) => row.candidate));
      }

      // 4C) Check if this user has already voted for the current role
      //    We'll do a separate fetch here AFTER we know the role
      //    If role is empty, there's no vote to check
      if (role) {
        try {
          const { data: existingVotes, error: voteErr } = await supabase
            .from("votes")
            .select("*")
            .eq("role", role)
            .eq("user_email", email);

          if (voteErr) {
            console.error("Error checking votes:", voteErr);
          } else if (existingVotes && existingVotes.length > 0) {
            // They have already voted
            setHasVoted(true);
          }
        } catch (err) {
          console.error("Error checking if user voted:", err);
        }
      }
    };

    loadData();
  }, [role, email]); // Only re-run if "role" or "email" changes

  // -----------------------------
  // 5) Submit Vote -> Insert row into `votes` (if not already voted)
  // -----------------------------
  const handleVoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!role) {
      alert("No role is set for voting. Please check with the admin!");
      return;
    }
    if (!selectedCandidate) {
      alert("Please select a candidate before submitting your vote.");
      return;
    }

    // Double-check if user has already voted
    // (If you add a unique constraint in the DB, that also protects you.)
    const { data: alreadyVoted, error: checkErr } = await supabase
      .from("votes")
      .select("*")
      .eq("role", role)
      .eq("user_email", email);
    if (checkErr) {
      alert("Error checking votes: " + checkErr.message);
      return;
    }
    if (alreadyVoted && alreadyVoted.length > 0) {
      alert("You have already voted for this role!");
      setHasVoted(true);
      return;
    }

    // Insert new row in `votes`
    const { error: insertErr } = await supabase.from("votes").insert({
      user_email: email,
      role,
      candidate: selectedCandidate,
    });

    if (insertErr) {
      // If you have the unique constraint, you'd catch the duplicate error here
      alert("Error inserting vote: " + insertErr.message);
      return;
    }

    // Mark user as having voted
    setHasVoted(true);
    alert(`You voted for: ${selectedCandidate}`);
  };

  // -----------------------------
  // 6) Logout
  // -----------------------------
  const handleLogout = () => {
    sessionStorage.removeItem("userEmail");
    router.push("/");
  };

  // -----------------------------
  // RENDER
  // -----------------------------
  return (
    <div className="flex items-center justify-center min-h-screen bg-black p-4">
      <div
        className="w-full max-w-sm rounded-lg p-6"
        style={{ backgroundColor: "#2b2b2b" }}
      >
        <h1
          className="text-3xl font-bold text-center mb-6"
          style={{ color: "#FFD700" }}
        >
          demokrat-I
        </h1>

        {/* Show the role being voted on, if any */}
        {role ? (
          <p className="mb-4" style={{ color: "#FFF176" }}>
            <strong>We are currently voting for:</strong> {role}
          </p>
        ) : (
          <p className="mb-4" style={{ color: "#FFF176" }}>
            <strong>No role set. Please check with the admin.</strong>
          </p>
        )}

        {/* If the user has already voted, show a message */}
        {hasVoted ? (
          <div style={{ color: "#FFF176" }}>
            You have already voted for <strong>{role}</strong>.<br />
            Please wait for the next election.
          </div>
        ) : (
          // If no candidates exist or no role is set, show relevant message
          role && candidates.length > 0 ? (
            <form onSubmit={handleVoteSubmit}>
              {candidates.map((c) => (
                <label key={c} className="block mb-2" style={{ color: "#FFF176" }}>
                  <input
                    type="radio"
                    name="candidate"
                    value={c}
                    className="mr-2"
                    checked={selectedCandidate === c}
                    onChange={() => setSelectedCandidate(c)}
                  />
                  {c}
                </label>
              ))}
              <button
                type="submit"
                className="w-full p-2 rounded font-bold mt-4"
                style={{ backgroundColor: "#996633", color: "#FFD700" }}
              >
                Submit Vote
              </button>
            </form>
          ) : (
            <p style={{ color: "#FFF176" }}>
              {role
                ? "No candidates available."
                : "No role is set for voting yet."}
            </p>
          )
        )}

        {/* Logout button */}
        <button
          onClick={handleLogout}
          className="mt-6 bg-red-500 text-white p-2 rounded w-full"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
