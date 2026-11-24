"use client";
import { useState } from "react";
import { VizFrame, Seg, Btn, Stat } from "./common";

type Strategy = "naive" | "atomic" | "forupdate" | "optimistic";
interface Step { tx: "A" | "B" | "-"; sql: string; note: string; balance: number }

// Two concurrent withdrawals of 30 and 50 from a balance of 100. Correct final balance: 20.
function script(s: Strategy): Step[] {
  if (s === "naive")
    return [
      { tx: "A", sql: "BEGIN; SELECT balance FROM accounts WHERE id=1;", note: "A reads 100.", balance: 100 },
      { tx: "B", sql: "BEGIN; SELECT balance FROM accounts WHERE id=1;", note: "B also reads 100. Nothing stops it: plain reads don't block under MVCC.", balance: 100 },
      { tx: "A", sql: "UPDATE accounts SET balance = 70 WHERE id=1; COMMIT;", note: "A computed 100 − 30 in application code and writes 70.", balance: 70 },
      { tx: "B", sql: "UPDATE accounts SET balance = 50 WHERE id=1; COMMIT;", note: "B computed 100 − 50 from its stale read and overwrites A's update. A's withdrawal is lost.", balance: 50 },
    ];
  if (s === "atomic")
    return [
      { tx: "A", sql: "UPDATE accounts SET balance = balance - 30\nWHERE id=1 AND balance >= 30;", note: "The read and write happen inside one statement. A takes a row lock.", balance: 70 },
      { tx: "B", sql: "UPDATE accounts SET balance = balance - 50\nWHERE id=1 AND balance >= 50;", note: "B blocks on A's row lock…", balance: 70 },
      { tx: "A", sql: "COMMIT;", note: "A commits and releases the lock.", balance: 70 },
      { tx: "B", sql: "-- B resumes, re-evaluates against the new row: 70 - 50", note: "In READ COMMITTED, Postgres re-checks the WHERE clause on the latest row version, then applies the update. Final: 20.", balance: 20 },
    ];
  if (s === "forupdate")
    return [
      { tx: "A", sql: "BEGIN; SELECT balance FROM accounts WHERE id=1 FOR UPDATE;", note: "A reads 100 and locks the row.", balance: 100 },
      { tx: "B", sql: "BEGIN; SELECT balance FROM accounts WHERE id=1 FOR UPDATE;", note: "B wants the same lock and waits.", balance: 100 },
      { tx: "A", sql: "UPDATE accounts SET balance = 70 WHERE id=1; COMMIT;", note: "A writes 70 and commits, releasing the lock.", balance: 70 },
      { tx: "B", sql: "-- B's SELECT now returns 70\nUPDATE accounts SET balance = 20 WHERE id=1; COMMIT;", note: "B reads the committed 70, writes 20. Correct, at the cost of B waiting (pessimistic locking).", balance: 20 },
    ];
  return [
    { tx: "A", sql: "SELECT balance, version FROM accounts WHERE id=1;", note: "A reads balance 100, version 7.", balance: 100 },
    { tx: "B", sql: "SELECT balance, version FROM accounts WHERE id=1;", note: "B reads balance 100, version 7.", balance: 100 },
    { tx: "A", sql: "UPDATE accounts SET balance=70, version=8\nWHERE id=1 AND version=7;  -- 1 row", note: "A's update matches version 7 and succeeds. Version is now 8.", balance: 70 },
    { tx: "B", sql: "UPDATE accounts SET balance=50, version=8\nWHERE id=1 AND version=7;  -- 0 rows", note: "B's update matches 0 rows: someone changed the row. B must re-read and retry.", balance: 70 },
    { tx: "B", sql: "-- retry: read 70 (v8), write 20 WHERE version=8  -- 1 row", note: "B retries on fresh data. Final: 20. No locks held while thinking; conflicts cost a retry (optimistic locking).", balance: 20 },
  ];
}

export default function LostUpdate() {
  const [strategy, setStrategy] = useState<Strategy>("naive");
  const [i, setI] = useState(0);
  const steps = script(strategy);
  const shown = steps.slice(0, i);
  const balance = shown.at(-1)?.balance ?? 100;
  const done = i === steps.length;

  return (
    <VizFrame
      title="The lost update: two withdrawals at once"
      hint="Balance is 100. Transaction A withdraws 30 and B withdraws 50 at the same time. The right answer is 20. Step through each strategy."
      controls={
        <>
          <Seg label="Strategy" value={strategy} onChange={(s) => { setStrategy(s); setI(0); }} options={[{ id: "naive", label: "Read, then write" }, { id: "atomic", label: "Atomic UPDATE" }, { id: "forupdate", label: "SELECT … FOR UPDATE" }, { id: "optimistic", label: "Optimistic version" }]} />
          <div className="flex gap-2">
            <Btn onClick={() => setI(0)}>Reset</Btn>
            <Btn primary onClick={() => setI((n) => Math.min(n + 1, steps.length))} disabled={done}>Next step</Btn>
          </div>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-2">
        {steps.map((s, k) => (
          <div key={k} className={`grid grid-cols-[2.5rem_1fr] sm:grid-cols-[2.5rem_1fr_1fr] gap-3 items-start rounded-xl border p-3 transition-opacity duration-200 ${k < i ? "border-line bg-surface-2" : "border-dashed border-line opacity-35"}`} data-tone={s.tx === "A" ? "cyan" : "pink"}>
            <span className="size-8 rounded-lg bg-grad grid place-items-center text-white text-xs font-bold">{s.tx}</span>
            <pre className="!m-0 !p-0 !border-0 !bg-transparent font-mono text-[0.78rem] whitespace-pre-wrap text-heading">{s.sql}</pre>
            <p className="col-start-2 sm:col-start-3 text-muted text-[0.85rem]">{k < i ? s.note : ""}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-3 items-center">
        <Stat label="Balance in the database" value={balance} tone={done ? (balance === 20 ? "ok" : "bad") : undefined} />
        {done && <p className={`font-medium ${balance === 20 ? "text-ok" : "text-bad"}`}>{balance === 20 ? "Correct: 100 − 30 − 50 = 20." : `Wrong: ${balance}. The bank just gave away 30.`}</p>}
      </div>
    </VizFrame>
  );
}
