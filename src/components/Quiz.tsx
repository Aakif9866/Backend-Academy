"use client";
import { useState } from "react";
import { Check, X, RotateCcw, Trophy } from "lucide-react";
import type { Question } from "@/lib/content";
import { progress, useProgress } from "@/lib/progress";

const TYPE_LABEL = { mcq: "Multiple choice", tf: "True / false", scenario: "Scenario", code: "Code reading" };

export function Quiz({ slug, questions }: { slug: string; questions: Question[] }) {
  const [picked, setPicked] = useState<(number | null)[]>(() => questions.map(() => null));
  const [submitted, setSubmitted] = useState(false);
  const { quiz, ready } = useProgress();
  const prev = ready ? quiz[slug] : undefined;

  const answered = picked.filter((p) => p !== null).length;
  const score = picked.filter((p, i) => p === questions[i].answer).length;

  const submit = () => {
    setSubmitted(true);
    progress.saveQuiz(slug, score, questions.length);
    if (score === questions.length) progress.markComplete(slug);
  };
  const retry = () => {
    setPicked(questions.map(() => null));
    setSubmitted(false);
  };

  return (
    <div className="space-y-5">
      {prev && !submitted && (
        <p className="text-sm text-muted">
          Last attempt: <span className="text-heading font-medium tabular-nums">{prev.score}/{prev.total}</span> · best{" "}
          <span className="tabular-nums">{prev.best}/{prev.total}</span>
        </p>
      )}
      {questions.map((q, qi) => {
        const choice = picked[qi];
        return (
          <fieldset key={qi} className="min-w-0 border border-line bg-surface corner p-5 lg:p-6">
            <legend className="sr-only">Question {qi + 1}</legend>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-tone">{TYPE_LABEL[q.type]}</span>
              <span className="text-[11px] text-muted tabular-nums">· {qi + 1} of {questions.length}</span>
            </div>
            <p className="text-heading font-medium leading-relaxed whitespace-pre-line">{q.q}</p>
            {q.code && (
              <pre className="mt-4 font-mono text-[0.84rem] leading-relaxed bg-[var(--code-bg)] border border-line rounded-xl p-4 overflow-x-auto">
                <code>{q.code}</code>
              </pre>
            )}
            <div className="mt-4 grid grid-cols-1 gap-2">
              {q.options.map((opt, oi) => {
                const isPicked = choice === oi;
                const isRight = oi === q.answer;
                let cls = "border-line hover:border-line-strong hover:bg-surface-2";
                if (!submitted && isPicked) cls = "border-[var(--c)] bg-tone-soft";
                if (submitted && isRight) cls = "border-ok bg-[color-mix(in_srgb,var(--ok)_10%,transparent)]";
                if (submitted && isPicked && !isRight) cls = "border-bad bg-[color-mix(in_srgb,var(--bad)_10%,transparent)]";
                return (
                  <label
                    key={oi}
                    className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-[0.95rem] leading-relaxed transition-colors duration-150 ${cls} ${submitted ? "" : "cursor-pointer"}`}
                  >
                    <input
                      type="radio"
                      name={`${slug}-q${qi}`}
                      className="mt-1.5 accent-[var(--c)]"
                      checked={isPicked}
                      disabled={submitted}
                      onChange={() => setPicked((p) => p.map((x, i) => (i === qi ? oi : x)))}
                    />
                    <span className="flex-1">{opt}</span>
                    {submitted && isRight && <Check size={18} className="text-ok mt-0.5 shrink-0" aria-label="Correct answer" />}
                    {submitted && isPicked && !isRight && <X size={18} className="text-bad mt-0.5 shrink-0" aria-label="Your answer, incorrect" />}
                  </label>
                );
              })}
            </div>
            {submitted && (
              <div className="mt-4 text-sm leading-relaxed border-l-2 border-[var(--c)] pl-4 text-ink">
                <span className={`font-semibold ${choice === q.answer ? "text-ok" : "text-bad"}`}>
                  {choice === q.answer ? "Correct. " : choice === null ? "Not answered. " : "Not quite. "}
                </span>
                {q.explain}
              </div>
            )}
          </fieldset>
        );
      })}

      <div className="flex flex-wrap items-center gap-4">
        {!submitted ? (
          <button
            onClick={submit}
            disabled={answered === 0}
            className="px-6 py-3 corner-sm bg-grad text-white font-medium active:scale-95 transition duration-150 disabled:opacity-40 disabled:active:scale-100"
          >
            Check answers ({answered}/{questions.length})
          </button>
        ) : (
          <>
            <div className="flex items-center gap-3 px-5 py-3 corner-sm border border-[var(--c)] bg-tone-soft">
              <Trophy size={18} className="text-tone" />
              <span className="text-heading font-semibold tabular-nums">
                {score}/{questions.length}
              </span>
              <span className="text-sm text-muted">{score === questions.length ? "Perfect, lesson marked complete." : "Review the explanations above."}</span>
            </div>
            <button onClick={retry} className="inline-flex items-center gap-2 px-4 py-3 text-sm text-muted hover:text-heading">
              <RotateCcw size={16} /> Try again
            </button>
          </>
        )}
      </div>
    </div>
  );
}
