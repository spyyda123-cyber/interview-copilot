"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback, Suspense } from "react";

/* ────────────────────────────────────────────────────
 *  SECTION-WISE Q & A DATA
 *  Each module has multiple sections, each with questions.
 * ──────────────────────────────────────────────────── */

interface Question {
  q: string;
  a: string;
}

interface Section {
  title: string;
  timeMinutes: number;
  questions: Question[];
}

const MODULE_SECTIONS: Record<string, Section[]> = {
  "Core Java fundamentals": [
    {
      title: "OOP Concepts",
      timeMinutes: 15,
      questions: [
        { q: "What are the four pillars of Object-Oriented Programming?", a: "The four pillars are: 1) Encapsulation — bundling data and methods that operate on the data within a class, restricting direct access. 2) Abstraction — hiding complex implementation details and showing only the necessary features. 3) Inheritance — a mechanism where one class acquires the properties of another. 4) Polymorphism — the ability of an object to take many forms (method overloading and overriding)." },
        { q: "What is the difference between an abstract class and an interface in Java?", a: "An abstract class can have both abstract and concrete methods, instance variables, constructors, and can provide partial implementation. An interface (pre-Java 8) can only have abstract methods and constants. From Java 8+, interfaces support default and static methods. A class can implement multiple interfaces but can only extend one abstract class." },
        { q: "Explain method overloading vs method overriding.", a: "Method Overloading (compile-time polymorphism): Same method name but different parameter lists within the same class. Method Overriding (runtime polymorphism): A subclass provides a specific implementation of a method already defined in its superclass with the same signature." },
        { q: "What is the significance of the 'final' keyword in Java?", a: "final variable: Value cannot be changed once initialized. final method: Cannot be overridden by subclasses. final class: Cannot be extended/inherited." },
        { q: "What is the difference between '==' and '.equals()' in Java?", a: "'==' compares reference (memory address) — checks if two variables point to the same object. '.equals()' compares value/content — checks if two objects are logically equivalent. For String, .equals() compares character content; == checks if they reference the same String object in memory." },
      ],
    },
    {
      title: "Collections Framework",
      timeMinutes: 20,
      questions: [
        { q: "What is the Java Collections Framework? Name the main interfaces.", a: "The Collections Framework is a unified architecture for representing and manipulating collections. Main interfaces: Collection (root), List (ordered, allows duplicates), Set (no duplicates), Queue (FIFO), Map (key-value pairs), Deque (double-ended queue)." },
        { q: "What is the difference between ArrayList and LinkedList?", a: "ArrayList uses a dynamic array internally — O(1) random access, O(n) insertions/deletions in the middle. LinkedList uses a doubly linked list — O(n) random access, O(1) insertions/deletions when you have a reference to the node. ArrayList is better for read-heavy, LinkedList for write-heavy operations." },
        { q: "Explain the difference between HashMap and TreeMap.", a: "HashMap: Uses hashing, O(1) average lookup/insert, unordered, allows one null key. TreeMap: Uses Red-Black tree, O(log n) operations, keys are sorted in natural order (or custom Comparator), does not allow null keys." },
        { q: "What is the difference between HashSet and TreeSet?", a: "HashSet: Uses HashMap internally, O(1) operations, unordered, allows one null element. TreeSet: Uses TreeMap internally, O(log n) operations, elements sorted in natural order, does not allow null." },
        { q: "What is a ConcurrentHashMap and when would you use it?", a: "ConcurrentHashMap is a thread-safe version of HashMap. Unlike Hashtable, it divides the map into segments and only locks the segment being modified, allowing concurrent reads and writes. Use it in multi-threaded environments where you need high read/write throughput." },
        { q: "What is the difference between Iterator and ListIterator?", a: "Iterator: Can traverse a collection in forward direction only, supports remove(). ListIterator: Can traverse a List in both directions (forward and backward), supports add(), set(), and remove(), and provides index-based access." },
      ],
    },
    {
      title: "Streams & Lambdas",
      timeMinutes: 15,
      questions: [
        { q: "What are Java Streams and how are they different from Collections?", a: "Streams represent a sequence of elements that support sequential and parallel operations. Unlike Collections, Streams don't store data — they process data from a source. Streams are lazy (intermediate operations are deferred), can be parallelized easily, and are consumed only once." },
        { q: "What is a lambda expression in Java?", a: "A lambda expression is an anonymous function that implements a functional interface. Syntax: (parameters) -> expression or (parameters) -> { statements }. Example: (a, b) -> a + b. They enable functional programming, reduce boilerplate, and are commonly used with Streams API." },
        { q: "Explain the difference between map() and flatMap() in Streams.", a: "map(): Transforms each element to exactly one output element — one-to-one mapping. flatMap(): Transforms each element to zero or more elements and flattens the result into a single stream — one-to-many mapping followed by flattening. Example: map to convert Stream<String> to Stream<Integer> (lengths), flatMap to convert Stream<List<String>> to Stream<String>." },
        { q: "What are the terminal operations in Java Streams?", a: "Terminal operations trigger stream processing and produce a result or side-effect. Common ones: collect() — accumulate into a collection, forEach() — iterate, reduce() — combine elements, count() — count elements, findFirst()/findAny() — find elements, allMatch()/anyMatch()/noneMatch() — boolean checks, min()/max() — extremes, toArray() — convert to array." },
        { q: "What is Optional in Java and why is it used?", a: "Optional<T> is a container that may or may not hold a non-null value. It's used to avoid NullPointerException and make APIs clearer about nullable return values. Key methods: of(), ofNullable(), isPresent(), ifPresent(), orElse(), orElseGet(), orElseThrow(), map(), flatMap()." },
      ],
    },
  ],
  "Spring Boot + microservices": [
    {
      title: "Spring Boot Basics",
      timeMinutes: 15,
      questions: [
        { q: "What is Spring Boot and how does it differ from Spring Framework?", a: "Spring Boot is an opinionated framework that simplifies Spring application development. Key differences: Auto-configuration (convention over configuration), embedded server (Tomcat/Jetty), starter dependencies, no XML configuration needed, Spring Boot Actuator for production monitoring." },
        { q: "What are Spring Boot Starters?", a: "Starters are curated dependency descriptors. spring-boot-starter-web includes everything for web apps (Spring MVC, Tomcat, Jackson). spring-boot-starter-data-jpa includes JPA, Hibernate, Spring Data JPA. They simplify Maven/Gradle configuration by bundling compatible versions." },
        { q: "Explain the @SpringBootApplication annotation.", a: "@SpringBootApplication combines three annotations: @Configuration — marks the class as a source of bean definitions. @EnableAutoConfiguration — tells Spring Boot to auto-configure based on classpath. @ComponentScan — enables component scanning in the current package and sub-packages." },
        { q: "What is Spring Boot Actuator?", a: "Actuator provides production-ready features: /health — application health status, /info — application info, /metrics — application metrics, /env — environment properties, /loggers — logger configuration. It enables monitoring and management of Spring Boot apps." },
      ],
    },
    {
      title: "REST API Development",
      timeMinutes: 15,
      questions: [
        { q: "What are the main HTTP methods used in RESTful APIs?", a: "GET — retrieve data, POST — create new resources, PUT — update/replace entire resource, PATCH — partially update resource, DELETE — remove resource. Each method should be idempotent (except POST) and follow REST conventions." },
        { q: "What is the difference between @Controller and @RestController?", a: "@Controller returns view names (for MVC/template rendering). @RestController = @Controller + @ResponseBody — every method returns data directly in the response body (JSON/XML). Use @RestController for REST APIs, @Controller for server-side rendered pages." },
        { q: "Explain @RequestMapping, @GetMapping, @PostMapping annotations.", a: "@RequestMapping is the parent annotation for mapping HTTP requests. @GetMapping = @RequestMapping(method = GET), @PostMapping = @RequestMapping(method = POST). They simplify code and make intent clearer. Can include path, params, headers, consumes, produces attributes." },
        { q: "How do you handle exceptions globally in Spring Boot?", a: "Use @ControllerAdvice + @ExceptionHandler for global exception handling. Create a class annotated with @ControllerAdvice containing methods annotated with @ExceptionHandler(SpecificException.class). Return ResponseEntity with appropriate HTTP status codes and error messages." },
      ],
    },
    {
      title: "JPA & Docker",
      timeMinutes: 15,
      questions: [
        { q: "What is JPA and how does Spring Data JPA simplify it?", a: "JPA (Java Persistence API) is a specification for ORM (Object-Relational Mapping). Spring Data JPA provides: Repository pattern (CrudRepository, JpaRepository), automatic query generation from method names, @Query for custom queries, pagination and sorting support." },
        { q: "What are the main JPA annotations?", a: "@Entity — marks a class as a JPA entity. @Table — specifies the database table. @Id — marks the primary key. @GeneratedValue — auto-generation strategy. @Column — column mapping. @OneToMany, @ManyToOne, @ManyToMany — relationship mappings. @JoinColumn — foreign key column." },
        { q: "What is Docker and how is it used in microservices?", a: "Docker is a containerization platform. Dockerfile defines the build steps. Docker images are immutable templates. Containers are running instances. docker-compose manages multi-container apps. Benefits: consistent environments, isolated services, scalable deployments, easy CI/CD." },
        { q: "What is the difference between Docker image and container?", a: "Image: Read-only template with application code, runtime, libraries. Created from Dockerfile. Immutable and shareable. Container: Running instance of an image. Has a writable layer. Isolated process with its own filesystem, network, and process space. Multiple containers can run from the same image." },
      ],
    },
  ],
  "DSA": [
    {
      title: "Arrays & Strings",
      timeMinutes: 20,
      questions: [
        { q: "How do you find the maximum subarray sum? (Kadane's Algorithm)", a: "Kadane's Algorithm: Initialize maxSoFar = arr[0], maxEndingHere = arr[0]. Traverse from index 1: maxEndingHere = max(arr[i], maxEndingHere + arr[i]), maxSoFar = max(maxSoFar, maxEndingHere). Time: O(n), Space: O(1)." },
        { q: "How do you detect duplicate elements in an array?", a: "Multiple approaches: 1) HashSet — add elements, check if already exists, O(n) time, O(n) space. 2) Sort first — adjacent duplicates, O(n log n) time, O(1) space. 3) For range [0, n-1], use array as hashmap with index marking." },
        { q: "How do you reverse a string in-place?", a: "Two-pointer approach: left = 0, right = length - 1. Swap characters at left and right, increment left, decrement right. Continue until left >= right. Time: O(n), Space: O(1)." },
        { q: "What is the Two Pointer technique? Give an example.", a: "Two pointers iterate from different positions to solve problems efficiently. Example: Finding a pair with given sum in a sorted array — left pointer starts at 0, right at end. If sum < target, move left right. If sum > target, move right left. O(n) time vs O(n²) brute force." },
      ],
    },
    {
      title: "Trees & Graphs",
      timeMinutes: 20,
      questions: [
        { q: "What are the different tree traversal methods?", a: "Inorder (Left, Root, Right) — gives sorted order for BST. Preorder (Root, Left, Right) — used for copying trees. Postorder (Left, Right, Root) — used for deletion. Level-order (BFS) — uses a queue, visits level by level." },
        { q: "What is a Binary Search Tree (BST)? What are its properties?", a: "BST is a binary tree where: Left subtree contains only nodes with keys less than the node's key. Right subtree contains only nodes with keys greater than the node's key. Both subtrees are also BSTs. Operations: Search, Insert, Delete — all O(h) where h = height. Balanced BST: O(log n)." },
        { q: "Explain BFS and DFS for graph traversal.", a: "BFS (Breadth-First Search): Uses queue, explores neighbors first, finds shortest path in unweighted graphs. O(V+E). DFS (Depth-First Search): Uses stack/recursion, explores as deep as possible first, used for cycle detection, topological sort. O(V+E)." },
        { q: "What is a balanced binary tree? Name some types.", a: "A balanced tree ensures height is O(log n). Types: AVL Tree — strictly balanced (height difference ≤ 1 for every node). Red-Black Tree — loosely balanced with color properties. B-Tree — used in databases, multiple keys per node. Splay Tree — self-adjusting with amortized O(log n)." },
      ],
    },
    {
      title: "Dynamic Programming",
      timeMinutes: 20,
      questions: [
        { q: "What is Dynamic Programming? When should you use it?", a: "DP is an optimization technique for problems with: 1) Overlapping subproblems — same subproblem solved multiple times. 2) Optimal substructure — optimal solution built from optimal sub-solutions. Approaches: Top-down (memoization with recursion) or Bottom-up (tabulation with iteration)." },
        { q: "Explain the Fibonacci sequence using DP.", a: "Naive recursion: O(2^n). Memoization (top-down): Store results in array, fib(n) = fib(n-1) + fib(n-2), O(n) time, O(n) space. Tabulation (bottom-up): Build array from 0 to n, dp[i] = dp[i-1] + dp[i-2], O(n) time, O(n) space. Space-optimized: Only keep last two values, O(1) space." },
        { q: "What is the 0/1 Knapsack problem?", a: "Given n items with weights and values, maximize total value in a knapsack of capacity W. Each item can be taken or left (0/1). DP solution: dp[i][w] = max(dp[i-1][w], dp[i-1][w-wt[i]] + val[i]). Time: O(n×W), Space: O(n×W) or O(W) optimized." },
        { q: "Explain the Longest Common Subsequence (LCS) problem.", a: "Find the longest subsequence common to two strings. DP approach: If chars match (s1[i] == s2[j]): dp[i][j] = 1 + dp[i-1][j-1]. If not: dp[i][j] = max(dp[i-1][j], dp[i][j-1]). Time: O(m×n), Space: O(m×n). Backtrack to find the actual LCS string." },
      ],
    },
  ],
  "SQL + database design": [
    {
      title: "SQL Queries",
      timeMinutes: 20,
      questions: [
        { q: "What is the difference between INNER JOIN and OUTER JOIN?", a: "INNER JOIN returns only matching rows from both tables. LEFT OUTER JOIN: All rows from left + matching from right (NULL for non-matches). RIGHT OUTER JOIN: All rows from right + matching from left. FULL OUTER JOIN: All rows from both, NULLs where no match." },
        { q: "What is the difference between WHERE and HAVING?", a: "WHERE filters individual rows before grouping (cannot use aggregate functions). HAVING filters groups after GROUP BY (can use aggregate functions like COUNT, SUM, AVG). Example: SELECT dept, COUNT(*) FROM emp WHERE salary > 50000 GROUP BY dept HAVING COUNT(*) > 5." },
        { q: "Explain GROUP BY and aggregate functions.", a: "GROUP BY groups rows with same values in specified columns. Aggregate functions operate on groups: COUNT() — number of rows, SUM() — total, AVG() — average, MIN()/MAX() — extremes. Every non-aggregated column in SELECT must be in GROUP BY." },
        { q: "What is the difference between UNION and UNION ALL?", a: "UNION combines results from two SELECT statements and removes duplicates (slower). UNION ALL combines results and keeps all rows including duplicates (faster). Both require same number of columns with compatible data types." },
      ],
    },
    {
      title: "Indexing & Optimization",
      timeMinutes: 15,
      questions: [
        { q: "What is an index in databases? How does it work?", a: "An index is a data structure (usually B-Tree or Hash) that speeds up data retrieval. Like a book index — instead of scanning every page, jump directly. Trade-offs: Faster reads, slower writes (index must be updated), extra storage space." },
        { q: "What are the types of indexes?", a: "Primary Index: On primary key, unique and clustered. Unique Index: Ensures no duplicate values. Composite Index: On multiple columns. Clustered Index: Determines physical order of data (one per table). Non-Clustered Index: Separate structure pointing to data (multiple per table)." },
        { q: "How do you optimize a slow SQL query?", a: "1) Use EXPLAIN/EXPLAIN ANALYZE to see query plan. 2) Add appropriate indexes. 3) Avoid SELECT * — specify needed columns. 4) Use WHERE to filter early. 5) Optimize JOINs — join on indexed columns. 6) Avoid subqueries when JOINs work. 7) Use LIMIT for pagination. 8) Consider denormalization for read-heavy tables." },
      ],
    },
  ],
  "Mock interviews": [
    {
      title: "Behavioral Questions",
      timeMinutes: 15,
      questions: [
        { q: "Tell me about yourself.", a: "Structure: Present → Past → Future. Start with current role/studies, mention relevant experience, highlight key skills, connect to the position you're interviewing for. Keep it 60-90 seconds. Focus on professional journey, not personal details." },
        { q: "Tell me about a time you faced a challenge and how you overcame it.", a: "Use the STAR method: Situation — describe the context. Task — what was your responsibility. Action — what specific steps did you take. Result — what was the outcome (quantify if possible). Choose a challenge that shows resilience, problem-solving, and growth." },
        { q: "Why do you want to work at this company?", a: "Research the company: products, culture, recent news. Connect your skills and goals to their mission. Show genuine enthusiasm. Example structure: 'I admire [specific thing about company]. My experience in [relevant skill] aligns with your [project/team]. I'm excited about [future opportunity at company].'" },
        { q: "What are your strengths and weaknesses?", a: "Strengths: Pick 2-3 relevant to the role, provide examples. Weaknesses: Choose a genuine area for improvement, show self-awareness, explain what you're doing to improve. Avoid clichés like 'perfectionist'. Example: 'I sometimes spend too much time on details, but I've learned to set time-boxes for tasks.'" },
      ],
    },
    {
      title: "Technical Discussion",
      timeMinutes: 15,
      questions: [
        { q: "Explain a project you've worked on recently.", a: "Structure: What the project is → Your role → Technologies used → Challenges faced → Results/learnings. Be specific about YOUR contribution. Quantify impact if possible (performance improvement, user count, etc.). Practice explaining technical concepts simply." },
        { q: "How do you approach debugging a production issue?", a: "1) Reproduce the issue if possible. 2) Check logs and error messages. 3) Isolate the problem — which component/service? 4) Form hypotheses. 5) Test systematically. 6) Fix and verify. 7) Add monitoring/alerts to prevent recurrence. 8) Post-mortem to document learnings." },
        { q: "What is your preferred development workflow?", a: "Describe: Version control (Git branching strategy), code review process, testing approach (unit, integration, e2e), CI/CD pipeline, documentation practices. Show you understand professional development practices beyond just writing code." },
      ],
    },
    {
      title: "HR Round",
      timeMinutes: 10,
      questions: [
        { q: "What are your salary expectations?", a: "Research market rates for the role. Provide a range based on research. Consider total compensation (base, bonuses, benefits). Example: 'Based on my research and experience, I'm looking in the range of X-Y LPA, but I'm open to discussion based on the complete compensation package.'" },
        { q: "Where do you see yourself in 5 years?", a: "Show ambition aligned with the company's growth. Mention skill development, leadership aspirations, and domain expertise. Example: 'I see myself as a senior engineer contributing to architecture decisions, mentoring junior developers, and driving impactful projects in [relevant domain].'" },
        { q: "Do you have any questions for us?", a: "Always have 2-3 prepared questions: About the team (size, structure, collaboration), about the role (day-to-day, first 90 days expectations), about growth (learning opportunities, career paths), about the product/technology stack. Avoid questions about salary/benefits in initial rounds." },
      ],
    },
  ],
};

/* ────────────────── TIMER COMPONENT ────────────────── */
function Timer({ totalSeconds, onExpire }: { totalSeconds: number; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(totalSeconds);

  useEffect(() => {
    setRemaining(totalSeconds);
  }, [totalSeconds]);

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

/* ────────────────── MAIN MODULE CONTENT ────────────────── */
function ModuleContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const moduleTitle = searchParams.get("title") || "Core Java fundamentals";
  const company = searchParams.get("company") || "TCS";

  const sections = MODULE_SECTIONS[moduleTitle] || MODULE_SECTIONS["Core Java fundamentals"];

  const [currentSectionIdx, setCurrentSectionIdx] = useState(0);
  const [revealedAnswers, setRevealedAnswers] = useState<Record<number, boolean>>({});
  const [completedSections, setCompletedSections] = useState<boolean[]>(new Array(sections.length).fill(false));
  const [timerExpired, setTimerExpired] = useState(false);
  const [allDone, setAllDone] = useState(false);

  const currentSection = sections[currentSectionIdx];
  const totalQuestions = currentSection.questions.length;
  const answeredCount = Object.keys(revealedAnswers).length;
  const allRevealed = answeredCount === totalQuestions;

  const toggleAnswer = (idx: number) => {
    setRevealedAnswers((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleTimerExpire = useCallback(() => {
    setTimerExpired(true);
  }, []);

  const handleCompleteSection = () => {
    const updated = [...completedSections];
    updated[currentSectionIdx] = true;
    setCompletedSections(updated);

    if (currentSectionIdx < sections.length - 1) {
      setCurrentSectionIdx(currentSectionIdx + 1);
      setRevealedAnswers({});
      setTimerExpired(false);
    } else {
      setAllDone(true);
    }
  };

  const handleGoToSection = (idx: number) => {
    if (idx <= currentSectionIdx || completedSections[idx]) {
      setCurrentSectionIdx(idx);
      setRevealedAnswers({});
      setTimerExpired(false);
    }
  };

  if (allDone) {
    return (
      <div className="animate-fade-in w-full max-w-4xl mx-auto py-10">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-100 mx-auto flex items-center justify-center mb-6">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7"/></svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>Module Complete!</h2>
          <p className="text-slate-500 text-[15px] mb-2">You've finished all {sections.length} sections in <strong>{moduleTitle}</strong>.</p>
          <p className="text-slate-400 text-sm mb-8">Great work! Keep preparing for your interview.</p>
          <button onClick={() => router.push("/study-plan")} className="btn-primary px-8 py-3 text-[15px]">
            Back to Study Plan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in w-full max-w-5xl mx-auto py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/study-plan")} className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition" title="Back">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>{moduleTitle}</h1>
            <p className="text-[12px] text-slate-400">{company} — Preparation Module</p>
          </div>
        </div>
        <Timer totalSeconds={currentSection.timeMinutes * 60} onExpire={handleTimerExpire} />
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

      {/* Timer Expired Overlay */}
      {timerExpired && (
        <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-center gap-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p className="text-[13px] text-amber-800 font-medium">Time's up for this section! You can still review the answers and complete it.</p>
        </div>
      )}

      {/* Progress indicator */}
      <div className="flex items-center justify-between mb-4 px-1">
        <p className="text-[12px] text-slate-400 font-medium">
          Section {currentSectionIdx + 1} of {sections.length} — <strong className="text-slate-600">{currentSection.title}</strong>
        </p>
        <p className="text-[12px] text-slate-400">
          <span className="text-indigo-500 font-bold">{answeredCount}</span> / {totalQuestions} answers revealed
        </p>
      </div>

      {/* Questions */}
      <div className="space-y-3 mb-8">
        {currentSection.questions.map((item, idx) => {
          const isRevealed = revealedAnswers[idx];
          return (
            <div key={idx} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:shadow-md">
              <div className="flex items-start gap-4 px-5 py-4">
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-500 text-[12px] font-bold shrink-0 mt-0.5">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <p className="text-[14px] font-semibold text-slate-800 leading-snug" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>{item.q}</p>
                </div>
                <button
                  onClick={() => toggleAnswer(idx)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${
                    isRevealed ? "bg-indigo-50 text-indigo-600 border-indigo-200" : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200"
                  }`}
                >
                  {isRevealed ? "Hide" : "Reveal"}
                </button>
              </div>
              {isRevealed && (
                <div className="px-5 pb-4 pt-0 ml-11">
                  <div className="bg-gradient-to-r from-indigo-50/80 to-slate-50 rounded-lg px-4 py-3 border border-indigo-100/60">
                    <p className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-line">{item.a}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Complete Section Button */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-slate-400">
          {allRevealed ? "✓ All answers revealed" : `Reveal all answers to continue`}
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
          {currentSectionIdx < sections.length - 1 ? `Complete & Next Section →` : `Finish Module ✓`}
        </button>
      </div>
    </div>
  );
}

export default function ModulePage() {
  return (
    <Suspense fallback={<div className="p-8 animate-fade-in text-center text-slate-400">Loading module...</div>}>
      <ModuleContent />
    </Suspense>
  );
}
