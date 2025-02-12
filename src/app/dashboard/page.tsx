"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// We define a type for the votedData structure
type VotedData = {
  [roleName: string]: {
    [userEmail: string]: string;
  };
};

export default function VotingDashboard() {
  const router = useRouter();

  // Logged-in user’s email
  const [email, setEmail] = useState("");
  // Current role (e.g. “President”)
  const [role, setRole] = useState("");
  // Candidate list
  const [candidates, setCandidates] = useState<string[]>([]);
  // The candidate the user selects
  const [selectedCandidate, setSelectedCandidate] = useState("");

  // Tracks whether this user has already voted in the current role
  const [hasVoted, setHasVoted] = useState(false);

  // 1. Check if user is logged in; if not, redirect
  useEffect(() => {
    const storedEmail = sessionStorage.getItem("userEmail");
    if (!storedEmail) {
      router.push("/");
    } else {
      setEmail(storedEmail);
    }
  }, [router]);

  // 2. Load role & candidates from localStorage
  //    Check if user has voted for that role
  useEffect(() => {
    const storedRole = localStorage.getItem("roleName") || "";
    setRole(storedRole);

    const storedCandidates = localStorage.getItem("candidates");
    if (storedCandidates) {
      try {
        const parsed = JSON.parse(storedCandidates) as string[];
        setCandidates(parsed);
      } catch {
        // ignore parse errors
      }
    }

    // Check if the user has already voted for this role
    const votedDataRaw = localStorage.getItem("votedData");
    if (votedDataRaw && storedRole) {
      try {
        const votedData = JSON.parse(votedDataRaw) as VotedData;
        const storedEmailLocal = sessionStorage.getItem("userEmail");
        // e.g. votedData["President"]["alice@example.com"] = "CandidateA"
        if (
          storedEmailLocal &&
          votedData[storedRole] &&
          votedData[storedRole][storedEmailLocal]
        ) {
          setHasVoted(true);
        }
      } catch {
        // ignore parse errors
      }
    }
  }, []);

  // 3. Handle vote submission
  const handleVoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // If no role is set, do not allow voting.
    if (!role) {
      alert("No role is set for voting. Please check with the admin!");
      return;
    }

    if (!selectedCandidate) {
      alert("Please select a candidate before submitting your vote.");
      return;
    }

    // Mark user as voted in localStorage
    const votedDataRaw = localStorage.getItem("votedData");
    let votedData: VotedData = {};
    if (votedDataRaw) {
      votedData = JSON.parse(votedDataRaw) as VotedData;
    }

    // If there's no sub-object for the current role, create it
    if (!votedData[role]) {
      votedData[role] = {};
    }

    // If somehow they try to double-vote for the same role in one session:
    if (votedData[role][email]) {
      alert("You have already voted for this role!");
      setHasVoted(true);
      return;
    }

    // Mark this user’s email as having voted for selectedCandidate
    votedData[role][email] = selectedCandidate;

    // Save updated object
    localStorage.setItem("votedData", JSON.stringify(votedData));

    // Set hasVoted to true so we hide the form
    setHasVoted(true);

    alert(`You voted for: ${selectedCandidate}`);
  };

  // 4. Logout handler
  const handleLogout = () => {
    sessionStorage.removeItem("userEmail");
    router.push("/");
  };

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
