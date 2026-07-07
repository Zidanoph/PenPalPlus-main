import { useEffect, useState, useCallback } from "react";
import { api } from "../api.js";
import LetterCard from "../components/LetterCard.jsx";
import { Spinner, Empty, Banner } from "../components/ui.jsx";

export default function Inbox() {
  const [box, setBox] = useState("inbox");
  const [letters, setLetters] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async (which) => {
    setLetters(null);
    setError("");
    try {
      const data = await api.get(which === "sent" ? "/letters/sent" : "/letters/inbox");
      setLetters(data);
    } catch {
      setError("We couldn't reach the mailbox. Check that the API is running.");
      setLetters([]);
    }
  }, []);

  useEffect(() => {
    load(box);
  }, [box, load]);

  const inTransit = (letters || []).filter((l) => l.state === "in_transit").length;

  return (
    <div>
      <div className="between" style={{ marginBottom: 18, alignItems: "flex-end" }}>
        <div>
          <div className="eyebrow">Correspondence</div>
          <h1 className="mb0">Your mailbox</h1>
        </div>
        <div className="row gap6" role="tablist" aria-label="Mailbox folders">
          {[
            ["inbox", "Received"],
            ["sent", "Sent"],
          ].map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={box === key}
              className={`btn btn-sm ${box === key ? "" : "btn-ghost"}`}
              onClick={() => setBox(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <Banner kind="err">{error}</Banner>

      {box === "sent" && inTransit > 0 ? (
        <p className="mono" style={{ fontSize: "0.8rem", color: "var(--sepia)", marginTop: -4 }}>
          ✈ {inTransit} {inTransit === 1 ? "letter is" : "letters are"} still in transit.
        </p>
      ) : null}

      {letters === null ? (
        <Spinner label="Sorting the mail" />
      ) : letters.length === 0 ? (
        <Empty
          icon={box === "sent" ? "🪶" : "📭"}
          title={box === "sent" ? "Nothing sent yet" : "Your mailbox is empty"}
        >
          {box === "sent"
            ? "Letters you write will appear here while they travel."
            : "When a pen pal writes to you, their letter will arrive here once it lands."}
        </Empty>
      ) : (
        <div className="grid" style={{ gap: 14 }}>
          {letters.map((l) => (
            <LetterCard key={l.id} letter={l} box={box} />
          ))}
        </div>
      )}
    </div>
  );
}
