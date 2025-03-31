"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

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

  // New state for alert modal
  const [alertInfo, setAlertInfo] = useState<{ title: string; message: string } | null>(null);
  
  // Helper to show alert modal
  const showAlert = (title: string, message: string) => {
    setAlertInfo({ title, message });
  };

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

  // Periodically check admin authorization
  useEffect(() => {
    const intervalId = setInterval(async () => {
      const res = await fetch("/api/verify-admin");
      const data = await res.json();
      if (!res.ok || !data.isAdmin) {
        alert("Session expired. Please sign in again.");
        router.push("/admin");
      }
    }, 120000); // check every two minutes

    return () => clearInterval(intervalId);
  }, [router]);


  // State variables for election role, candidate name, list of candidates, and voting results.
  const [role, setRole] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [candidates, setCandidates] = useState<string[]>([]);
  const [results, setResults] = useState<{ [candidate: string]: number }>({});

  // State variables for detailed votes modal
  const [showVotesModal, setShowVotesModal] = useState(false);
  const [detailedVotes, setDetailedVotes] = useState<
    Array<{ candidate: string; role: string; firstname: string; lastname: string }>
  >([]);
  
  // State variables for attendance modal
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [attendanceList, setAttendanceList] = useState<
    { firstname: string; lastname: string; time: string }[]
  >([]);

  // State variables for confirmation modals
  const [showResetAttendanceConfirm, setShowResetAttendanceConfirm] = useState(false);
  const [showResetVotesConfirm, setShowResetVotesConfirm] = useState(false);

  // State variables for attendance add and remove popups:
  const [showRemoveAttendancePopup, setShowRemoveAttendancePopup] = useState(false);
  const [removeAttendanceList, setRemoveAttendanceList] = useState<
    Array<{ email: string; firstname: string; lastname: string; time: string }>
  >([]);
  const [showAddAttendancePopup, setShowAddAttendancePopup] = useState(false);
  const [newAttendanceEmail, setNewAttendanceEmail] = useState("");
  const [newAttendancePassword, setNewAttendancePassword] = useState("");
  const [newAttendanceFirstname, setNewAttendanceFirstname] = useState("");
  const [newAttendanceLastname, setNewAttendanceLastname] = useState("");

  // State variables for showing voting results modal
  const [showVotingResultsPopup, setShowVotingResultsPopup] = useState(false);

  /**
   * On mount, load the election role and candidates from Supabase.
   */
  useEffect(() => {
    const loadSupabaseData = async () => {
      try {
        const [electionRes, candidatesRes] = await Promise.all([
          supabase.from("elections").select("id, election"),  // select only needed columns
          supabase.from("candidates").select("candidate")
        ]);

        if (electionRes.error || !electionRes.data) {
          console.error("Error fetching elections:", electionRes.error);
        } else {
          const electionRows = electionRes.data;
          if (electionRows.length === 0) {
            const { data: inserted, error: insertErr } = await supabase
              .from("elections")
              .insert({ election: "" })
              .select("election")
              .single();
            if (insertErr) {
              console.error("Error inserting default row:", insertErr);
              return;
            }
            setRole(inserted.election || "");
          } else {
            setRole(electionRows[0].election || "");
            if (electionRows.length > 1) {
              const idsToDelete = electionRows.slice(1).map((r) => r.id);
              await supabase.from("elections").delete().in("id", idsToDelete);
            }
          }
        }

        if (candidatesRes.error) {
          console.error("Error fetching candidates:", candidatesRes.error);
        } else if (candidatesRes.data && Array.isArray(candidatesRes.data)) {
          setCandidates(candidatesRes.data.map((row) => row.candidate));
        }
      } catch (error) {
        console.error("Error loading data:", error);
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
      showAlert("Error", "Error clearing old roles: " + deleteError.message);
      return;
    }

    // Insert the new role
    const { data: newRow, error: insertError } = await supabase
      .from("elections")
      .insert({ election: role })
      .select()
      .single();

    if (insertError) {
      showAlert("Error", "Error inserting new role: " + insertError.message);
      return;
    }

    setRole(newRow.election || "");
    showAlert("Success", `Role saved as "${newRow.election}".`);
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
      showAlert("Error", "Error inserting candidate: " + error.message);
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
      showAlert("Error", "Error removing candidate: " + error.message);
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

      showAlert("Success", "Attendance has been reset!");
    } catch (err) {
      if (err instanceof Error) {
        showAlert("Error", "Failed to reset attendance: " + err.message);
      } else {
        showAlert("Error", "Failed to reset attendance (unknown error).");
      }
    }
  };

  /**
   * Handle showing current voting results for the chosen role.
   */
  const handleShowResults = async () => {
    if (!role) {
      showAlert("Notice", "No role set. Cannot show results.");
      setResults({});
      return;
    }

    const { data: votes, error: voteError } = await supabase
      .from("votes")
      .select("candidate")
      .eq("role", role);

    if (voteError) {
      showAlert("Error", "Error fetching votes: " + voteError.message);
      setResults({});
      return;
    }

    if (!votes || votes.length === 0) {
      showAlert("Notice", `No votes found for role: ${role}`);
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
    setShowVotingResultsPopup(true); // Open modal popup
  };

  /**
   * Handle showing detailed votes.
   */
  const handleShowDetailedVotes = async () => {
    // Define types for vote and email entries.
    type VoteRow = { user_email: string; candidate: string; role: string };
    type EmailData = { email: string; firstname: string; lastname: string };

    // Fetch votes with user_email, candidate, and role
    const { data: votesData, error: votesError } = await supabase
      .from("votes")
      .select("user_email, candidate, role");
    if (votesError) {
      showAlert("Error", "Error fetching detailed votes: " + votesError.message);
      return;
    }
    if (!votesData || votesData.length === 0) {
      showAlert("Notice", "No votes found.");
      return;
    }
    
    const uniqueEmails = [...new Set((votesData as VoteRow[]).map((vote: VoteRow) => vote.user_email))];
    const { data: emailsData, error: emailsError } = await supabase
      .from("emails")
      .select("email, firstname, lastname")
      .in("email", uniqueEmails);
    if (emailsError) {
      showAlert("Error", "Error fetching email details: " + emailsError.message);
      return;
    }
    const emailLookup: Record<string, { firstname: string; lastname: string }> = {};
    (emailsData as EmailData[])?.forEach((entry: EmailData) => {
      emailLookup[entry.email] = { firstname: entry.firstname, lastname: entry.lastname };
    });
    // Merge vote data with email details (including role)
    const merged = (votesData as VoteRow[]).map((vote: VoteRow) => {
      const name = emailLookup[vote.user_email] || { firstname: "Unknown", lastname: "" };
      return {
        candidate: vote.candidate,
        role: vote.role,
        firstname: name.firstname,
        lastname: name.lastname
      };
    });
    setDetailedVotes(merged);
    setShowVotesModal(true);
  };

  /**
   * Handle showing attendance list.
   */
  const handleShowAttendance = async () => {
    const { data, error } = await supabase.from("emails").select("firstname, lastname, time");
    if (error) {
      showAlert("Error", "Error fetching attendance: " + error.message);
      return;
    }
    setAttendanceList(data);
    setShowAttendanceModal(true);
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
      showAlert("Error", "Failed to reset voting data: " + error.message);
      return;
    }

    showAlert("Success", "Voting data has been reset!");
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

  /**
   * Open remove attendance popup and fetch attendance list.
   */
  const handleOpenRemoveAttendancePopup = async () => {
    const { data, error } = await supabase.from("emails").select("email, firstname, lastname, time");
    if (error) {
      showAlert("Error", "Error fetching attendance: " + error.message);
      return;
    }
    setRemoveAttendanceList(data);
    setShowRemoveAttendancePopup(true);
  };
  
  /**
   * Remove an individual attendance entry
   */
  const handleRemoveAttendanceRow = async (email: string) => {
    const { error } = await supabase.from("emails").delete().eq("email", email);
    if (error) {
      showAlert("Error", "Error removing attendance: " + error.message);
      return;
    }
    setRemoveAttendanceList((prev) => prev.filter((item) => item.email !== email));
    showAlert("Success", `Removed attendance for ${email}.`);
  };
  
  /**
   * Open add attendance popup
   */
  const handleOpenAddAttendancePopup = () => {
    setNewAttendanceEmail("");
    setNewAttendancePassword("");
    setNewAttendanceFirstname("");
    setNewAttendanceLastname("");
    setShowAddAttendancePopup(true);
  };
  
  /**
   * Add a new attendance entry with input validations.
   */
  const handleAddAttendanceRow = async () => {
    // Validate that password contains only numbers and is no more than 3 digits.
    if (!/^[0-9]{1,3}$/.test(newAttendancePassword)) {
      showAlert("Notice", "Pincode must be 3 digits, and only numbers.");
      return;
    }
    // Validate that email contains only letters (no numbers or special characters) and is at most 10 chars.
    if (!/^[A-Za-z]{1,10}$/.test(newAttendanceEmail)) {
      showAlert(
        "Notice",
        "Only enter the KTH-username, without @kth.se, max 10 letters, no numbers or special characters."
      );
      return;
    }
    if (!newAttendanceFirstname || !newAttendanceLastname) {
      showAlert("Notice", "Please enter all fields.");
      return;
    }
    const { error } = await supabase.from("emails").insert({
      email: newAttendanceEmail,
      password: newAttendancePassword,
      firstname: newAttendanceFirstname,
      lastname: newAttendanceLastname,
      time: new Date().toISOString()
    });
    if (error) {
      if (error.message.includes("duplicate key value violates unique constraint")) {
        showAlert("Error", `${newAttendanceEmail} already checked in`);
      } else {
        showAlert("Error", "Error adding attendance: " + error.message);
      }
      return;
    }
    showAlert("Success", `Added attendance for ${newAttendanceEmail}.`);
    setShowAddAttendancePopup(false);
  };

  // Compute total votes each render.
  const totalVotes = Object.values(results).reduce((sum, count) => sum + count, 0);

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
            <div className="rounded p-4" style={{ backgroundColor: "#2b2b2b" }}>
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
            {privileges === "all" && (
              <div className="rounded p-4" style={{ backgroundColor: "#2b2b2b" }}>
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
                <button
                  onClick={handleShowDetailedVotes}
                  className="w-full py-2 rounded font-medium mb-2"
                  style={{ backgroundColor: "#4A148C", color: "#FFF" }}
                >
                  Show Detailed Votes
                </button>
                <button
                  onClick={() => setShowResetVotesConfirm(true)}
                  className="w-full py-2 rounded font-medium mb-2"
                  style={{ backgroundColor: "#F44336", color: "#FFF" }}
                >
                  Reset Voting Results
                </button>
                {/* Optionally display the inline results */}
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
              </div>
            )}
  
            {/* Attendance management section */}
            {canModify && (
              <div className="rounded p-4" style={{ backgroundColor: "#2b2b2b" }}>
                <h3 className="text-xl font-semibold mb-4" style={{ color: "#FFD700" }}>
                  Manage Attendance
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowResetAttendanceConfirm(true)}
                    className="flex-1 px-4 py-2 rounded font-medium"
                    style={{ backgroundColor: "#F44336", color: "#FFF" }}
                  >
                    Reset Attendance
                  </button>
                  {(privileges === "all" || privileges === "valberedning") && (
                    <button
                      onClick={handleShowAttendance}
                      className="flex-1 px-4 py-2 rounded font-medium"
                      style={{ backgroundColor: "#1976D2", color: "#FFF" }}
                    >
                      Show Attendance
                    </button>
                  )}
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
                {/* New buttons for individual attendance management */}
                {(privileges === "all" || privileges === "valberedning") && (
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={handleOpenRemoveAttendancePopup}
                      className="flex-1 px-4 py-2 rounded font-medium"
                      style={{ backgroundColor: "#E64A19", color: "#FFF" }}
                    >
                      Remove Person from Attendance
                    </button>
                    <button
                      onClick={handleOpenAddAttendancePopup}
                      className="flex-1 px-4 py-2 rounded font-medium"
                      style={{ backgroundColor: "#388E3C", color: "#FFF" }}
                    >
                      Add Person to Attendance
                    </button>
                  </div>
                )}
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

          {/* Show Detailed Votes modal (white bg, black text) */}
          {showVotesModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <div
                className="bg-white p-4 rounded w-3/4 max-h-[80vh] overflow-y-auto"
                style={{ maxHeight: "80vh", color: "#000" }}
              >
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-xl font-semibold">Detailed Votes</h3>
                  <button
                    onClick={() => setShowVotesModal(false)}
                    style={{
                      backgroundColor: "#D32F2F",
                      color: "#FFF",
                      padding: "0.5rem 1rem",
                      borderRadius: "0.25rem",
                    }}
                  >
                    Close
                  </button>
                </div>
                <ul>
                  {detailedVotes.map((vote, index) => (
                    <li key={index}>
                      {vote.firstname} {vote.lastname} voted for {vote.candidate} (<em>{vote.role}</em>)
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Show Attendance modal (white bg, black text) */}
          {showAttendanceModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <div
                className="bg-white p-4 rounded w-3/4 max-h-[80vh] overflow-y-auto"
                style={{ maxHeight: "80vh", color: "#000" }}
              >
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-xl font-semibold">Attendance ({attendanceList.length} total)</h3>
                  <button
                    onClick={() => setShowAttendanceModal(false)}
                    style={{
                      backgroundColor: "#D32F2F",
                      color: "#FFF",
                      padding: "0.5rem 1rem",
                      borderRadius: "0.25rem",
                    }}
                  >
                    Close
                  </button>
                </div>
                <ul>
                  {attendanceList.map((entry, index) => (
                    <li key={index}>
                      {entry.firstname} {entry.lastname} – checked in at{" "}
                      {new Date(entry.time).toLocaleString()}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Reset Attendance confirmation modal (white bg, black text) */}
          {showResetAttendanceConfirm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <div
                className="bg-white p-4 rounded w-3/4"
                style={{ color: "#000" }}
              >
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-xl font-semibold">Confirm Reset Attendance</h3>
                  <button
                    onClick={() => setShowResetAttendanceConfirm(false)}
                    style={{
                      backgroundColor: "#D32F2F",
                      color: "#FFF",
                      padding: "0.5rem 1rem",
                      borderRadius: "0.25rem",
                    }}
                  >
                    Cancel
                  </button>
                </div>
                <p>Are you sure you want to reset the attendance data?</p>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => {
                      setShowResetAttendanceConfirm(false);
                      handleResetAttendance();
                    }}
                    style={{
                      backgroundColor: "#F44336",
                      color: "#FFF",
                      padding: "0.5rem 1rem",
                      borderRadius: "0.25rem",
                    }}
                  >
                    Yes, Reset
                  </button>
                  <button
                    onClick={() => setShowResetAttendanceConfirm(false)}
                    style={{
                      backgroundColor: "#1976D2",
                      color: "#FFF",
                      padding: "0.5rem 1rem",
                      borderRadius: "0.25rem",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Reset Voting Results confirmation modal (white bg, black text) */}
          {showResetVotesConfirm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <div
                className="bg-white p-4 rounded w-3/4"
                style={{ color: "#000" }}
              >
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-xl font-semibold">Confirm Reset Voting Results</h3>
                  <button
                    onClick={() => setShowResetVotesConfirm(false)}
                    style={{
                      backgroundColor: "#D32F2F",
                      color: "#FFF",
                      padding: "0.5rem 1rem",
                      borderRadius: "0.25rem",
                    }}
                  >
                    Cancel
                  </button>
                </div>
                <p>Are you sure you want to reset all voting data?</p>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => {
                      setShowResetVotesConfirm(false);
                      handleResetVotes();
                    }}
                    style={{
                      backgroundColor: "#F44336",
                      color: "#FFF",
                      padding: "0.5rem 1rem",
                      borderRadius: "0.25rem",
                    }}
                  >
                    Yes, Reset
                  </button>
                  <button
                    onClick={() => setShowResetVotesConfirm(false)}
                    style={{
                      backgroundColor: "#1976D2",
                      color: "#FFF",
                      padding: "0.5rem 1rem",
                      borderRadius: "0.25rem",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Remove Attendance popup (white bg, black text) */}
          {showRemoveAttendancePopup && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <div
                className="bg-white p-4 rounded w-3/4 max-h-[80vh] overflow-y-auto"
                style={{ color: "#000" }}
              >
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-xl font-semibold">Remove Person from Attendance</h3>
                  <button
                    onClick={() => setShowRemoveAttendancePopup(false)}
                    style={{
                      backgroundColor: "#D32F2F",
                      color: "#FFF",
                      padding: "0.5rem 1rem",
                      borderRadius: "0.25rem",
                    }}
                  >
                    Close
                  </button>
                </div>
                <ul>
                  {removeAttendanceList.map((item, index) => (
                    <li key={index} className="flex justify-between items-center mb-2">
                      <span>
                        {item.firstname} {item.lastname} ({item.email})
                      </span>
                      <button
                        onClick={() => handleRemoveAttendanceRow(item.email)}
                        style={{
                          backgroundColor: "#F44336",
                          color: "#FFF",
                          padding: "0.3rem 0.6rem",
                          borderRadius: "0.25rem",
                        }}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Add Attendance popup (white bg, black text) */}
          {showAddAttendancePopup && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <div
                className="bg-white p-4 rounded w-3/4"
                style={{ color: "#000" }}
              >
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-xl font-semibold">Add Person to Attendance</h3>
                  <button
                    onClick={() => setShowAddAttendancePopup(false)}
                    style={{
                      backgroundColor: "#D32F2F",
                      color: "#FFF",
                      padding: "0.5rem 1rem",
                      borderRadius: "0.25rem",
                    }}
                  >
                    Close
                  </button>
                </div>
                <div className="space-y-2">
                  <input
                    type="email"
                    placeholder="Email"
                    value={newAttendanceEmail}
                    onChange={(e) => setNewAttendanceEmail(e.target.value)}
                    className="w-full p-2 rounded border"
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={newAttendancePassword}
                    onChange={(e) => setNewAttendancePassword(e.target.value)}
                    className="w-full p-2 rounded border"
                  />
                  <input
                    type="text"
                    placeholder="Firstname"
                    value={newAttendanceFirstname}
                    onChange={(e) => setNewAttendanceFirstname(e.target.value)}
                    className="w-full p-2 rounded border"
                  />
                  <input
                    type="text"
                    placeholder="Lastname"
                    value={newAttendanceLastname}
                    onChange={(e) => setNewAttendanceLastname(e.target.value)}
                    className="w-full p-2 rounded border"
                  />
                  <button
                    onClick={handleAddAttendanceRow}
                    className="w-full py-2 rounded font-medium"
                    style={{ backgroundColor: "#388E3C", color: "#FFF" }}
                  >
                    Add Person
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Show Voting Results popup (white bg, black text) */}
          {showVotingResultsPopup && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <div
                className="bg-white p-4 rounded w-3/4 max-h-[80vh] overflow-y-auto"
                style={{ maxHeight: "80vh", color: "#000" }}
              >
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-xl font-semibold">Voting Results</h3>
                  <button
                    onClick={() => setShowVotingResultsPopup(false)}
                    style={{
                      backgroundColor: "#D32F2F",
                      color: "#FFF",
                      padding: "0.5rem 1rem",
                      borderRadius: "0.25rem",
                    }}
                  >
                    Close
                  </button>
                </div>

                {Object.keys(results).length > 0 ? (
                  <ul>
                    {Object.entries(results).map(([candidate, count]) => {
                      const percentage =
                        totalVotes > 0 ? ((count / totalVotes) * 100).toFixed(1) : "0";
                      return (
                        <li key={candidate}>
                          {candidate}: {count} vote{count > 1 ? "s" : ""} ({percentage}%)
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p>No results to display.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      {/* Alert Modal (white bg, black text) */}
      {alertInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div
            className="bg-white p-4 rounded w-3/4"
            style={{ color: "#000" }}
          >
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xl font-semibold">{alertInfo.title}</h3>
              <button
                onClick={() => setAlertInfo(null)}
                style={{
                  backgroundColor: "#D32F2F",
                  color: "#FFF",
                  padding: "0.5rem 1rem",
                  borderRadius: "0.25rem",
                }}
              >
                Ok
              </button>
            </div>
            <p>{alertInfo.message}</p>
          </div>
        </div>
      )}
    </>
  );
}
