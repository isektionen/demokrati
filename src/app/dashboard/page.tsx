"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

// VotingDashboard: Displays the current election role, candidate options and handles voting and logout
export default function VotingDashboard() {
  const router = useRouter();

  // State variables for user email, election role, candidate list, etc.
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [candidates, setCandidates] = useState<string[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [maxVotes, setMaxVotes] = useState(1); // New state for max votes
  
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

  // 2. Periodically check if the user's session is still valid
  useEffect(() => {
    if (email) {
      const intervalId = setInterval(() => {
        (async () => {
          const { data, error } = await supabase
            .from("emails")
            .select("*")
            .eq("email", email);
          if (error || !data || data.length === 0) {
            alert("Session expired. Please sign in again.");
            router.push("/");
          }
        })();
      }, 60000); // check every 60 seconds

      return () => clearInterval(intervalId);
    }
  }, [email, router]);

  // 3. Fetch election data and candidate list once.
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

  useEffect(() => {
    const fetchMaxVotes = async () => {
      const { data, error } = await supabase
        .from("settings")
        .select("max_votes")
        .single();
      if (error) {
        console.error("Error fetching max votes:", error);
      } else if (data) {
        setMaxVotes(data.max_votes || 1);
      }
    };
    fetchMaxVotes();
  }, []);

  // 4. Check if the user has already voted when role and email are set.
  useEffect(() => {
    const checkUserVote = async () => {
      if (role && email) {
        const { data: existingVotes, error: voteErr } = await supabase
          .from("votes")
          .select("*")
          .eq("user_email", email)
          .eq("role", role);
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
    if (hasVoted) {
      alert("You have already voted for this role!");
      return;
    }
    if (selectedCandidates.length !== maxVotes) {
      alert(`Please select exactly ${maxVotes} candidates before submitting your vote.`);
      return;
    }

    try {
      const votes = selectedCandidates.map((candidate) => ({
        user_email: email,
        role,
        candidate,
        unique_vote: `${email}_${role}_${candidate}`,
      }));

      const { error: insertErr } = await supabase.from("votes").insert(votes);
      if (insertErr) {
        alert("Error inserting votes: " + insertErr.message);
        return;
      }

      setHasVoted(true);
      alert("Your votes have been submitted successfully!");
    } catch (err) {
      console.error("Error submitting votes:", err);
      alert("An error occurred while submitting your votes.");
    }
  };

  // Logout by calling the logout API and then redirecting to the homepage
  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.push("/");
  };

  // Memorize the candidate list input rendering to avoid re-computations on re-renders
  const candidateCheckboxes = useMemo(() => {
    return candidates.map((c) => (
      <label key={c} className="block mb-2" style={{ color: "#FFF176" }}>
        <input
          type="checkbox"
          name="candidate"
          value={c}
          className="mr-2"
          checked={selectedCandidates.includes(c)}
          onChange={(e) => {
            const value = e.target.value;
            setSelectedCandidates((prev) =>
              e.target.checked
                ? [...prev, value].slice(0, maxVotes) // Limit to maxVotes
                : prev.filter((v) => v !== value)
            );
          }}
          disabled={!selectedCandidates.includes(c) && selectedCandidates.length >= maxVotes}
        />
        {c}
      </label>
    ));
  }, [candidates, selectedCandidates, maxVotes]);

  // RENDER: Display the voting form, current role and logout button
  return (
    <div className="flex items-center justify-center min-h-screen bg-black p-4">
      {loading ? (
        <div>Loading...</div>
      ) : loadError ? (
        <div>{loadError}</div>
      ) : (
        <div className="w-full max-w-sm rounded-lg p-6" style={{ backgroundColor: "#2b2b2b" }}>
          <h1 className="text-3xl font-bold text-center mb-6" style={{ color: "#FFD700" }}>
            Demokrat-I
          </h1>
          {role ? (
            <p className="mb-4" style={{ color: "#FFF176" }}>
              <strong>We are currently voting for: </strong> {role}
            </p>
          ) : (
            <p className="mb-4" style={{ color: "#FFF176" }}>
              <strong>No role is set for voting yet</strong>
            </p>
          )}
          {hasVoted ? (
            <div style={{ color: "#FFF176" }}>
              You have already voted for <strong>{role}</strong>.<br />
              Please wait for the next election.
            </div>
          ) : role && candidates.length > 0 ? (
            <form onSubmit={handleVoteSubmit}>
              {candidateCheckboxes}
              <button
                type="submit"
                className="w-full p-2 rounded font-bold mt-4"
                style={{ backgroundColor: "#996633", color: "#FFD700" }}
              >
                Submit Votes
              </button>
            </form>
          ) : (
            <p style={{ color: "#FFF176", font: "bold" }}>
              {role ? "No candidates available." : "Please be patient, ValleB is cooking 🐳"}
            </p>
          )}
          <button onClick={handleLogout} className="mt-6 bg-red-500 text-white p-2 rounded w-full">
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
