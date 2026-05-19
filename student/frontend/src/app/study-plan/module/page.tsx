"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback, Suspense } from "react";
// Module page — renders AI-generated day modules in the same rich Q&A + Quiz format
// as the hardcoded study plan. No coding environment for day modules.

/* ────────────────────────────────────────────────────
 *  TYPES
 * ──────────────────────────────────────────────────── */

interface Question {
  q: string;
  a: string;
  explanation?: string;
  detailedExplanation?: string;
  transitionNote?: string | null;
}

interface QuizItem {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface Section {
  title: string;
  timeMinutes: number;
  questions: Question[];
  quiz: QuizItem[];
  concepts?: string[];
}

/* ────────────────────────────────────────────────────
 *  FALLBACK HARDCODED SECTIONS
 * ──────────────────────────────────────────────────── */
const MODULE_SECTIONS: Record<string, Section[]> = {
  "Core Java fundamentals": [
    {
      title: "OOP Concepts",
      timeMinutes: 15,
      concepts: ["Encapsulation", "Abstraction", "Inheritance", "Polymorphism"],
      questions: [
        {
          q: "What are the four pillars of Object-Oriented Programming?",
          a: "Encapsulation, Abstraction, Inheritance, and Polymorphism.",
          explanation: "These four pillars form the foundation of OOP design.",
          detailedExplanation: "The Four OOP Pillars\n\nEncapsulation bundles data and methods within a class and restricts direct access to internal state. It protects data integrity and hides implementation details behind a clean interface.\n\nAbstraction hides complex implementation details and exposes only the necessary features. Abstract classes and interfaces in Java define contracts without revealing how they are fulfilled.\n\nInheritance allows a class to acquire properties and methods of another class. It promotes code reuse and establishes an IS-A relationship between classes.\n\nPolymorphism allows objects to take many forms. Method overloading (compile-time) and method overriding (runtime) are the two types. It enables writing flexible, extensible code."
        },
        {
          q: "What is the difference between an abstract class and an interface in Java?",
          a: "Abstract class: can have concrete methods, instance variables, constructors. Interface: only abstract methods (pre-Java 8), supports multiple implementation.",
          explanation: "A class can implement multiple interfaces but extend only one abstract class.",
          detailedExplanation: "Abstract Class vs Interface\n\nAn abstract class can have both abstract and concrete methods, instance variables, and constructors. It provides partial implementation and is used when classes share common state or behavior.\n\nAn interface (pre-Java 8) can only have abstract methods and constants. From Java 8+, interfaces support default and static methods. From Java 9+, private methods are also allowed.\n\nA class can implement multiple interfaces but can only extend one abstract class — this is Java's solution to the diamond problem.\n\nInterview trap: Use abstract class when you want to share code among closely related classes. Use interface when you want to define a contract that unrelated classes can implement."
        },
        {
          q: "Explain method overloading vs method overriding.",
          a: "Overloading: same name, different parameters (compile-time). Overriding: subclass redefines superclass method with same signature (runtime).",
          explanation: "Overloading is resolved at compile time; overriding is resolved at runtime via dynamic dispatch.",
          detailedExplanation: "Overloading vs Overriding\n\nMethod Overloading (compile-time polymorphism): Same method name but different parameter lists within the same class. The compiler determines which method to call based on the argument types at compile time.\n\nMethod Overriding (runtime polymorphism): A subclass provides a specific implementation of a method already defined in its superclass with the same signature. The JVM determines which method to call at runtime based on the actual object type.\n\nKey rules for overriding: same name, same parameters, same or covariant return type, cannot reduce visibility, cannot throw new checked exceptions.\n\nInterview trap: @Override annotation is optional but strongly recommended — it causes a compile error if you accidentally create an overload instead of an override."
        },
      ],
      quiz: [
        { question: "Which OOP pillar hides internal implementation details?", options: ["Inheritance", "Polymorphism", "Encapsulation", "Abstraction"], correctIndex: 3, explanation: "Abstraction hides complex implementation and exposes only necessary features. Encapsulation hides data; abstraction hides complexity." },
        { question: "A class can extend how many abstract classes in Java?", options: ["Unlimited", "Two", "One", "Zero"], correctIndex: 2, explanation: "Java supports single inheritance — a class can extend only one abstract class, but can implement multiple interfaces." },
        { question: "Method overriding is resolved at:", options: ["Compile time", "Runtime", "Link time", "Load time"], correctIndex: 1, explanation: "Method overriding uses dynamic dispatch — the JVM determines which method to call at runtime based on the actual object type." },
      ],
    },
    {
      title: "Collections Framework",
      timeMinutes: 20,
      concepts: ["List vs Set vs Map", "ArrayList vs LinkedList", "HashMap vs TreeMap"],
      questions: [
        {
          q: "What is the difference between ArrayList and LinkedList?",
          a: "ArrayList: dynamic array, O(1) random access, O(n) insert/delete. LinkedList: doubly linked list, O(n) access, O(1) insert/delete at known position.",
          explanation: "ArrayList is better for read-heavy; LinkedList for write-heavy operations.",
          detailedExplanation: "ArrayList vs LinkedList\n\nArrayList uses a dynamic array internally. It provides O(1) random access by index, making it ideal for read-heavy workloads. However, insertions and deletions in the middle require shifting elements — O(n) time.\n\nLinkedList uses a doubly linked list. Each node stores a reference to the previous and next node. Random access is O(n) since you must traverse from the head. But insertions and deletions at a known position are O(1).\n\nIn practice, ArrayList outperforms LinkedList for most use cases due to better cache locality. The JVM can prefetch contiguous memory (ArrayList) more efficiently than scattered nodes (LinkedList).\n\nInterview trap: LinkedList also implements the Deque interface, making it useful as a stack or queue. But for pure queue operations, ArrayDeque is faster than LinkedList."
        },
        {
          q: "Explain the difference between HashMap and TreeMap.",
          a: "HashMap: O(1) average, unordered, allows null key. TreeMap: O(log n), sorted by key, no null key.",
          explanation: "Use HashMap for fast lookups; TreeMap when you need sorted key order.",
          detailedExplanation: "HashMap vs TreeMap\n\nHashMap uses hashing to store key-value pairs. It provides O(1) average-case time for get, put, and remove. Keys are unordered. Allows one null key and multiple null values. Not thread-safe.\n\nTreeMap uses a Red-Black tree (self-balancing BST). All operations are O(log n). Keys are sorted in natural order or by a custom Comparator. Does not allow null keys (throws NullPointerException).\n\nLinkedHashMap is a middle ground — maintains insertion order with O(1) operations, useful for LRU cache implementations.\n\nInterview trap: HashMap's O(1) is average case. In the worst case (all keys hash to the same bucket), it degrades to O(n). Java 8+ converts buckets to balanced trees when they exceed 8 entries, improving worst case to O(log n)."
        },
      ],
      quiz: [
        { question: "Which collection maintains insertion order?", options: ["HashSet", "TreeSet", "LinkedHashMap", "HashMap"], correctIndex: 2, explanation: "LinkedHashMap maintains insertion order while providing O(1) operations." },
        { question: "TreeMap keys are:", options: ["Unordered", "Sorted by insertion", "Sorted naturally or by Comparator", "Random"], correctIndex: 2, explanation: "TreeMap sorts keys in natural order (Comparable) or by a custom Comparator provided at construction time." },
      ],
    },
  ],
  "DSA": [
    {
      title: "Arrays & Strings",
      timeMinutes: 20,
      concepts: ["Two Pointer", "Sliding Window", "Kadane's Algorithm"],
      questions: [
        {
          q: "What is the Two Pointer technique?",
          a: "Two pointers iterate from different positions to solve problems in O(n) instead of O(n²).",
          explanation: "Example: finding pair sum in sorted array. Left at start, right at end.",
          detailedExplanation: "Two Pointer Technique\n\nThe Two Pointer technique uses two references that move through a sorted array to solve problems that would otherwise require nested loops, reducing O(n²) to O(n).\n\nConverging pointers: place one at the start and one at the end. To find a pair that sums to a target: if sum is too small, move left pointer right; if too large, move right pointer left.\n\nFast-slow pointer: two pointers start at the same position but move at different speeds. Used in linked list cycle detection (Floyd's tortoise and hare) and finding the middle of a linked list.\n\nInterview trap: Two pointers only work on sorted arrays for pair-sum problems. For unsorted arrays, use a HashMap instead."
        },
      ],
      quiz: [
        { question: "Two Pointer technique works best on:", options: ["Unsorted arrays", "Sorted arrays", "Linked lists only", "Hash maps"], correctIndex: 1, explanation: "Two Pointer works most effectively on sorted arrays where pointer movement can be guided by comparison with the target." },
      ],
    },
  ],
  "Mock interviews": [
    {
      title: "Behavioral Questions",
      timeMinutes: 15,
      concepts: ["Tell Me About Yourself", "STAR Method", "Company Research"],
      questions: [
        {
          q: "Tell me about yourself.",
          a: "Structure: Present → Past → Future. 60-90 seconds, professional focus.",
          explanation: "Start with current role/studies, mention relevant experience, highlight key skills, connect to the target position.",
          detailedExplanation: "Your Professional Elevator Pitch\n\nThis is almost always the opening question. The best structure is Present → Past → Future: start with who you are now (current role, education), briefly mention relevant background (projects, internships, key achievements), and end with what you're looking for.\n\nKeep it to 60-90 seconds. Every sentence should be intentional — avoid personal details unless they directly relate to the role. Focus on your technical identity.\n\nTailor your answer to the company and role. Research the company's tech stack and mirror it in your narrative.\n\nEnd with a bridge to the role: 'I'm excited about this position because it aligns with my expertise and career goals.'"
        },
      ],
      quiz: [
        { question: "STAR stands for:", options: ["Story, Task, Action, Review", "Situation, Task, Action, Result", "Summary, Time, Action, Response", "Situation, Topic, Answer, Result"], correctIndex: 1, explanation: "STAR: Situation (context), Task (your responsibility), Action (what you did), Result (measurable outcome)." },
      ],
    },
  ],
};

/* ────────────────────────────────────────────────────
 *  HELPERS
 * ──────────────────────────────────────────────────── */

const POINT_COLORS = ["#7c3aed", "#059669", "#f59e0b", "#3b82f6", "#ef4444", "#ec4899"];

/** Parse multi-paragraph explanation into structured paragraphs */
function parseExplanationParagraphs(text: string): { heading: string; body: string }[] {
  if (!text) return [];
  const parts = text.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  return parts.map((part) => {
    const newlineIdx = part.indexOf('\n');
    if (newlineIdx === -1) {
      // Single line — check if it's "Heading: body"
      const colonIdx = part.indexOf(':');
      if (colonIdx > 0 && colonIdx < 40) {
        return { heading: part.slice(0, colonIdx).trim(), body: part.slice(colonIdx + 1).trim() };
      }
      return { heading: '', body: part };
    }
    // First line is heading, rest is body
    return { heading: part.slice(0, newlineIdx).trim(), body: part.slice(newlineIdx + 1).trim() };
  });
}

/** Generate fallback quiz from questions when AI didn't provide one */
function generateFallbackQuiz(questions: Question[]): QuizItem[] {
  return questions.slice(0, 3).map((q) => ({
    question: `Which best describes: "${q.q.slice(0, 70)}${q.q.length > 70 ? '…' : ''}"?`,
    options: [
      q.a.slice(0, 90) + (q.a.length > 90 ? '…' : ''),
      "It is not relevant to this topic.",
      "It only applies to advanced scenarios.",
      "It is the opposite of what is described.",
    ],
    correctIndex: 0,
    explanation: q.explanation || q.a,
  }));
}

import { getLatestPrep } from "@/src/lib/api";
/* ------------------ TIMER COMPONENT ------------------ */
function Timer({ totalSeconds, onExpire }: { totalSeconds: number; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(totalSeconds);

  useEffect(() => { setRemaining(totalSeconds); }, [totalSeconds]);

  useEffect(() => {
    if (remaining <= 0) { onExpire(); return; }
    const id = setInterval(() => setRemaining((r) => r - 1), 1000);
    return () => clearInterval(id);
  }, [remaining, onExpire]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const pct = (remaining / totalSeconds) * 100;
  const isLow = remaining <= 60;

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${isLow ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"} shadow-sm`}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isLow ? "#ef4444" : "#6366f1"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      <div className="flex-1 min-w-[120px]">
        <div className="flex items-center justify-between mb-1">
          <span className={`text-[13px] font-bold ${isLow ? "text-red-600" : "text-slate-700"}`}>{String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}</span>
          <span className="text-[10px] text-slate-400 font-medium">remaining</span>
        </div>
        <div className="h-1 w-full rounded-full bg-slate-100 overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-1000 ${isLow ? "bg-red-500" : "bg-indigo-500"}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

/* ------------------ QUIZ COMPONENT ------------------ */
function QuizSection({ quiz, onComplete }: { quiz: QuizItem[]; onComplete: () => void }) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const handleSelect = (qIdx: number, optIdx: number) => {
    if (submitted) return;
    setAnswers(prev => ({ ...prev, [qIdx]: optIdx }));
  };

  const allAnswered = Object.keys(answers).length === quiz.length;
  const score = quiz.filter((q, i) => answers[i] === q.correctIndex).length;

  return (
    <div className="mt-8 border-t border-slate-100 pt-8">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </div>
        <div>
          <h3 className="text-[15px] font-bold text-slate-800">Section Quiz</h3>
          <p className="text-[11px] text-slate-400">{quiz.length} questions � test your understanding</p>
        </div>
      </div>

      <div className="space-y-6">
        {quiz.map((item, qIdx) => {
          const selected = answers[qIdx];
          const isCorrect = submitted && selected === item.correctIndex;
          const isWrong = submitted && selected !== undefined && selected !== item.correctIndex;

          return (
            <div key={qIdx} className={`rounded-2xl border p-5 transition-all ${submitted && isCorrect ? "border-emerald-200 bg-emerald-50/40" : submitted && isWrong ? "border-red-200 bg-red-50/30" : "border-slate-200 bg-white"}`}>
              <p className="text-[14px] font-semibold text-slate-800 mb-4 leading-snug">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-[11px] font-bold mr-2">{qIdx + 1}</span>
                {item.question}
              </p>
              <div className="grid grid-cols-1 gap-2">
                {item.options.map((opt, oIdx) => {
                  const isSelected = selected === oIdx;
                  const isCorrectOpt = item.correctIndex === oIdx;
                  let cls = "px-4 py-3 rounded-xl border text-[13px] font-medium cursor-pointer transition-all text-left ";
                  if (!submitted) {
                    cls += isSelected
                      ? "border-violet-400 bg-violet-50 text-violet-800 shadow-sm"
                      : "border-slate-200 bg-white text-slate-700 hover:border-violet-200 hover:bg-violet-50/30";
                  } else {
                    if (isCorrectOpt) cls += "border-emerald-400 bg-emerald-50 text-emerald-800 font-bold";
                    else if (isSelected && !isCorrectOpt) cls += "border-red-300 bg-red-50 text-red-700 line-through";
                    else cls += "border-slate-100 bg-slate-50 text-slate-400";
                  }
                  return (
                    <button key={oIdx} className={cls} onClick={() => handleSelect(qIdx, oIdx)}>
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-current text-[10px] font-bold mr-2 shrink-0">
                        {String.fromCharCode(65 + oIdx)}
                      </span>
                      {opt}
                    </button>
                  );
                })}
              </div>
              {submitted && (
                <div className="mt-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">Explanation</p>
                  <p className="text-[13px] text-slate-600 leading-relaxed">{item.explanation}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!submitted ? (
        <button
          onClick={() => setSubmitted(true)}
          disabled={!allAnswered}
          className={`mt-6 w-full py-3 rounded-xl font-bold text-[14px] transition-all ${allAnswered ? "bg-violet-600 text-white hover:bg-violet-700 shadow-lg shadow-violet-200" : "bg-slate-100 text-slate-300 cursor-not-allowed"}`}
        >
          Submit Quiz
        </button>
      ) : (
        <div className="mt-6 p-5 rounded-2xl bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-100 flex items-center justify-between">
          <div>
            <p className="text-[13px] font-bold text-slate-700">
              Score: <span className={score === quiz.length ? "text-emerald-600" : score >= quiz.length / 2 ? "text-amber-600" : "text-red-600"}>{score}/{quiz.length}</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {score === quiz.length ? "Perfect! All correct." : score >= quiz.length / 2 ? "Good job! Review the explanations above." : "Review the section and try again."}
            </p>
          </div>
          <button
            onClick={onComplete}
            className="px-6 py-2.5 rounded-xl bg-slate-900 text-white text-[13px] font-bold hover:bg-slate-800 transition shadow-sm"
          >
            Continue ?
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------ MAIN MODULE CONTENT ------------------ */
function ModuleContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const moduleTitle = searchParams.get("title") || "Learning Module";
  const company = searchParams.get("company") || "Your Target Company";
  const dayNum = searchParams.get("day");

  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0);
  const [revealedAnswers, setRevealedAnswers] = useState<Record<number, boolean>>({});
  const [completedSections, setCompletedSections] = useState<boolean[]>([]);
  const [timerExpired, setTimerExpired] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const [quizDone, setQuizDone] = useState(false);

  useEffect(() => {
    async function loadDynamicContent() {
      try {
        if (!dayNum) {
          // Fallback to hardcoded if no day param (legacy support)
          const fallback = MODULE_SECTIONS[moduleTitle] || MODULE_SECTIONS["Core Java fundamentals"];
          setSections(fallback);
          setCompletedSections(new Array(fallback.length).fill(false));
          setLoading(false);
          return;
        }

        const studentId = parseInt(sessionStorage.getItem("student_id") || "0");
        const targetId = parseInt(sessionStorage.getItem("target_id") || "0");

        if (!studentId || !targetId) throw new Error("Session context missing");

        const plan = await getLatestPrep(studentId, targetId);
        const dayData = plan.plan_json.daily_plan?.find((d: any) => d.day === parseInt(dayNum));

        if (dayData) {
          // Map every task (regardless of task_type) to a Q&A section
          // Code tasks are shown as Q&A using their qa_pairs, NOT as a coding editor
          const dynamicSections: Section[] = dayData.tasks.map((task: any) => {
            // Build questions from qa_pairs
            const questions: Question[] = [];
            if (task.qa_pairs && task.qa_pairs.length > 0) {
              task.qa_pairs.forEach((qa: any) => {
                const rawExp = qa.explanation || qa.answer || task.description || "";
                const richExp = rawExp.includes('\n\n') ? rawExp : `${task.title}\n\n${rawExp}`;
                questions.push({
                  q: qa.question,
                  a: qa.answer,
                  explanation: rawExp,
                  detailedExplanation: richExp,
                  transitionNote: qa.transition_note || null,
                });
              });
            } else {
              // Fallback: use task title/description as a single Q&A card
              questions.push({
                q: task.title,
                a: task.description,
                explanation: task.description,
                detailedExplanation: `${task.title}\n\n${task.description}`,
              });
            }

            // Build quiz from task.quiz
            const quiz: QuizItem[] = [];
            if (task.quiz && task.quiz.length > 0) {
              task.quiz.forEach((qz: any) => {
                quiz.push({
                  question: qz.question,
                  options: qz.options || [],
                  correctIndex: qz.correct_index ?? qz.correctIndex ?? 0,
                  explanation: qz.explanation || "See the section for details.",
                });
              });
            } else {
              // Generate fallback quiz from questions
              const fallback = generateFallbackQuiz(questions);
              quiz.push(...fallback);
            }

            // Concepts from qa_pairs questions (first 5)
            const concepts = task.qa_pairs && task.qa_pairs.length > 0
              ? task.qa_pairs.slice(0, 5).map((qa: any) => qa.question.slice(0, 45) + (qa.question.length > 45 ? '�' : ''))
              : [task.title];

            return {
              title: task.title,
              timeMinutes: task.duration_minutes || 20,
              questions,
              quiz,
              concepts,
            };
          });

          setSections(dynamicSections);
          setCompletedSections(new Array(dynamicSections.length).fill(false));
        } else {
          setSections([]);
        }
      } catch (err) {
        console.error("Module load error:", err);
        // Fallback to hardcoded
        const fallback = MODULE_SECTIONS[moduleTitle] || MODULE_SECTIONS["Core Java fundamentals"];
        setSections(fallback);
        setCompletedSections(new Array(fallback.length).fill(false));
      } finally {
        setLoading(false);
      }
    }
    loadDynamicContent();
  }, [dayNum, moduleTitle]);

  const currentSection = sections[currentSectionIdx];
  const totalQuestions = currentSection?.questions.length || 0;
  const answeredCount = Object.keys(revealedAnswers).length;
  const allRevealed = answeredCount >= totalQuestions && totalQuestions > 0;

  const toggleAnswer = (idx: number) => {
    setRevealedAnswers((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleTimerExpire = useCallback(() => { setTimerExpired(true); }, []);

  const handleCompleteSection = () => {
    const updated = [...completedSections];
    updated[currentSectionIdx] = true;
    setCompletedSections(updated);
    if (currentSectionIdx < sections.length - 1) {
      setCurrentSectionIdx(currentSectionIdx + 1);
      setRevealedAnswers({});
      setTimerExpired(false);
      setQuizDone(false);
    } else {
      setAllDone(true);
    }
  };

  const handleGoToSection = (idx: number) => {
    if (idx <= currentSectionIdx || completedSections[idx]) {
      setCurrentSectionIdx(idx);
      setRevealedAnswers({});
      setTimerExpired(false);
      setQuizDone(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 font-medium animate-pulse">Loading module content...</p>
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-bold text-slate-800 mb-2">Module Not Found</h2>
        <p className="text-slate-500 mb-6">We couldn't load the content for this module.</p>
        <button onClick={() => router.push("/study-plan")} className="px-6 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition">Return to Roadmap</button>
      </div>
    );
  }

  if (allDone) {
    return (
      <div className="w-full max-w-4xl mx-auto py-10">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-100 mx-auto flex items-center justify-center mb-6">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7"/></svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Module Complete!</h2>
          <p className="text-slate-500 text-[15px] mb-2">You've finished all {sections.length} sections in <strong>{moduleTitle}</strong>.</p>
          <p className="text-slate-400 text-sm mb-8">Great work! Keep preparing for your interview.</p>
          <button onClick={() => router.push("/study-plan")} className="px-8 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 text-[15px]">
            Back to Study Plan
          </button>
        </div>
      </div>
    );
  }

  const paragraphs = parseExplanationParagraphs(
    currentSection?.questions[0]?.detailedExplanation || ""
  );

  return (
    <div className="w-full max-w-5xl mx-auto py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/study-plan")} className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition" title="Back">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800">{moduleTitle}</h1>
            <p className="text-[12px] text-slate-400">{company} � Preparation Module</p>
          </div>
        </div>
        <Timer totalSeconds={(currentSection?.timeMinutes || 20) * 60} onExpire={handleTimerExpire} />
      </div>

      {/* Section Navigation Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {sections.map((sec, idx) => {
          const isActive = idx === currentSectionIdx;
          const isDone = completedSections[idx];
          const isLocked = idx > currentSectionIdx && !completedSections[idx];
          return (
            <button
              key={idx}
              onClick={() => handleGoToSection(idx)}
              disabled={isLocked}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold whitespace-nowrap transition-all border
                ${isActive ? "bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm" : ""}
                ${isDone && !isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : ""}
                ${isLocked ? "bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed" : ""}
                ${!isActive && !isDone && !isLocked ? "bg-white text-slate-500 border-slate-200 hover:border-slate-300" : ""}
              `}
            >
              {isDone ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7"/></svg>
              ) : (
                <span className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold ${isActive ? "bg-indigo-500 text-white" : "bg-slate-200 text-slate-500"}`}>{idx + 1}</span>
              )}
              {sec.title}
              <span className={`text-[10px] font-normal ${isActive ? "text-indigo-400" : "text-slate-300"}`}>{sec.timeMinutes}m</span>
            </button>
          );
        })}
      </div>

      {/* Timer Expired Banner */}
      {timerExpired && (
        <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-center gap-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p className="text-[13px] text-amber-800 font-medium">Time's up! You can still review the answers and complete the section.</p>
        </div>
      )}

      {/* Progress */}
      <div className="flex items-center justify-between mb-4 px-1">
        <p className="text-[12px] text-slate-400 font-medium">
          Section {currentSectionIdx + 1} of {sections.length} � <strong className="text-slate-600">{currentSection.title}</strong>
        </p>
        <p className="text-[12px] text-slate-400">
          <span className="text-indigo-500 font-bold">{answeredCount}</span> / {totalQuestions} answers revealed
        </p>
      </div>

      {/* Concepts chips */}
      {currentSection.concepts && currentSection.concepts.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {currentSection.concepts.map((c, i) => (
            <span key={i} className="px-3 py-1 rounded-full text-[11px] font-bold border border-violet-100 bg-violet-50 text-violet-700">
              {c}
            </span>
          ))}
        </div>
      )}

      {/* Q&A Cards */}
      <div className="space-y-4 mb-6">
        {currentSection.questions.map((item, idx) => {
          const isRevealed = revealedAnswers[idx];
          const expParagraphs = parseExplanationParagraphs(item.detailedExplanation || item.explanation || "");

          return (
            <div key={idx} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:shadow-md">
              {/* Question row */}
              <div className="flex items-start gap-4 px-5 py-4">
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-violet-100 text-violet-700 text-[12px] font-bold shrink-0 mt-0.5">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <p className="text-[14px] font-semibold text-slate-800 leading-snug">{item.q}</p>
                </div>
                <button
                  onClick={() => toggleAnswer(idx)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${
                    isRevealed
                      ? "bg-violet-50 text-violet-600 border-violet-200"
                      : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-violet-50 hover:text-violet-600 hover:border-violet-200"
                  }`}
                >
                  {isRevealed ? "Hide" : "Reveal Answer"}
                </button>
              </div>

              {/* Answer + Explanation */}
              {isRevealed && (
                <div className="px-5 pb-5 pt-0 ml-11 space-y-3">
                  {/* Direct answer */}
                  <div className="bg-gradient-to-r from-indigo-50/80 to-slate-50 rounded-xl px-4 py-3 border border-indigo-100/60">
                    <p className="text-[11px] font-bold text-indigo-500 uppercase tracking-widest mb-1">Answer</p>
                    <p className="text-[13px] text-slate-700 leading-relaxed">{item.a}</p>
                  </div>

                  {/* Detailed explanation paragraphs */}
                  {expParagraphs.length > 0 && (
                    <div className="bg-emerald-50/30 rounded-xl px-4 py-4 border border-emerald-100/50 space-y-3">
                      <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Detailed Explanation</p>
                      {expParagraphs.map((para, pIdx) => (
                        <div key={pIdx} className="flex gap-3">
                          <div
                            className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                            style={{ backgroundColor: POINT_COLORS[pIdx % POINT_COLORS.length] }}
                          />
                          <div>
                            {para.heading && (
                              <p className="text-[12px] font-bold text-slate-700 mb-0.5">{para.heading}</p>
                            )}
                            <p className="text-[13px] text-slate-600 leading-relaxed">{para.body}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Transition note (language bridging) */}
                  {item.transitionNote && (
                    <div className="bg-amber-50/40 rounded-xl px-4 py-3 border border-amber-100/50">
                      <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0018 8 6 6 0 006 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 019 14"/></svg>
                        Transition Note
                      </p>
                      <p className="text-[13px] text-slate-700 font-medium italic leading-relaxed">{item.transitionNote}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Quiz � shown after all answers revealed */}
      {allRevealed && !quizDone && currentSection.quiz && currentSection.quiz.length > 0 && (
        <QuizSection
          quiz={currentSection.quiz}
          onComplete={() => {
            setQuizDone(true);
            handleCompleteSection();
          }}
        />
      )}

      {/* Complete button � shown when no quiz or quiz done */}
      {(!allRevealed || (allRevealed && (!currentSection.quiz || currentSection.quiz.length === 0))) && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-[11px] text-slate-400">
            {allRevealed ? "? All answers revealed � complete the section" : `Reveal all ${totalQuestions} answers to unlock the quiz`}
          </p>
          <button
            onClick={handleCompleteSection}
            disabled={!allRevealed}
            className={`px-6 py-3 rounded-xl font-bold text-[14px] transition-all ${
              allRevealed
                ? "bg-slate-900 text-white hover:bg-slate-800 shadow-sm"
                : "bg-slate-100 text-slate-300 border border-slate-200 cursor-not-allowed"
            }`}
          >
            {currentSectionIdx < sections.length - 1 ? "Complete & Next Section ?" : "Finish Module ?"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function ModulePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading module...</div>}>
      <ModuleContent />
    </Suspense>
  );
}
