"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

// VotingDashboard: Displays the current election role, candidate options and handles voting and logout
export default function VotingDashboard() {
  const router = useRouter();

  // State variables for user email, election role, candidate list, etc.
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [candidates, setCandidates] = useState<string[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState("");
  const [hasVoted, setHasVoted] = useState(false);
  // Loading and error states improve user experience
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // 1. Check if user is logged in via secure cookie (using /api/verify-user)
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

  // 2. Fetch election data and candidate list once.
  useEffect(() => {
    const fetchElectionAndCandidates = async () => {
      try {
        // Fetch the current election role from the "elections" table
        const { data: electionData, error: electionErr } = await supabase
          .from("elections")
          .select("election")
          .limit(1);
        if (electionErr) {
          console.error("Error fetching election:", electionErr);
        } else if (electionData && electionData.length > 0) {
          setRole(electionData[0].election || "");
        } else {
          setRole("");
        }

        // Fetch the candidate list from "candidates" table
        const { data: candidateData, error: candidateErr } = await supabase
          .from("candidates")
          .select("candidate");
        if (candidateErr) {
          console.error("Error fetching candidates:", candidateErr);
        } else if (candidateData) {
          setCandidates(candidateData.map((row) => row.candidate));
        }
      } catch {
        setLoadError("Failed to load data.");
      } finally {
        setLoading(false);
      }
    };
    fetchElectionAndCandidates();
  }, []); // run once on mount

  // 3. Check if the user has already voted when role and email are set.
  useEffect(() => {
    const checkUserVote = async () => {
      if (role && email) {
        const { data: existingVotes, error: voteErr } = await supabase
          .from("votes")
          .select("*")
          .eq("role", role)
          .eq("user_email", email);
        if (voteErr) {
          console.error("Error checking votes:", voteErr);
        } else if (existingVotes && existingVotes.length > 0) {
          setHasVoted(true);
        }
      }
    };
    checkUserVote();
  }, [role, email]);

  // Handle vote submission by inserting a record into the "votes" table
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

    // Double-check if the user already voted to prevent duplicate entries
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

    // Insert a new vote record
    const { error: insertErr } = await supabase.from("votes").insert({
      user_email: email,
      role,
      candidate: selectedCandidate,
    });
    if (insertErr) {
      alert("Error inserting vote: " + insertErr.message);
      return;
    }

    setHasVoted(true);
    alert(`You voted for: ${selectedCandidate}`);
  };

  // Logout by calling the logout API and then redirecting to the homepage
  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.push("/");
  };

  if (loading) return <div>Loading...</div>;
  if (loadError) return <div>{loadError}</div>;

  // RENDER: Display the voting form, current role and logout button
  return (
    <div className="flex items-center justify-center min-h-screen bg-black p-4">
      <div className="w-full max-w-sm rounded-lg p-6" style={{ backgroundColor: "#2b2b2b" }}>
        <h1 className="text-3xl font-bold text-center mb-6" style={{ color: "#FFD700" }}>
          demokrat-I
        </h1>
        {role ? (
          <p className="mb-4" style={{ color: "#FFF176" }}>
            <strong>We are currently voting for:</strong> {role}
          </p>
        ) : (
          <p className="mb-4" style={{ color: "#FFF176" }}>
            <strong>No role set. Please check with the admin.</strong>
          </p>
        )}
        {hasVoted ? (
          <div style={{ color: "#FFF176" }}>
            You have already voted for <strong>{role}</strong>.<br />
            Please wait for the next election.
          </div>
        ) : (
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
              <button type="submit" className="w-full p-2 rounded font-bold mt-4" style={{ backgroundColor: "#996633", color: "#FFD700" }}>
                Submit Vote
              </button>
            </form>
          ) : (
            <p style={{ color: "#FFF176" }}>
              {role ? "No candidates available." : "No role is set for voting yet."}
            </p>
          )
        )}
        <button onClick={handleLogout} className="mt-6 bg-red-500 text-white p-2 rounded w-full">
          Logout
        </button>
      </div>
    </div>
  );
}
