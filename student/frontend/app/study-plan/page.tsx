"use client";
import dynamic from "next/dynamic";
const MonacoEditor = dynamic(() => import("@monaco-editor/react").then(m => m.default), { ssr: false, loading: () => <div style={{height:'100%',background:'#1e1e2e',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{color:'#6b7280',fontSize:12}}>Loading editor…</span></div> });

import { useEffect, useRef, useState } from "react";

/* ─────────────────────────────────────────────────────────────────────────────
 *  EDITORIAL STYLES
 * ───────────────────────────────────────────────────────────────────────────── */
const editorialStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');

  @keyframes slideInRight {
    from { opacity: 0; transform: translateX(40px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes slideInLeft {
    from { opacity: 0; transform: translateX(-40px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .slide-enter-right { animation: slideInRight 0.35s cubic-bezier(0.22,1,0.36,1) both; }
  .slide-enter-left  { animation: slideInLeft  0.35s cubic-bezier(0.22,1,0.36,1) both; }
  .fade-up           { animation: fadeInUp 0.4s ease both; }

  .editorial-scrollbar::-webkit-scrollbar { width: 5px; }
  .editorial-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .editorial-scrollbar::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 10px; }
  .editorial-scrollbar::-webkit-scrollbar-thumb:hover { background: #9ca3af; }
`;

/* ─────────────────────────────────────────────────────────────────────────────
 *  SVG ICON COMPONENTS
 * ───────────────────────────────────────────────────────────────────────────── */
function IconCheck({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>;
}
function IconLock({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>;
}
function IconChevron({ size = 16, className = "" }: { size?: number; className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="6 9 12 15 18 9" /></svg>;
}
function IconArrowLeft({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>;
}
function IconArrowRight({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>;
}
function IconCode({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>;
}
function IconBook({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /></svg>;
}
function IconClock({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
}
function IconLightbulb({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6" /><path d="M10 22h4" /><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0018 8 6 6 0 006 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 019 14" /></svg>;
}
function IconPlay({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3" /></svg>;
}
function IconCheckCircle({ size = 16, color = "#059669" }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>;
}
function IconPanelLeft({ size = 16, className = "", color = "currentColor" }: { size?: number; className?: string; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M9 3v18" /></svg>;
}
function IconTerminal({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg>;
}
function IconX({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  COLOR SYSTEM
 * ───────────────────────────────────────────────────────────────────────────── */
const C = {
  navy: "#1a1a2e",
  purple: "#534AB7",
  purpleLight: "#7C74D4",
  purpleBg: "#F0EEFB",
  green: "#059669",
  greenLight: "#D1FAE5",
  surface: "#F8F9FC",
  card: "#FFFFFF",
  border: "#E5E7EB",
  muted: "#6B7280",
  body: "#1F2937",
  heading: "#111827",
};

import {
  fetchScormProgress,
  fetchScormSummary,
  reportSectionComplete,
  updateBookmark,
  type ScormSectionItem,
} from "@/src/lib/scorm";
import { getLatestPrep, generateCodeReport } from "@/src/lib/api";

/* ──────────────────────────────────────────────
 *  DATA TYPES
 * ────────────────────────────────────────────── */

interface ExplanationPoint {
  term: string;
  color: string;
  text: string;
}

interface Question {
  q: string;
  a: string;
  explanation: string;
  detailedExplanation?: string;
  coverImageUrl?: string | null;
  explanationPoints?: ExplanationPoint[];
}

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface LangTemplate { id: number; label: string; monacoLang: string; code: string; }
interface CodingMock {
  question: string;
  description: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  examples: { input: string; output: string; explanation?: string }[];
  constraints: string[];
  templates: LangTemplate[];
  template?: string;
  languageId?: number;
  testCases: { input: string; expected: string; label?: string }[];
  hint?: string;
}

interface Section {
  title: string;
  timeMinutes: number;
  questions: Question[];
  quiz: QuizQuestion[];
  codingMocks?: CodingMock[];
  coverImage?: string;
  concepts?: string[];
}

const PLAN_MODULES: Record<string, { title: string; sub: string; progress: number; color: string }[]> = {
  "TCS": [
    { title: "Core Java fundamentals", sub: "OOP, Collections, Streams", progress: 75, color: "#22c55e" },
    { title: "Spring Boot + microservices", sub: "REST, JPA, Docker", progress: 40, color: "#3b82f6" },
    { title: "DSA", sub: "Arrays, Trees, Graphs, DP", progress: 15, color: "#f59e0b" },
    { title: "SQL + database design", sub: "Joins, Indexing", progress: 0, color: "#e2e8f0" },
    { title: "Coding Mock Tests", sub: "Live Sandbox, Test Cases", progress: 0, color: "#ec4899" },
    { title: "Mock interviews", sub: "Behavioral, Technical, HR", progress: 0, color: "#e2e8f0" },
  ],
  "Google": [
    { title: "Algorithms & Data Structures", sub: "Arrays, Trees, Graphs, DP", progress: 30, color: "#22c55e" },
    { title: "System Design", sub: "Scalability, CAP, Databases", progress: 10, color: "#3b82f6" },
    { title: "Java / Python fundamentals", sub: "OOP, Collections, Streams", progress: 60, color: "#f59e0b" },
    { title: "Behavioral preparation", sub: "STAR method, Leadership", progress: 5, color: "#e2e8f0" },
    { title: "Mock interviews", sub: "Technical, HR, Case", progress: 0, color: "#e2e8f0" },
  ],
  "Infosys": [
    { title: "Core Java", sub: "OOP, Collections, Threads", progress: 50, color: "#22c55e" },
    { title: "SQL basics", sub: "Queries, Joins, Aggregation", progress: 20, color: "#3b82f6" },
    { title: "Aptitude & Reasoning", sub: "Quant, Verbal, Logical", progress: 80, color: "#f59e0b" },
    { title: "Communication skills", sub: "English, Group Discussion", progress: 0, color: "#e2e8f0" },
    { title: "HR round prep", sub: "FAQs, Situational", progress: 0, color: "#e2e8f0" },
  ],
};

const MODULE_SECTIONS: Record<string, Section[]> = {
  "Coding Mock Tests": [
    {
      title: "Mock 1: Easy Arrays",
      timeMinutes: 30,
      coverImage: "/study-images/dsa_algorithms.png",
      concepts: ["Two Sum", "Hash Map", "Array Traversal"],
      questions: [],
      quiz: [],
      codingMocks: [
        {
          question: "Two Sum",
          difficulty: "Easy",
          description: "Given an array of integers `nums` and an integer `target`, return **indices** of the two numbers such that they add up to target.\n\nYou may assume that each input would have **exactly one solution**, and you may not use the same element twice.\n\nYou can return the answer in any order.",
          hint: "Consider using a hash map (dictionary) to store the values you've seen and their indices. For each number, check if (target - current number) exists in the map.",
          examples: [
            { input: "nums = [2,7,11,15], target = 9", output: "[0, 1]", explanation: "Because nums[0] + nums[1] == 9, we return [0, 1]." },
            { input: "nums = [3,2,4], target = 6", output: "[1, 2]" },
            { input: "nums = [3,3], target = 6", output: "[0, 1]" },
          ],
          constraints: [
            "2 ≤ nums.length ≤ 10⁴",
            "-10⁹ ≤ nums[i] ≤ 10⁹",
            "-10⁹ ≤ target ≤ 10⁹",
            "Only one valid answer exists.",
          ],
          templates: [
            {
              id: 71, label: "Python", monacoLang: "python",
              code: `def twoSum(nums, target):\n    # Your solution here\n    pass\n\n# --- Harness (do not modify) ---\nimport sys\nlines = sys.stdin.read().splitlines()\nnums = list(map(int, lines[0].split()))\ntarget = int(lines[1])\nresult = twoSum(nums, target)\nif result:\n    print(result[0], result[1])\n`
            },
            {
              id: 62, label: "Java", monacoLang: "java",
              code: `import java.util.*;\npublic class Main {\n    public static int[] twoSum(int[] nums, int target) {\n        // Your solution here\n        return new int[]{};\n    }\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        String[] parts = sc.nextLine().trim().split(" ");\n        int target = Integer.parseInt(sc.nextLine().trim());\n        int[] nums = Arrays.stream(parts).mapToInt(Integer::parseInt).toArray();\n        int[] res = twoSum(nums, target);\n        if (res.length >= 2) System.out.println(res[0] + " " + res[1]);\n    }\n}\n`
            },
            {
              id: 54, label: "C++", monacoLang: "cpp",
              code: `#include<bits/stdc++.h>\nusing namespace std;\nvector<int> twoSum(vector<int>& nums, int target) {\n    // Your solution here\n    return {};\n}\nint main(){\n    string line1, line2;\n    getline(cin, line1); getline(cin, line2);\n    istringstream ss(line1);\n    vector<int> nums;\n    int x;\n    while(ss >> x) nums.push_back(x);\n    int target = stoi(line2);\n    auto res = twoSum(nums, target);\n    if(res.size()>=2) cout << res[0] << " " << res[1] << endl;\n}\n`
            },
            {
              id: 63, label: "JavaScript", monacoLang: "javascript",
              code: `const readline = require('readline');\nconst rl = readline.createInterface({ input: process.stdin });\nconst lines = [];\nrl.on('line', l => lines.push(l.trim()));\nrl.on('close', () => {\n    const nums = lines[0].split(' ').map(Number);\n    const target = Number(lines[1]);\n    function twoSum(nums, target) {\n        // Your solution here\n    }\n    const res = twoSum(nums, target);\n    if (res) console.log(res[0] + ' ' + res[1]);\n});\n`
            },
          ],
          testCases: [
            { label: "Case 1", input: "2 7 11 15\n9", expected: "0 1" },
            { label: "Case 2", input: "3 2 4\n6", expected: "1 2" },
            { label: "Case 3", input: "3 3\n6", expected: "0 1" },
            { label: "Case 4 (edge)", input: "1 2 3 4 5\n9", expected: "3 4" },
            { label: "Case 5 (large)", input: "-1 -2 -3 -4 -5\n-8", expected: "2 4" },
          ]
        }
      ]
    },
    {
      title: "Mock 2: Medium Math/Logic",
      timeMinutes: 45,
      coverImage: "/study-images/dsa_algorithms.png",
      concepts: ["Fibonacci Sequence", "Dynamic Programming", "Recursion"],
      questions: [],
      quiz: [],
      codingMocks: [
        {
          question: "Fibonacci Number",
          difficulty: "Easy",
          description: "Write a function `fibonacci` that returns the Nth Fibonacci number. Assume N is a non-negative integer.\n\n**Definition:** fib(0) = 0, fib(1) = 1, fib(n) = fib(n-1) + fib(n-2) for n > 1.",
          hint: "Use either recursion with memoization or an iterative approach. For better performance with large N values, avoid pure recursion and use dynamic programming.",
          examples: [
            { input: "n = 4", output: "3", explanation: "fib(4) = fib(3)+fib(2) = 2+1 = 3" },
            { input: "n = 10", output: "55" },
          ],
          constraints: ["0 ≤ n ≤ 30"],
          templates: [
            {
              id: 71, label: "Python", monacoLang: "python",
              code: `def fibonacci(n):\n    # write your code here\n    pass\n\nimport sys\ninput_data = sys.stdin.read().splitlines()\nif len(input_data) >= 1:\n    n = int(input_data[0])\n    print(fibonacci(n))\n`
            },
          ],
          testCases: [
            { label: "Case 1", input: "4", expected: "3" },
            { label: "Case 2", input: "10", expected: "55" },
          ]
        }
      ]
    }
  ],
  "Core Java fundamentals": [
    {
      title: "OOP Concepts",
      timeMinutes: 15,
      coverImage: "/study-images/oop_concepts.svg",
      concepts: ["Encapsulation & Abstraction", "Inheritance & Polymorphism", "Abstract Classes vs Interfaces", "final Keyword & Immutability", "== vs .equals()"],
      questions: [
        { q: "What are the four pillars of Object-Oriented Programming?", a: "Encapsulation, Abstraction, Inheritance, and Polymorphism.", explanation: "Encapsulation bundles data and methods, restricting access. Abstraction hides complexity. Inheritance lets a class acquire properties of another. Polymorphism allows objects to take many forms via overloading and overriding.", detailedExplanation: "Core concepts\n\nEncapsulation is the practice of bundling data (fields) and the methods that operate on that data into a single unit — a class — while restricting direct access from outside. This is enforced through access modifiers like private and protected, exposing only what is necessary via public getters and setters.\n\nAbstraction hides the internal complexity of an object and exposes only a clean, simplified interface to the outside world. In Java, this is achieved through abstract classes and interfaces, letting consumers interact with behaviour without knowing the underlying implementation.\n\nInheritance allows a child class to acquire the properties and methods of a parent class, enabling code reuse and establishing an \"is-a\" relationship. Java supports single inheritance for classes but allows multiple interface implementation.\n\nPolymorphism lets a single interface represent different underlying forms. Through method overloading (compile-time) and method overriding (runtime), the same method name can behave differently depending on the object it is called on — a cornerstone of flexible, extensible design." },
        { q: "What is the difference between an abstract class and an interface in Java?", a: "An abstract class can have both abstract and concrete methods; an interface (pre-Java 8) can only have abstract methods.", explanation: "From Java 8+, interfaces support default and static methods. A class can implement multiple interfaces but extend only one abstract class. Use abstract classes for shared state, interfaces for contracts.", detailedExplanation: "Abstract classes vs Interfaces\n\nAn abstract class in Java serves as a partially implemented blueprint. It can contain constructors, instance variables, concrete methods with logic, and abstract methods that subclasses must implement. This makes it ideal when you want to share common state and behaviour across closely related classes in a hierarchy.\n\nAn interface, on the other hand, defines a pure contract — a set of method signatures that implementing classes must provide. Before Java 8, interfaces could only contain abstract methods and constants. Since Java 8, they also support default methods (with a body) and static methods, bringing them closer to abstract classes in capability.\n\nThe key architectural difference is inheritance: a class can extend only one abstract class (single inheritance), but can implement multiple interfaces. This makes interfaces the preferred choice for defining capabilities that cut across unrelated class hierarchies — like Comparable, Serializable, or Cloneable.\n\nUse abstract classes when you need shared state (fields) and partial implementation. Use interfaces when you need a contract that multiple unrelated classes can fulfill, or when you want to achieve a form of multiple inheritance." },
        { q: "Explain method overloading vs method overriding.", a: "Overloading = same name, different parameters (compile-time). Overriding = subclass replaces superclass method (runtime).", explanation: "Overloading resolves at compile time based on method signature. Overriding resolves at runtime based on the actual object type, enabling dynamic dispatch and polymorphism.", detailedExplanation: "Compile-time vs Runtime polymorphism\n\nMethod overloading occurs when multiple methods in the same class share the same name but differ in their parameter lists — either in the number of parameters, their types, or their order. The Java compiler resolves which method to call at compile time based on the method signature, making this a form of compile-time (static) polymorphism.\n\nMethod overriding happens when a subclass provides its own implementation of a method that is already defined in its parent class. The method in the child class must have the exact same name, return type, and parameter list as the parent's version. At runtime, the JVM uses dynamic dispatch to determine which version to call based on the actual object type.\n\nThe @Override annotation in Java is a best practice: it tells the compiler to verify that the method truly overrides a parent method, catching errors like typos in the method name.\n\nOverriding is the foundation of polymorphic behaviour in frameworks like Spring, where dependency injection relies heavily on runtime method resolution." },
        { q: "What is the significance of the 'final' keyword?", a: "final variable: can't change. final method: can't override. final class: can't extend.", explanation: "The 'final' keyword enforces immutability at different levels. String is a final class for security and performance. Constants are declared as static final.", detailedExplanation: "Immutability and design control\n\nThe final keyword in Java is a modifier that enforces immutability and design constraints at three distinct levels. When applied to a variable, final means the value can be assigned exactly once — after that, any attempt to reassign it will result in a compilation error.\n\nWhen applied to a method, final prevents any subclass from overriding that method. This is useful when a parent class has critical logic — such as a security check or a template method step — that must remain unchanged across the hierarchy.\n\nWhen applied to a class, final prevents the class from being extended entirely. Java's String class is the most well-known example: it is final for both security (preventing subclasses from altering string behaviour) and performance (enabling aggressive optimizations by the JVM).\n\nConstants in Java are typically declared as static final, combining class-level scope with immutability. By convention, constant names use UPPER_SNAKE_CASE — for example, static final int MAX_RETRIES = 3." },
        { q: "What is the difference between '==' and '.equals()'?", a: "'==' compares references. '.equals()' compares values.", explanation: "== checks if two references point to the same memory address. equals() checks logical equality. Always override equals() and hashCode() together when creating value objects.", detailedExplanation: "Reference equality vs Value equality\n\nThe == operator in Java performs reference comparison — it checks whether two variables point to the exact same object in memory (the same heap address). For primitive types like int and boolean, == compares actual values, but for objects, it only checks if both references are the same pointer.\n\nThe .equals() method, defined in java.lang.Object, is intended for logical equality — checking whether two objects are equivalent in terms of their content or state, regardless of whether they occupy the same memory location. By default, Object.equals() behaves identically to ==, but classes like String, Integer, and Date override it to compare values.\n\nA common pitfall involves the String Pool: string literals like \"Hello\" are interned by the JVM, meaning identical literals may share the same reference — so == can return true for equal string literals. However, strings created with new String(\"Hello\") occupy separate memory, making == return false even if the content is identical.\n\nWhen you override .equals() in your own class, you must also override .hashCode() to maintain the contract. Violating this breaks HashMap, HashSet, and other hash-based collections." },
      ],
      quiz: [
        { question: "Which is NOT a pillar of OOP?", options: ["Encapsulation", "Compilation", "Inheritance", "Polymorphism"], correctIndex: 1, explanation: "The four pillars are Encapsulation, Abstraction, Inheritance, and Polymorphism. Compilation is a build process, not an OOP concept." },
        { question: "A class can extend how many abstract classes?", options: ["0", "1", "2", "Unlimited"], correctIndex: 1, explanation: "Java supports single inheritance for classes. A class can extend only one abstract class but can implement multiple interfaces." },
        { question: "Method overriding is an example of:", options: ["Compile-time polymorphism", "Runtime polymorphism", "Encapsulation", "Abstraction"], correctIndex: 1, explanation: "Method overriding enables runtime (dynamic) polymorphism. The JVM decides which method to call based on the actual object type at runtime." },
      ],
    },
    {
      title: "Collections Framework",
      timeMinutes: 20,
      coverImage: "/study-images/collections_framework.svg",
      concepts: ["List, Set, Queue & Map Hierarchy", "ArrayList vs LinkedList", "HashMap vs TreeMap", "ConcurrentHashMap", "Iterator & ListIterator"],
      questions: [
        { q: "What is the Java Collections Framework?", a: "A unified architecture for representing and manipulating collections of objects.", explanation: "Main interfaces include Collection (root), List (ordered, allows duplicates), Set (no duplicates), Queue (FIFO), Map (key-value pairs), and Deque (double-ended queue).", detailedExplanation: "Architecture overview\n\nThe Java Collections Framework (JCF) is a comprehensive, standardized architecture that provides a set of interfaces, implementations, and algorithms for storing and manipulating groups of objects. Introduced in Java 2, it replaced the earlier ad-hoc approaches.\n\nAt the root lies the Collection interface, which represents a group of objects known as elements. It branches into three main sub-interfaces: List (ordered, allows duplicates), Set (unordered, forbids duplicates), and Queue (FIFO processing).\n\nThe Map interface stands apart from Collection: it represents key-value pair mappings. HashMap provides O(1) average-case performance, TreeMap keeps keys sorted, and LinkedHashMap preserves insertion order.\n\nThe framework also includes utility classes like Collections (with static methods for sorting, searching, and synchronizing) and the Comparator and Comparable interfaces for defining custom ordering." },
        { q: "What is the difference between ArrayList and LinkedList?", a: "ArrayList uses a dynamic array (O(1) access), LinkedList uses a doubly linked list (O(1) insert/delete).", explanation: "ArrayList is better for read-heavy operations with random access. LinkedList excels at frequent insertions and deletions.", detailedExplanation: "Internal structure and performance trade-offs\n\nArrayList is backed by a resizable array internally. When you access an element by index, it simply computes the memory offset — making get(index) an O(1) operation. However, inserting or removing elements in the middle requires shifting all subsequent elements, making those operations O(n).\n\nLinkedList is implemented as a doubly linked list — each element (node) holds a reference to both its previous and next neighbour. This makes insertions and deletions at known positions O(1) since only pointers need to be updated. However, accessing an element by index requires traversing from the head, making random access O(n).\n\nIn practice, ArrayList is the default choice for most scenarios because CPU caches work much better with contiguous memory (arrays) than scattered heap nodes (linked lists).\n\nLinkedList shines only in specific patterns: frequent insertions/removals at the beginning, or when used as a queue/deque." },
        { q: "Explain HashMap vs TreeMap.", a: "HashMap uses hashing (O(1) avg), unordered. TreeMap uses Red-Black tree (O(log n)), sorted keys.", explanation: "HashMap allows one null key and is faster for most operations. TreeMap maintains natural ordering and supports range queries.", detailedExplanation: "Hashing vs balanced trees\n\nHashMap stores key-value pairs using a hash table. Each key's hashCode() is used to compute a bucket index, and the value is placed in that bucket. Under ideal conditions, put() and get() are O(1). Java 8+ converts bucket linked lists to balanced trees when they reach 8 entries.\n\nTreeMap stores entries in a Red-Black tree — a self-balancing binary search tree. This guarantees O(log n) for get(), put(), and remove() in all cases. The key advantage is that TreeMap keeps keys in sorted order, supporting operations like firstKey(), lastKey(), subMap(), headMap(), and tailMap().\n\nHashMap allows one null key and multiple null values. TreeMap does not allow null keys (since it needs to compare them), but allows null values.\n\nLinkedHashMap is a useful middle ground: it maintains insertion order like a linked list while providing HashMap-like O(1) performance." },
        { q: "What is a ConcurrentHashMap?", a: "A thread-safe HashMap that uses segment-level locking for concurrent access.", explanation: "Unlike Hashtable which locks the entire map, ConcurrentHashMap divides into segments, allowing concurrent reads and writes.", detailedExplanation: "Thread-safe collections\n\nConcurrentHashMap is a thread-safe implementation of the Map interface designed for high-concurrency scenarios. Unlike Hashtable — which synchronizes every method on a single lock — ConcurrentHashMap uses a more granular locking strategy.\n\nIn Java 7, it divided the internal table into segments (default 16), each with its own lock. Java 8 replaced this with a lock-free read mechanism and CAS (Compare-And-Swap) operations at the node level, with synchronized blocks only for writes to the same bucket.\n\nReads in ConcurrentHashMap are fully non-blocking — they never acquire a lock. Writes use fine-grained synchronization at the bucket level. This makes it ideal for caches and shared counters in multi-threaded scenarios.\n\nKey constraint: ConcurrentHashMap does not allow null keys or null values. In a concurrent context, null would be ambiguous: does get() return null because the key is absent, or because the value is null?" },
        { q: "Difference between Iterator and ListIterator?", a: "Iterator: forward-only, remove(). ListIterator: bidirectional, add(), set(), index access.", explanation: "ListIterator extends Iterator and works only with Lists. Supports traversal in both directions and modification during iteration.", detailedExplanation: "Traversal capabilities\n\nThe Iterator interface provides a universal way to traverse any Collection in Java. It supports three core operations: hasNext() to check if more elements exist, next() to retrieve the next element, and remove() to safely delete the current element during iteration. It moves in one direction only — forward.\n\nListIterator extends Iterator and is specific to the List interface. It adds bidirectional traversal (hasPrevious(), previous()), element insertion (add()), element replacement (set()), and index access (nextIndex(), previousIndex()).\n\nA critical distinction: modifying a collection directly while iterating (e.g., calling list.remove() inside a for-each loop) throws ConcurrentModificationException. Both Iterator.remove() and ListIterator's modification methods are the safe alternatives.\n\nJava's enhanced for-loop (for-each) internally uses an Iterator. When you need modification during traversal or backward iteration, you must use an explicit Iterator or ListIterator." },
      ],
      quiz: [
        { question: "Which collection does NOT allow duplicates?", options: ["ArrayList", "LinkedList", "HashSet", "Vector"], correctIndex: 2, explanation: "HashSet implements the Set interface which guarantees no duplicate elements. Lists allow duplicates." },
        { question: "What is the average time complexity of HashMap.get()?", options: ["O(n)", "O(log n)", "O(1)", "O(n log n)"], correctIndex: 2, explanation: "HashMap uses hashing to compute the bucket index, providing O(1) average-case lookup." },
        { question: "TreeMap stores keys in what order?", options: ["Insertion order", "Random order", "Sorted/natural order", "Reverse order"], correctIndex: 2, explanation: "TreeMap uses a Red-Black tree and maintains keys in their natural ordering." },
      ],
    },
    {
      title: "Streams & Lambdas",
      timeMinutes: 15,
      coverImage: "/study-images/streams_lambdas.svg",
      concepts: ["Stream Pipeline Architecture", "Lambda Expressions & Functional Interfaces", "map() vs flatMap()", "Terminal Operations", "Optional & Null Safety"],
      questions: [
        { q: "What are Java Streams?", a: "A sequence of elements supporting sequential and parallel processing operations.", explanation: "Streams don't store data — they process data from a source lazily. Intermediate operations are deferred; terminal operations trigger the pipeline.", detailedExplanation: "Declarative data processing\n\nJava Streams, introduced in Java 8, represent a fundamental shift in how Java developers process collections of data. A Stream is not a data structure — it does not store elements. Instead, it is a pipeline that carries data from a source through a series of computational steps.\n\nStreams are lazy by design. When you chain intermediate operations like filter(), map(), and sorted(), nothing actually happens — they are merely recorded as a recipe. Only when a terminal operation like collect(), forEach(), or count() is invoked does the entire pipeline execute.\n\nThis laziness enables powerful optimizations. Short-circuit operations like findFirst() or anyMatch() stop processing as soon as a result is found. Streams also support parallel execution via .parallelStream(), which splits the workload across multiple CPU cores using the ForkJoinPool.\n\nKey distinction from collections: a Stream can only be consumed once. After a terminal operation, the stream is closed. To reprocess, you must create a new stream from the source." },
        { q: "What is a lambda expression?", a: "An anonymous function that implements a functional interface: (params) -> expression.", explanation: "Lambdas enable functional programming in Java. They reduce boilerplate and are heavily used with Streams API and Comparators.", detailedExplanation: "Functional programming in Java\n\nA lambda expression is an anonymous function — a concise way to represent a single-method interface (functional interface) inline, without the ceremony of creating a named class. The syntax is clean: (parameters) -> expression.\n\nLambdas are only valid where the compiler can infer a functional interface — an interface with exactly one abstract method, such as Runnable, Predicate<T>, Function<T,R>, or Consumer<T>. The @FunctionalInterface annotation documents this intent.\n\nUnder the hood, lambdas are not syntactic sugar for anonymous inner classes. The JVM uses the invokedynamic instruction to defer the binding, allowing the runtime to choose the most efficient implementation.\n\nLambdas capture variables from their enclosing scope (closures), but those variables must be effectively final. This restriction ensures thread-safety and predictable behaviour." },
        { q: "Explain map() vs flatMap().", a: "map() = one-to-one transformation. flatMap() = one-to-many + flatten.", explanation: "map() transforms each element to one output. flatMap() transforms each to a stream then flattens all into one.", detailedExplanation: "Transformation patterns\n\nThe map() operation applies a function to each element of a stream and produces a new stream of the transformed results. It is a one-to-one mapping: every input element produces exactly one output element.\n\nflatMap() is used when each input element needs to produce zero, one, or many output elements. It applies a function that returns a Stream for each element, then flattens all those inner streams into a single output stream.\n\nThe distinction is critical in real-world scenarios. If you have a List<List<String>> and use map(), you get a Stream<List<String>> — still nested. Using flatMap() with Collection::stream gives you a flat Stream<String>.\n\nRule of thumb: use map() when your function returns a simple value; use flatMap() when your function returns a collection, array, or Optional." },
        { q: "What are terminal operations in Streams?", a: "Operations that trigger processing: collect(), forEach(), reduce(), count().", explanation: "Terminal operations consume the stream. Others include findFirst(), allMatch(), anyMatch(), min(), max().", detailedExplanation: "Pipeline execution\n\nTerminal operations are the trigger that causes a Stream pipeline to actually execute. Without a terminal operation, all the intermediate operations remain dormant — they are just a deferred recipe.\n\ncollect() is the most versatile terminal operation, using Collectors to gather results into lists, maps, sets, grouped structures (Collectors.groupingBy()), or joined strings (Collectors.joining()).\n\nreduce() combines all elements into a single result using an associative accumulator function. For example, numbers.stream().reduce(0, Integer::sum) produces the total.\n\nOther terminal operations include forEach() (side effects like printing), count() (element count), min()/max() (extremes), findFirst()/findAny() (retrieval), and allMatch()/anyMatch()/noneMatch() (boolean predicates)." },
        { q: "What is Optional in Java?", a: "A container that may or may not hold a non-null value, used to avoid NullPointerException.", explanation: "Key methods: of(), ofNullable(), isPresent(), ifPresent(), orElse(), orElseGet(), orElseThrow(), map(), flatMap().", detailedExplanation: "Null-safety by design\n\nOptional<T> is a container class introduced in Java 8 that explicitly represents the possibility of absence. It forces developers to consciously handle the null case, making NullPointerException far less likely.\n\nCreation methods: Optional.of(value) wraps a non-null value (throws if null), Optional.ofNullable(value) wraps a potentially null value (returns empty if null), and Optional.empty() creates an absent value.\n\nRetrieval methods form a hierarchy of safety: get() retrieves the value but throws if absent (avoid this), orElse(default) returns a fallback value, orElseGet(() -> compute()) lazily computes a fallback, and orElseThrow(() -> new Exception()) throws a custom exception.\n\nOptional also supports functional chaining: map() transforms the contained value (if present), flatMap() avoids double-wrapping, and filter() retains the value only if it matches a predicate. Example: user.map(User::getAddress).map(Address::getCity).orElse(\"Unknown\")." },
      ],
      quiz: [
        { question: "Which is a terminal operation?", options: ["filter()", "map()", "collect()", "sorted()"], correctIndex: 2, explanation: "collect() is a terminal operation that triggers stream processing. filter(), map(), sorted() are intermediate." },
        { question: "Lambda expressions implement:", options: ["Abstract classes", "Functional interfaces", "Regular interfaces", "Concrete classes"], correctIndex: 1, explanation: "Lambda expressions provide inline implementation of functional interfaces — interfaces with exactly one abstract method." },
        { question: "Streams in Java are:", options: ["Eager and reusable", "Lazy and reusable", "Lazy and consumable once", "Eager and consumable once"], correctIndex: 2, explanation: "Java Streams are lazy and can only be consumed once. After a terminal operation, the stream is closed." },
      ],
    },
  ],
  "Spring Boot + microservices": [
    {
      title: "Spring Boot Basics",
      timeMinutes: 15,
      coverImage: "/study-images/spring_boot.svg",
      concepts: ["Auto-Configuration", "Starter Dependencies", "@SpringBootApplication", "Actuator & Monitoring"],
      questions: [
        { q: "What is Spring Boot?", a: "An opinionated framework that simplifies Spring application development with auto-configuration.", explanation: "Spring Boot provides embedded servers, starter dependencies, auto-configuration, removing the need for extensive XML configuration.", detailedExplanation: "Convention over configuration\n\nSpring Boot is a framework built on top of the Spring ecosystem, designed to eliminate the boilerplate and complexity traditionally associated with setting up a Spring application.\n\nAt its core, Spring Boot scans your classpath and automatically configures beans based on what libraries are present. If it detects spring-boot-starter-web, it auto-configures an embedded Tomcat server, Spring MVC, and Jackson for JSON serialization.\n\nSpring Boot also provides an embedded server model: rather than deploying a WAR file to an external Tomcat, your application runs as a standalone JAR. This simplifies deployment in cloud-native and containerized environments.\n\nThe application.properties (or application.yml) file centralizes configuration — database URLs, server ports, logging levels — making environment-specific tuning straightforward." },
        { q: "What are Spring Boot Starters?", a: "Curated dependency descriptors that bundle compatible library versions for specific functionalities.", explanation: "spring-boot-starter-web includes Spring MVC, Tomcat, Jackson. spring-boot-starter-data-jpa includes JPA and Hibernate.", detailedExplanation: "Dependency management simplified\n\nSpring Boot Starters are pre-packaged Maven/Gradle dependency descriptors that pull in a curated set of compatible libraries for a specific purpose. Instead of manually finding and matching versions, you simply add one starter.\n\nCommon starters include spring-boot-starter-web (embedded Tomcat + MVC), spring-boot-starter-data-jpa (JPA + Hibernate + HikariCP), spring-boot-starter-security (Spring Security), spring-boot-starter-test (JUnit, Mockito), and spring-boot-starter-actuator (production monitoring).\n\nThe parent POM (spring-boot-starter-parent) manages version alignment across all starters — ensuring that Spring Framework 6.x, Hibernate 6.x, and Jackson 2.x all work together without conflicts.\n\nYou can also create custom starters for your organization — packaging shared configurations and utilities into a reusable starter that teams adopt with a single dependency." },
        { q: "Explain @SpringBootApplication.", a: "Combines @Configuration, @EnableAutoConfiguration, and @ComponentScan.", explanation: "@Configuration marks bean definitions. @EnableAutoConfiguration configures based on classpath. @ComponentScan enables component discovery.", detailedExplanation: "The entry point annotation\n\n@SpringBootApplication is a convenience annotation that combines three core Spring annotations. Understanding each individually is key to mastering Spring Boot's initialization process.\n\n@Configuration marks the class as a source of bean definitions — any methods annotated with @Bean inside this class will have their return values registered as Spring-managed beans.\n\n@EnableAutoConfiguration tells Spring Boot to automatically configure beans based on the libraries present on the classpath. This is powered by spring.factories files in each starter JAR.\n\n@ComponentScan instructs Spring to scan the package of the annotated class (and all sub-packages) for components marked with @Component, @Service, @Repository, @Controller, or @RestController. This is why placing your main class at the root package is a best practice." },
        { q: "What is Spring Boot Actuator?", a: "Provides production-ready monitoring and management endpoints.", explanation: "Endpoints include /health, /info, /metrics, /env, /loggers. Crucial for production monitoring.", detailedExplanation: "Production monitoring built-in\n\nSpring Boot Actuator provides a suite of production-ready features for monitoring and managing your application. By adding spring-boot-starter-actuator, you gain access to HTTP endpoints that expose runtime information.\n\nThe /health endpoint reports the application's health status, including checks for database connectivity, disk space, and external service availability. Load balancers and Kubernetes use this to determine if a pod should receive traffic.\n\nThe /metrics endpoint exposes detailed performance metrics — JVM memory usage, GC stats, HTTP request counts and latencies, connection pool utilisation. These are exposed in Micrometer format, compatible with Prometheus, Grafana, and DataDog.\n\nBy default, only /health and /info are exposed over HTTP — others must be explicitly enabled via management.endpoints.web.exposure.include in your configuration for security." },
      ],
      quiz: [
        { question: "@SpringBootApplication combines how many annotations?", options: ["1", "2", "3", "4"], correctIndex: 2, explanation: "@SpringBootApplication combines @Configuration, @EnableAutoConfiguration, and @ComponentScan." },
        { question: "Which Actuator endpoint shows app health?", options: ["/info", "/metrics", "/health", "/status"], correctIndex: 2, explanation: "The /health actuator endpoint provides health check information about the application and its dependencies." },
      ],
    },
    {
      title: "REST API Development",
      timeMinutes: 15,
      coverImage: "/study-images/rest_api_docker.svg",
      concepts: ["HTTP Methods & Idempotency", "@Controller vs @RestController", "Global Exception Handling"],
      questions: [
        { q: "What are the main HTTP methods in REST?", a: "GET (retrieve), POST (create), PUT (replace), PATCH (partial update), DELETE (remove).", explanation: "GET, PUT, DELETE are idempotent. POST is not. RESTful APIs should use these methods semantically for resource operations.", detailedExplanation: "Resource-oriented architecture\n\nREST uses standard HTTP methods to perform operations on resources identified by URIs. Each method has specific semantics and idempotency guarantees.\n\nGET retrieves a resource without side effects (safe and idempotent). POST creates a new resource (neither safe nor idempotent). PUT replaces an entire resource (idempotent). PATCH partially updates a resource. DELETE removes a resource (idempotent).\n\nIdempotency means an operation produces the same result regardless of how many times it is repeated. Calling DELETE /users/5 once or five times has the same effect. POST is not idempotent — calling POST /users five times may create five different users.\n\nStatus codes communicate outcomes: 200 (OK), 201 (Created), 204 (No Content), 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden), 404 (Not Found), and 500 (Internal Server Error)." },
        { q: "Difference between @Controller and @RestController?", a: "@Controller returns views. @RestController = @Controller + @ResponseBody.", explanation: "Use @RestController for REST APIs returning JSON/XML. Use @Controller for server-side rendered pages.", detailedExplanation: "View resolution vs direct response\n\n@Controller is the traditional Spring MVC annotation for handling web requests. When a method returns a String, Spring interprets it as a view name and passes it to a ViewResolver — which renders an HTML page using a template engine like Thymeleaf.\n\n@RestController combines @Controller with @ResponseBody. Every method's return value is automatically serialized directly into the HTTP response body — typically as JSON via Jackson. There is no view resolution step.\n\nBefore @RestController existed, developers had to annotate each method with @ResponseBody individually. @RestController reduces this boilerplate.\n\nIn modern applications, the backend typically serves only APIs (@RestController), with the frontend handled by a separate SPA like React or Angular." },
        { q: "How do you handle exceptions globally in Spring Boot?", a: "Use @ControllerAdvice + @ExceptionHandler for centralized exception handling.", explanation: "Create a class annotated with @ControllerAdvice containing methods with @ExceptionHandler(ExceptionType.class).", detailedExplanation: "Centralized error handling\n\n@ControllerAdvice is a specialization of @Component that allows you to define global cross-cutting concerns for all controllers. When combined with @ExceptionHandler, it creates a centralized place to catch exceptions and produce consistent error responses.\n\nA typical setup involves a GlobalExceptionHandler class annotated with @ControllerAdvice, containing methods annotated with @ExceptionHandler(SpecificException.class). When that exception is thrown, Spring routes it to the matching handler.\n\nYou can handle multiple exception types: ResourceNotFoundException → 404, ValidationException → 400, AccessDeniedException → 403, and a catch-all Exception → 500. Each handler returns a ResponseEntity with the appropriate HTTP status and a custom error DTO.\n\nFor REST APIs, @ControllerAdvice + @ExceptionHandler is the recommended approach because it gives full control over the error response format, making your API contracts predictable for frontend consumers." },
      ],
      quiz: [
        { question: "Which HTTP method is NOT idempotent?", options: ["GET", "PUT", "POST", "DELETE"], correctIndex: 2, explanation: "POST is not idempotent — the same POST request may create multiple resources. GET, PUT, and DELETE are idempotent." },
        { question: "@RestController is equivalent to:", options: ["@Controller + @Service", "@Controller + @ResponseBody", "@Component + @ResponseBody", "@Service + @ResponseBody"], correctIndex: 1, explanation: "@RestController combines @Controller with @ResponseBody (serializes return values to the response body)." },
      ],
    },
    {
      title: "JPA & Docker",
      timeMinutes: 15,
      coverImage: "/study-images/rest_api_docker.svg",
      concepts: ["Object-Relational Mapping", "JPA Annotations & Relationships", "Docker & Containerization"],
      questions: [
        { q: "What is JPA?", a: "Java Persistence API — a specification for Object-Relational Mapping.", explanation: "Spring Data JPA provides Repository pattern, automatic query generation from method names, @Query for custom queries.", detailedExplanation: "Object-Relational Mapping\n\nJPA (Java Persistence API) is a specification — not an implementation — that defines how Java objects should be mapped to relational database tables. Hibernate is the most popular implementation.\n\nThe core idea: instead of writing SQL manually and mapping ResultSets to objects, you annotate your Java classes with @Entity, and the JPA provider handles the translation between objects and database rows.\n\nSpring Data JPA builds on top of JPA by providing the Repository pattern — interfaces like JpaRepository<Entity, ID> that automatically generate CRUD operations without any implementation code. Naming a method findByEmailAndStatus(String email, String status) automatically generates the corresponding SQL WHERE clause.\n\nFor complex queries, Spring Data JPA supports @Query annotations (JPQL or native SQL), Specification API for dynamic queries, and QueryDSL for type-safe query building." },
        { q: "What are the main JPA annotations?", a: "@Entity, @Table, @Id, @GeneratedValue, @Column, @OneToMany, @ManyToOne, @JoinColumn.", explanation: "@Entity marks a JPA entity. @Table specifies DB table. Relationship annotations define how entities relate.", detailedExplanation: "Mapping Java to SQL\n\n@Entity marks a class as a JPA entity — a persistent domain object that maps to a database table. @Table specifies the table name if it differs from the class name. Every entity must have a primary key field annotated with @Id.\n\n@GeneratedValue controls how the primary key is generated. Strategies include AUTO, IDENTITY (database auto-increment), SEQUENCE, and TABLE. IDENTITY is the most common for MySQL/PostgreSQL auto-increment columns.\n\n@Column customizes the column mapping: name, nullable, unique, length, and precision. @Transient excludes a field from persistence entirely.\n\nRelationship annotations: @OneToMany and @ManyToOne define parent-child relationships, @ManyToMany handles join tables, and @OneToOne maps 1:1 relationships. fetch = FetchType.LAZY vs EAGER controls when related data is loaded — lazy loading is the default and recommended for performance." },
        { q: "What is Docker?", a: "A containerization platform for packaging applications with their dependencies.", explanation: "Dockerfile defines build steps. Images are immutable templates. Containers are running instances. docker-compose manages multi-container apps.", detailedExplanation: "Containerization fundamentals\n\nDocker packages an application and all its dependencies — runtime, libraries, system tools — into a lightweight, portable unit called a container. Unlike virtual machines, containers share the host OS kernel, making them start in seconds.\n\nA Dockerfile is the recipe: it specifies a base image (e.g., openjdk:17-slim), copies your application code, installs dependencies, and defines the startup command. Building a Dockerfile produces a Docker image — an immutable, versioned template stored in a registry like Docker Hub or AWS ECR.\n\nA container is a running instance of an image. You can run multiple containers from the same image, each isolated with its own filesystem, networking, and process space. This ensures your application behaves identically on a developer's laptop and in production.\n\ndocker-compose defines multi-container applications in a single YAML file — your Spring Boot app, PostgreSQL, Redis, and Nginx all wired together. Running docker-compose up starts the entire stack with one command." },
      ],
      quiz: [
        { question: "Which annotation marks a JPA entity?", options: ["@Table", "@Entity", "@Column", "@Id"], correctIndex: 1, explanation: "@Entity marks a class as a JPA entity that maps to a database table." },
        { question: "Docker images are:", options: ["Mutable and running", "Immutable templates", "Database snapshots", "Log files"], correctIndex: 1, explanation: "Docker images are immutable, read-only templates. Containers are the running instances of images." },
      ],
    },
  ],
  "DSA": [
    {
      title: "Time & Space Complexity",
      timeMinutes: 15,
      coverImage: "/study-images/dsa_algorithms.svg",
      concepts: ["Big O Notation", "Time Complexity", "Space Complexity"],
      questions: [
        { q: "What is Big O Notation?", a: "Mathematical notation describing the upper bound of an algorithm's runtime.", explanation: "It focuses on the worst-case scenario to classify how algorithms scale.", detailedExplanation: "Understanding Growth Rates\n\nBig O notation is the standard metric used to describe the efficiency of an algorithm. It specifically represents the worst-case scenario — giving an upper mathematical bound on how long an algorithm will take as the input size (N) grows towards infinity.\n\nConstants and lower-order terms are always dropped. For example, an algorithm that takes 3N + 5 operations is simply O(N). An algorithm with O(N^2) time complexity will scale quadratically, meaning a 10x increase in data causes a 100x slowdown.\n\nThe hierarchy of common time complexities from best to worst: O(1) Constant, O(log N) Logarithmic, O(N) Linear, O(N log N) Linearithmic, O(N^2) Quadratic, O(2^N) Exponential, and O(N!) Factorial." },
        { q: "How do you calculate Time Complexity for loops?", a: "Sequential loops add. Nested loops multiply.", explanation: "Drop constants and keep only the dominant term.", detailedExplanation: "Analyzing Code Blocks\n\nWhen analyzing a function, you break it down block by block. Primitive operations (like variable assignment or array indexing) are O(1). A single loop running N times is O(N).\n\nIf you have two sequential loops that both run N times, the total time is O(N) + O(N) = O(2N). Dropping the constant gives O(N).\n\nIf one loop is nested inside another (both running N times), the inner loop runs N times for every 1 iteration of the outer loop. This is O(N * N) = O(N^2). This is standard for naive nested approaches like Bubble Sort or finding pairs without a Hash Map." }
      ],
      quiz: [
        { question: "What is the time complexity of a single loop iterating N times?", options: ["O(1)", "O(log N)", "O(N)", "O(N^2)"], correctIndex: 2, explanation: "A single loop iterating N times takes linear time, or O(N)." },
        { question: "Which is more efficient?", options: ["O(N)", "O(1)", "O(N^2)", "O(log N)"], correctIndex: 1, explanation: "O(1) is constant time and is the most efficient scenario possible." }
      ],
    },
    {
      title: "Arrays & Strings",
      timeMinutes: 20,
      coverImage: "/study-images/dsa_algorithms.svg",
      concepts: ["Kadane's Algorithm", "Duplicate Detection Strategies", "Two Pointer Technique"],
      questions: [
        { q: "How do you find the maximum subarray sum? (Kadane's Algorithm)", a: "Track maxEndingHere and maxSoFar while traversing. O(n) time, O(1) space.", explanation: "maxEndingHere = max(arr[i], maxEndingHere + arr[i]). Update maxSoFar = max(maxSoFar, maxEndingHere).", detailedExplanation: "Greedy optimisation\n\nKadane's Algorithm solves the Maximum Subarray Problem — finding the contiguous subarray with the largest sum — in a single pass (O(n) time) with O(1) space.\n\nThe algorithm maintains two variables: maxEndingHere (the maximum sum of any subarray ending at the current position) and maxSoFar (the global maximum). At each element: maxEndingHere = max(arr[i], maxEndingHere + arr[i]). Then update maxSoFar = max(maxSoFar, maxEndingHere).\n\nThe intuition is simple: if the running sum becomes negative, it's better to start fresh from the next element rather than carry a negative prefix.\n\nVariations include finding the actual subarray (not just the sum), handling all-negative arrays, and the 2D extension (maximum sum rectangle in a matrix)." },
        { q: "How do you detect duplicates in an array?", a: "Use HashSet for O(n) time/space, or sort for O(n log n) time, O(1) space.", explanation: "HashSet: add each element, return true if already exists. Sort: check adjacent elements.", detailedExplanation: "Time-space trade-offs\n\nThe HashSet approach iterates through the array, attempting to add each element to a HashSet. Since HashSet.add() returns false if the element already exists, you detect duplicates immediately. This runs in O(n) time (single pass) but uses O(n) extra space.\n\nThe sorting approach sorts the array first (O(n log n)), then checks adjacent elements for equality (O(n)). Total: O(n log n) time, O(1) extra space. This is preferred when memory is limited, but it modifies the original array.\n\nOther approaches include using a boolean array (when the value range is bounded) or Floyd's cycle detection (for the specific case where values are in [1, n] for an array of size n+1).\n\nChoosing the right approach depends on constraints: known value range → boolean array, memory-constrained → sorting, otherwise → HashSet." },
        { q: "What is the Two Pointer technique?", a: "Two pointers iterate from different positions to solve problems in O(n) vs O(n^2).", explanation: "Example: finding pair sum in sorted array. Left at start, right at end. Move based on comparison with target.", detailedExplanation: "Efficient scanning patterns\n\nThe Two Pointer technique uses two references that move through a sorted array to solve problems that would otherwise require nested loops, reducing O(n²) to O(n).\n\nConverging pointers: place one at the start and one at the end. To find a pair that sums to a target: if sum is too small, move left pointer right; if too large, move right pointer left. Each element is visited at most once.\n\nFast-slow pointer: two pointers start at the same position but move at different speeds. Used in linked list cycle detection (Floyd's tortoise and hare), finding the middle of a linked list, and detecting palindromes.\n\nSliding window is a variation where both pointers move in the same direction, maintaining a window. Used for longest substring without repeating characters, minimum window substring, and maximum sum subarray of size k." },
      ],
      quiz: [
        { question: "What is the time complexity of Kadane's Algorithm?", options: ["O(n^2)", "O(n log n)", "O(n)", "O(1)"], correctIndex: 2, explanation: "Kadane's Algorithm traverses the array once, achieving O(n) time complexity with O(1) space." },
        { question: "Two Pointer technique is most effective on:", options: ["Unsorted arrays", "Sorted arrays", "Linked lists only", "Hash maps"], correctIndex: 1, explanation: "Two Pointer works most effectively on sorted arrays where pointer movement can be guided by comparison with the target." },
      ],
    },
    {
      title: "Trees & Graphs",
      timeMinutes: 20,
      coverImage: "/study-images/dsa_algorithms.svg",
      concepts: ["Inorder, Preorder & Postorder Traversal", "Binary Search Trees", "BFS vs DFS"],
      questions: [
        { q: "What are the tree traversal methods?", a: "Inorder (L,Root,R), Preorder (Root,L,R), Postorder (L,R,Root), Level-order (BFS).", explanation: "Inorder gives sorted order for BST. Preorder copies trees. Postorder deletes trees. Level-order uses a queue.", detailedExplanation: "Systematic node visitation\n\nInorder traversal (Left → Root → Right) visits the left subtree first, then the current node, then the right subtree. For a Binary Search Tree, this produces elements in sorted ascending order — making it the basis for BST validation and finding the k-th smallest element.\n\nPreorder traversal (Root → Left → Right) visits the current node before its children. Used for creating a copy of the tree, serialization, and expression tree prefix notation.\n\nPostorder traversal (Left → Right → Root) visits children before the parent. Natural for deletion operations (delete children before parent), calculating directory sizes, and expression tree postfix evaluation.\n\nLevel-order traversal (BFS) visits nodes level by level using a queue. Essential for finding the minimum depth, level-wise operations (zigzag traversal, level averages), and right/left side views of a tree." },
        { q: "What is a Binary Search Tree?", a: "A binary tree where left < root < right for every node.", explanation: "Operations are O(h) where h = height. Balanced BST guarantees O(log n). Degenerate BST becomes O(n).", detailedExplanation: "Ordered binary trees\n\nA Binary Search Tree (BST) has a strict ordering property: for every node, all values in its left subtree are smaller, and all values in its right subtree are larger. This enables efficient searching, insertion, and deletion — all in O(h) time.\n\nIn a balanced BST, height h = O(log n), giving O(log n) operations. However, if elements are inserted in sorted order, the BST degenerates into a linked list with h = O(n).\n\nSelf-balancing BSTs solve this problem. AVL trees maintain a strict balance factor, ensuring O(log n) height with rotations. Red-Black trees use a more relaxed balancing scheme, used in Java's TreeMap and TreeSet.\n\nCommon BST interview operations: search, insertion, deletion (three cases: leaf, one child, two children — replace with inorder successor), validation (verify BST property using range bounds), and finding the lowest common ancestor." },
        { q: "Explain BFS vs DFS.", a: "BFS: queue-based, level-by-level, shortest path. DFS: stack/recursion, depth-first, cycle detection.", explanation: "BFS finds shortest path in unweighted graphs. DFS is used for topological sorting and cycle detection. Both are O(V+E).", detailedExplanation: "Graph exploration strategies\n\nBreadth-First Search (BFS) uses a queue (FIFO) and explores all neighbours at the current depth before moving deeper. It discovers nodes in order of their distance from the source, making it ideal for shortest paths in unweighted graphs and level-order tree traversal.\n\nDepth-First Search (DFS) uses a stack (or recursion) and explores as deep as possible before backtracking. Used for topological sorting (ordering tasks with dependencies), cycle detection (back edges indicate cycles), connected components, and exhaustive search (permutations, backtracking).\n\nKey space difference: BFS requires O(V) space for the queue (entire frontier), while DFS requires O(h) space for the recursion stack (maximum depth).\n\nFor trees: BFS is better for finding shortest paths; DFS is better for exhaustive exploration and backtracking problems like permutations, combinations, and sudoku solving." },
      ],
      quiz: [
        { question: "Which traversal gives sorted order for BST?", options: ["Preorder", "Postorder", "Inorder", "Level-order"], correctIndex: 2, explanation: "Inorder traversal (Left, Root, Right) visits BST nodes in ascending sorted order." },
        { question: "BFS uses which data structure?", options: ["Stack", "Queue", "Heap", "Array"], correctIndex: 1, explanation: "BFS uses a queue (FIFO) to explore all neighbors at the current level before moving to the next." },
      ],
    },
    {
      title: "Dynamic Programming",
      timeMinutes: 20,
      coverImage: "/study-images/dsa_algorithms.svg",
      concepts: ["Memoization vs Tabulation", "Fibonacci Optimization", "0/1 Knapsack Problem"],
      questions: [
        { q: "What is Dynamic Programming?", a: "An optimization technique for problems with overlapping subproblems and optimal substructure.", explanation: "Top-down (memoization) adds caching to recursion. Bottom-up (tabulation) builds solutions iteratively from base cases.", detailedExplanation: "Solving by remembering\n\nDynamic Programming (DP) solves complex problems by breaking them into simpler overlapping subproblems, solving each only once, and storing the result. It applies when a problem has optimal substructure and overlapping subproblems.\n\nThe top-down approach (memoization) starts with the original problem, recursively breaks it down, and caches results. It's intuitive because it follows the natural recursive structure — write the recursive solution first, then add a cache.\n\nThe bottom-up approach (tabulation) builds solutions iteratively, starting from the smallest subproblems (base cases) and working up. It uses a DP table and avoids recursion overhead. Often allows space optimization by keeping only the last few values.\n\nCommon DP patterns: 1D DP (Fibonacci, climbing stairs, house robber), 2D DP (longest common subsequence, edit distance, 0/1 knapsack), interval DP (matrix chain multiplication), and DP on trees." },
        { q: "Explain Fibonacci using DP.", a: "Memoization or tabulation reduces O(2^n) to O(n) time.", explanation: "Naive recursion recomputes same values. Memoization: store fib(n). Tabulation: dp[i] = dp[i-1] + dp[i-2]. Space-optimized: O(1).", detailedExplanation: "The classic DP example\n\nThe naive recursive Fibonacci has O(2^n) time complexity because it recomputes the same subproblems exponentially — fib(5) computes fib(3) twice, fib(2) three times, and so on.\n\nMemoization adds a cache to the recursive solution. Before computing fib(n), check if it's already cached. If yes, return the cached value. This reduces time to O(n) with O(n) space — each subproblem is solved exactly once.\n\nTabulation (bottom-up) creates an array dp[] where dp[i] = dp[i-1] + dp[i-2], starting from dp[0] = 0, dp[1] = 1. This is O(n) time and O(n) space and avoids stack overflow for large n.\n\nSpace optimization: fib(n) only depends on the previous two values. Keep just two variables: prev2 and prev1. This achieves O(n) time and O(1) space — the optimal solution. This pattern applies to many 1D DP problems." },
        { q: "What is the 0/1 Knapsack problem?", a: "Maximize value in a knapsack of capacity W, each item taken or left.", explanation: "dp[i][w] = max(dp[i-1][w], dp[i-1][w-wt[i]] + val[i]). Time: O(n*W), Space: O(W) optimized.", detailedExplanation: "Constrained optimization\n\nThe 0/1 Knapsack problem: given n items, each with a weight and a value, select items to maximize total value without exceeding knapsack capacity W. The \"0/1\" means each item is either taken once or not taken.\n\nThe DP formulation uses a 2D table dp[i][w], where dp[i][w] is the maximum value using the first i items with capacity w. For each item i: skip it (dp[i][w] = dp[i-1][w]) or take it if it fits (dp[i][w] = dp[i-1][w-weight[i]] + value[i]). Answer is dp[n][W].\n\nThe 2D table can be optimized to a 1D array of size W+1 by processing weights in reverse order (right to left). Space drops from O(n×W) to O(W), time remains O(n×W).\n\nVariations everywhere: subset sum (can you form a target sum?), equal partition (split array into two equal-sum subsets), coin change (minimum coins — unbounded knapsack), and bounded knapsack (each item has a limited count)." },
      ],
      quiz: [
        { question: "DP requires which TWO properties?", options: ["Speed + Memory", "Overlapping subproblems + Optimal substructure", "Arrays + Recursion", "Sorting + Searching"], correctIndex: 1, explanation: "DP applies when a problem has overlapping subproblems and optimal substructure." },
        { question: "Memoization is which DP approach?", options: ["Bottom-up", "Top-down", "Greedy", "Divide and conquer"], correctIndex: 1, explanation: "Memoization is top-down: start from the original problem, recurse into subproblems, cache results." },
      ],
    },
  ],
  "SQL + database design": [
    {
      title: "SQL Queries",
      timeMinutes: 20,
      coverImage: "/study-images/sql_database.svg",
      concepts: ["INNER vs OUTER JOINs", "WHERE vs HAVING", "GROUP BY & Aggregation"],
      questions: [
        { q: "Difference between INNER JOIN and OUTER JOIN?", a: "INNER JOIN returns matching rows only. OUTER JOIN includes non-matching rows with NULLs.", explanation: "LEFT: all left rows + matching right. RIGHT: all right rows + matching left. FULL: all rows from both.", detailedExplanation: "Combining related tables data\n\nINNER JOIN returns only the rows where there is a match in both tables. If a row in the left table has no corresponding row in the right table, it is excluded entirely. This is the most common join type and the default when you write JOIN.\n\nLEFT OUTER JOIN (LEFT JOIN) returns all rows from the left table, regardless of whether they have a match in the right table. Where there is no match, the right table's columns are filled with NULL. Essential for finding missing relationships — e.g., \"show all customers, including those with no orders.\"\n\nRIGHT OUTER JOIN is the mirror of LEFT JOIN — all right table rows are preserved. FULL OUTER JOIN returns all rows from both tables, with NULLs filling in where there's no match on either side.\n\nIn practice, LEFT JOIN covers most use cases; RIGHT JOIN is rarely needed if you structure your query with the primary table on the left." },
        { q: "Difference between WHERE and HAVING?", a: "WHERE filters rows before grouping. HAVING filters groups after GROUP BY.", explanation: "WHERE cannot use aggregate functions. HAVING can use COUNT, SUM, AVG, etc.", detailedExplanation: "Filtering at different stages\n\nSQL execution pipeline: FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT. WHERE and HAVING both filter data but at different stages.\n\nWHERE filters individual rows before any grouping occurs. It operates on raw table data and cannot reference aggregate functions like COUNT(), SUM(), or AVG(). Example: WHERE salary > 50000 filters out rows before grouping.\n\nHAVING filters groups after GROUP BY has been applied. It can use aggregate functions because the groups have already been computed. Example: HAVING COUNT(*) > 5 keeps only groups with more than 5 members.\n\nA classic example: \"Find departments with more than 10 employees earning above 50k\" requires both: WHERE salary > 50000 (filter individuals first), then GROUP BY department, then HAVING COUNT(*) > 10." },
        { q: "Explain GROUP BY and aggregate functions.", a: "GROUP BY groups rows. Aggregates: COUNT, SUM, AVG, MIN, MAX.", explanation: "Every non-aggregated column in SELECT must appear in GROUP BY.", detailedExplanation: "Data summarisation\n\nGROUP BY collapses multiple rows into summary groups based on one or more columns. Instead of seeing every individual row, you see one row per distinct group, and use aggregate functions to compute summary statistics for each.\n\nThe five standard aggregate functions: COUNT() for counting rows (COUNT(*) includes NULLs; COUNT(column) excludes them), SUM() for totals, AVG() for averages, MIN() for the smallest value, and MAX() for the largest.\n\nThe golden rule: every column in the SELECT list must either be in the GROUP BY clause or inside an aggregate function. If you group by department, you can't select employee_name without aggregation.\n\nAdvanced grouping includes GROUP BY ROLLUP (adds subtotal rows), GROUP BY CUBE (all possible subtotals), and window functions (PARTITION BY) which provide group-level aggregates without collapsing rows." },
      ],
      quiz: [
        { question: "Which clause filters AFTER grouping?", options: ["WHERE", "HAVING", "ORDER BY", "LIMIT"], correctIndex: 1, explanation: "HAVING filters groups after GROUP BY has been applied, and can use aggregate functions." },
        { question: "LEFT JOIN includes all rows from:", options: ["Right table", "Left table", "Both tables", "Neither table"], correctIndex: 1, explanation: "LEFT JOIN returns all rows from the left table and matching rows from the right. Non-matching right-side values are NULL." },
      ],
    },
    {
      title: "Indexing & Optimization",
      timeMinutes: 15,
      coverImage: "/study-images/sql_database.svg",
      concepts: ["B-Tree & Hash Indexes", "Clustered vs Non-Clustered", "Query Optimization with EXPLAIN"],
      questions: [
        { q: "What is a database index?", a: "A data structure (B-Tree/Hash) that speeds up data retrieval at the cost of write performance.", explanation: "Like a book's index — jump to the right page instead of scanning every one. Faster reads but slower writes.", detailedExplanation: "Speed through structure\n\nA database index is a separate data structure that maintains a sorted reference to data in a table, enabling the database engine to find rows much faster than scanning the entire table (full table scan).\n\nThe most common index structure is the B-Tree (balanced tree), which keeps data sorted and allows searches, insertions, and deletions in O(log n) time. B-Trees are excellent for range queries, equality checks, and ordered retrieval.\n\nHash indexes use a hash function to map keys directly to storage locations, providing O(1) lookups for exact-match queries. However, they don't support range queries or ordering.\n\nThe trade-off is write performance: every INSERT, UPDATE, or DELETE must also update all relevant indexes. A table with 5 indexes means 5 additional write operations per row change. Index the columns used in WHERE, JOIN, and ORDER BY clauses." },
        { q: "What are the types of indexes?", a: "Primary, Unique, Composite, Clustered (1 per table), Non-Clustered (many per table).", explanation: "Clustered index determines physical row order. Non-clustered indexes are separate structures with pointers.", detailedExplanation: "Index varieties\n\nA Clustered index determines the physical storage order of data rows. Because data can only be physically sorted one way, a table can have at most one clustered index. In most databases, the primary key automatically creates a clustered index.\n\nNon-clustered indexes are separate structures that contain the indexed columns plus a pointer (row locator) back to the actual data row. A table can have many non-clustered indexes. The database follows the pointer to fetch the actual row — called a \"bookmark lookup.\"\n\nA Composite index spans multiple columns. The column order matters: the index serves queries that filter on the leftmost prefix columns. This is the \"leftmost prefix\" rule.\n\nA Covering index includes all columns needed by a query — the database can answer entirely from the index without accessing the main table. This eliminates bookmark lookups and dramatically improves performance for frequently-run queries." },
        { q: "How do you optimize a slow SQL query?", a: "EXPLAIN plan, add indexes, avoid SELECT *, filter early, optimize JOINs, use LIMIT.", explanation: "Check execution plan first. Index WHERE/JOIN columns. Avoid subqueries when JOINs work. Consider denormalization.", detailedExplanation: "Systematic query tuning\n\nThe first step is running EXPLAIN (or EXPLAIN ANALYZE) to see the execution plan. This reveals whether the database is using indexes (Index Scan) or scanning the entire table (Seq Scan), how tables are joined, and estimated row counts at each step.\n\nIndexing is the most impactful optimization. Add indexes on columns used in WHERE clauses, JOIN conditions, and ORDER BY. Composite indexes should match query column order. But don't over-index — each index slows down writes.\n\nQuery restructuring: replace SELECT * with specific columns (reduces I/O), move filters from HAVING to WHERE when possible (filters earlier), replace correlated subqueries with JOINs, and use EXISTS instead of IN for large subsets.\n\nAt the schema level: denormalization (adding redundant data to avoid expensive JOINs), partitioning (splitting large tables by date or region), materialized views (pre-computed query results), and connection pooling (HikariCP) provide dramatic improvements." },
      ],
      quiz: [
        { question: "How many clustered indexes can a table have?", options: ["0", "1", "2", "Unlimited"], correctIndex: 1, explanation: "A table can have only one clustered index because it determines the physical storage order of the data rows." },
        { question: "Adding indexes makes writes:", options: ["Faster", "Slower", "No effect", "Impossible"], correctIndex: 1, explanation: "Indexes speed up reads but slow down writes because the index must be updated on every INSERT, UPDATE, and DELETE." },
      ],
    },
  ],
  "Mock interviews": [
    {
      title: "Behavioral Questions",
      timeMinutes: 15,
      coverImage: "/study-images/interview_prep.svg",
      concepts: ["Tell Me About Yourself", "STAR Method", "Company Research"],
      questions: [
        { q: "Tell me about yourself.", a: "Structure: Present, Past, Future. 60-90 seconds, professional focus.", explanation: "Start with current role/studies, mention relevant experience, highlight key skills, connect to the target position.", detailedExplanation: "Your professional elevator pitch\n\nThis is almost always the opening question. The best structure is Present → Past → Future: start with who you are now (current role, education), briefly mention relevant background (projects, internships, key achievements), and end with what you're looking for (how this role fits your goals).\n\nKeep it to 60-90 seconds. Every sentence should be intentional — avoid personal details unless they directly relate to the role. Focus on your technical identity: \"I'm a final-year CS student specializing in backend development. I've built two production APIs using Spring Boot and deployed them on AWS.\"\n\nTailor your answer to the company and role. For a backend position, emphasize your Java, databases, and system design experience. Research the company's tech stack and mirror it in your narrative.\n\nEnd with a bridge to the role: \"...and that's why I'm excited about this position — it aligns perfectly with my Spring Boot expertise and interest in enterprise-scale systems.\"" },
        { q: "Tell me about a challenge you overcame.", a: "Use STAR: Situation, Task, Action, Result.", explanation: "Situation: set the context. Task: your responsibility. Action: specific steps YOU took. Result: quantifiable outcome.", detailedExplanation: "Structured storytelling with STAR\n\nSituation: Set the scene in 2-3 sentences. When was this? Where were you working/studying? What was the context? Example: \"During my third-year capstone project, our team was building a real-time chat application for our college's placement portal.\"\n\nTask: What was YOUR specific responsibility? Be clear about what was expected of you personally — not just the team's goal. Example: \"I was responsible for the backend architecture and database design, with a 6-week deadline.\"\n\nAction: Describe the specific steps YOU took — not what the team did. Use \"I\" not \"we.\" Example: \"I identified a performance bottleneck in our WebSocket implementation, profiled the database queries, redesigned the message schema with proper indexing, and implemented connection pooling.\"\n\nResult: Quantify the outcome. Numbers make your story credible: \"Response time dropped from 2.3s to 180ms. The application successfully handled 500 concurrent users. Our project received the highest grade in the batch.\"" },
        { q: "Why do you want to work here?", a: "Research the company. Connect your skills to their mission. Show enthusiasm.", explanation: "Mention specific products, culture, or news. Align your goals with their direction.", detailedExplanation: "Demonstrating genuine interest\n\nGeneric answers like \"it's a great company\" instantly signal you haven't researched the organisation. The best answers connect three things: the company's work, your skills, and your career goals.\n\nResearch deeply before the interview: visit their engineering blog, read recent press releases, check their GitHub, note their tech stack from job descriptions, understand their products. For TCS, know about their digital transformation services and innovation labs.\n\nStructure in three parts: (1) What specifically attracts you — mention a product, a technology decision, their culture, or a recent achievement. (2) How your skills align — connect your Java/Spring Boot expertise to their enterprise projects. (3) What you hope to grow into — show long-term commitment.\n\nAvoid mentioning salary, brand name, or convenience as primary motivators. The most convincing answers reference specific things: \"I read about your migration from monoliths to microservices on your engineering blog, and that architecture challenge is exactly what excites me.\"" },
      ],
      quiz: [
        { question: "STAR stands for:", options: ["Story, Task, Action, Review", "Situation, Task, Action, Result", "Summary, Time, Action, Response", "Situation, Topic, Answer, Result"], correctIndex: 1, explanation: "STAR method: Situation (context), Task (responsibility), Action (what you did), Result (outcome)." },
        { question: "'Tell me about yourself' should be:", options: ["5+ minutes", "60-90 seconds", "Under 10 seconds", "You should skip it"], correctIndex: 1, explanation: "Keep your introduction to 60-90 seconds. Being concise shows clarity of thought." },
      ],
    },
    {
      title: "Technical Discussion",
      timeMinutes: 15,
      coverImage: "/study-images/interview_prep.svg",
      concepts: ["Project Deep-Dive", "Debugging Production Issues"],
      questions: [
        { q: "Explain a project you've worked on.", a: "What, Your role, Technologies, Challenges, Results.", explanation: "Be specific about YOUR contribution. Quantify impact (performance improvement, user count).", detailedExplanation: "Project deep-dive\n\nStart with the big picture: what problem does the project solve, and who uses it? Then zoom into your role: what components did you design and build? Be specific — don't just say \"used Java,\" say \"built RESTful APIs using Spring Boot with JPA and Redis for session caching.\"\n\nThe most important part is challenges and trade-offs: \"We needed real-time notifications, so I evaluated WebSockets vs SSE vs polling. I chose WebSockets for bidirectional communication, which reduced latency from 3s to 50ms but required managing connection state.\"\n\nEnd with measurable results: users served, performance improvements, uptime achieved. \"The system handled 500 concurrent users during peak placement season with 99.5% uptime.\"\n\nIf it was a learning project, talk about what you would do differently in production: scaling strategy, monitoring, CI/CD pipeline setup." },
        { q: "How do you approach debugging a production issue?", a: "Reproduce, Logs, Isolate, Hypothesize, Test, Fix, Monitor, Post-mortem.", explanation: "Systematic debugging shows engineering maturity. Emphasize communication and prevention.", detailedExplanation: "Systematic incident response\n\nFirst, acknowledge and assess severity. Is the system completely down, or partially degraded? How many users are affected? Is data at risk? This determines urgency and whether to escalate immediately.\n\nGather information from logs, monitoring dashboards, error rates, and recent deployments. \"What changed?\" is the most powerful question — 80% of production issues correlate with a recent deployment, configuration change, or traffic spike.\n\nIsolate the root cause by forming hypotheses and testing them. Use structured logging, distributed tracing (Jaeger, Zipkin), and metric correlations. If it's urgent, apply a temporary mitigation (rollback, scale up, feature flag toggle) while continuing root cause analysis.\n\nAfter resolution, always conduct a post-mortem: what happened, why, how it was detected, how it was fixed, and what changes will prevent recurrence. Blameless post-mortems and monitoring improvements separate junior from senior engineers." },
      ],
      quiz: [
        { question: "When explaining projects, focus on:", options: ["Team's work", "Your specific contribution", "Technologies only", "Company revenue"], correctIndex: 1, explanation: "Interviewers want to understand YOUR role and impact. Use 'I' not 'we' when describing what you personally did." },
      ],
    },
    {
      title: "HR Round",
      timeMinutes: 10,
      coverImage: "/study-images/interview_prep.svg",
      concepts: ["Salary Negotiation", "5-Year Career Vision"],
      questions: [
        { q: "What are your salary expectations?", a: "Research market rates. Give a range. Consider total compensation.", explanation: "Example: 'Based on my research, I'm looking at X-Y LPA, open to discussion based on the complete package.'", detailedExplanation: "Negotiation fundamentals\n\nBefore the interview, research the market rate using Glassdoor, Levels.fyi, AmbitionBox, and LinkedIn Salary Insights — filter by company, role, location, and experience level.\n\nProvide a researched range rather than a single number. A range gives flexibility while anchoring the negotiation. Example: \"Based on my research, I'm looking in the range of X to Y LPA. I'm open to discussing the complete compensation package, including bonuses and growth opportunities.\"\n\nNever give a number first if you can avoid it. If pressed, aim for the upper end of your researched range. You can also deflect: \"I'd prefer to understand the full role first. What's the range budgeted for this position?\"\n\nConsider total compensation beyond base salary: performance bonuses, RSUs/stock, signing bonus, health insurance, learning budgets, remote flexibility, and career growth speed." },
        { q: "Where do you see yourself in 5 years?", a: "Show ambition aligned with the company. Mention skill growth and leadership.", explanation: "Example: 'Senior engineer contributing to architecture, mentoring juniors, driving impactful projects.'", detailedExplanation: "Career vision alignment\n\nThis tests whether you're likely to stay and grow with the company. The best answers show ambition grounded in realistic progression at the company. Avoid saying you want to start your own company or switch careers.\n\nStructure around three dimensions: technical depth (becoming an expert in distributed systems or cloud architecture), impact (working on larger-scoped projects), and leadership (mentoring and guiding others).\n\nConnect your growth to the company's trajectory. If interviewing at TCS: \"I'm excited about TCS's push into cloud-native microservices. I want to grow my expertise there and eventually lead architecture decisions for enterprise clients.\"\n\nShow learning orientation: mention specific technologies you want to master, certifications you plan to pursue (AWS Solutions Architect, Kubernetes), and leadership skills you want to develop." },
      ],
      quiz: [
        { question: "In salary discussion, you should:", options: ["Name exact number immediately", "Provide a researched range", "Say you'll accept anything", "Refuse to discuss"], correctIndex: 1, explanation: "A researched range shows preparation and flexibility while anchoring the negotiation." },
      ],
    },
  ],
};

function getSections(title: string): Section[] {
  if (MODULE_SECTIONS[title] && MODULE_SECTIONS[title].length > 0) return MODULE_SECTIONS[title];
  return [{
    title: "Overview",
    timeMinutes: 10,
    questions: [
      { q: "This module is coming soon.", a: "Content is being prepared.", explanation: "Check back later for full Q&A and quizzes." },
    ],
    quiz: [
      { question: "Is this module content ready?", options: ["Yes", "Not yet", "Partially", "Unknown"], correctIndex: 1, explanation: "Content coming soon!" },
    ],
  }];
}

const ALL_PLANS = [
  { id: "tcs", company: "TCS", role: "Java Backend Dev", expiry: "Mar 25", expiryFull: "Mar 25, 2026", expired: false },
  { id: "google", company: "Google", role: "SDE Intern", expiry: "Apr 2", expiryFull: "Apr 2, 2026", expired: false },
  { id: "wipro", company: "Wipro", role: "Full Stack Dev", expiry: "Mar 15", expiryFull: "Mar 15, 2026", expired: true },
];

function toPoints(text: string): string[] {
  if (!text) return [];
  const sentenceSplit = text.split(/\.\s+(?=[A-Z])/);
  const cleaned = sentenceSplit.map(s => s.replace(/\.$/, "").trim()).filter(Boolean);
  if (cleaned.length > 1) return cleaned;
  const generic = text.split(/\.\s+/).map(s => s.trim()).filter(Boolean);
  if (generic.length > 1) return generic;
  return [text.replace(/\.$/, "").trim()];
}

// ─── SCORM helpers ───────────────────────────────────────────────────────────
function buildPassedSet(sections: ScormSectionItem[]): Set<string> {
  const s = new Set<string>();
  sections.filter(r => r.status === "passed").forEach(r => s.add(`${r.module_index}-${r.section_index}`));
  return s;
}

function modulePassedCount(passedSet: Set<string>, modIdx: number, totalSections: number): number {
  let n = 0;
  for (let i = 0; i < totalSections; i++) {
    if (passedSet.has(`${modIdx}-${i}`)) n++;
  }
  return n;
}

const POINT_COLORS = ["#059669", "#7c3aed", "#f59e0b", "#3b82f6", "#ef4444", "#ec4899"];

function deriveExplanationPoints(explanation: string): { color: string; text: string }[] {
  const parts = toPoints(explanation);
  return parts.map((pt, i) => ({
    color: POINT_COLORS[i % POINT_COLORS.length],
    text: pt,
  }));
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  SECTION INTRO SLIDE
 * ───────────────────────────────────────────────────────────────────────────── */

interface SectionIntroSlideProps {
  sectionTitle: string;
  sectionIndex: number;
  totalSections: number;
  concepts: string[];
  coverImage: string;
  totalSlides: number;
  onNext: () => void;
  hasCodingMocks: boolean;
  onOpenCoding: () => void;
  direction: "right" | "left";
  timeMinutes: number;
}

function SectionIntroSlide({ sectionTitle, sectionIndex, totalSections, concepts, coverImage, totalSlides, onNext, hasCodingMocks, onOpenCoding, direction, timeMinutes }: SectionIntroSlideProps) {
  const animClass = direction === "right" ? "slide-enter-right" : "slide-enter-left";

  const handleStartLearning = () => {
    if (hasCodingMocks) {
      onOpenCoding();
    } else {
      onNext();
    }
  };

  return (
    <div className={`${animClass} rounded-2xl border overflow-hidden flex flex-col`}
      style={{ borderColor: C.border, background: C.card, height: '100%' }}>

      {/* Full-bleed hero */}
      <div className="relative flex-1" style={{ minHeight: 0 }}>
        <div className="absolute inset-0">
          <img src={coverImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
        <div className="absolute inset-0" style={{
          background: `linear-gradient(135deg, rgba(30,27,75,0.92) 0%, rgba(88,28,135,0.88) 50%, rgba(30,27,75,0.85) 100%)`,
        }} />

        <div className="relative flex flex-col justify-center items-center text-center px-8 py-10 h-full">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest"
              style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)' }}>
              Section {sectionIndex + 1} of {totalSections}
            </span>
            <span className="px-3 py-1 rounded-full text-[10px] font-semibold flex items-center gap-1"
              style={{ background: 'rgba(168,85,247,0.3)', color: '#e9d5ff' }}>
              <IconClock size={10} /> {timeMinutes} min
            </span>
            {hasCodingMocks && (
              <span className="px-3 py-1 rounded-full text-[10px] font-semibold flex items-center gap-1"
                style={{ background: 'rgba(5,150,105,0.35)', color: '#86efac' }}>
                <IconTerminal size={10} /> Live Coding
              </span>
            )}
          </div>

          <h2 className="text-[28px] font-extrabold text-white mb-3 leading-tight"
            style={{ fontFamily: "var(--font-playfair), 'Playfair Display', serif", textShadow: '0 2px 20px rgba(0,0,0,0.3)' }}>
            {sectionTitle}
          </h2>

          <p className="text-[12px] font-semibold uppercase tracking-[0.2em] mb-6"
            style={{ color: 'rgba(216,180,254,0.8)' }}>
            {hasCodingMocks ? "Problems you'll solve in this section" : "Concepts you'll master in this section"}
          </p>

          <div className="flex flex-wrap justify-center gap-2 max-w-[500px]">
            {concepts.map((concept, i) => (
              <span key={i} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold"
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(4px)',
                }}>
                {concept}
              </span>
            ))}
          </div>

          <div className="flex gap-1.5 items-center mt-8">
            {Array.from({ length: totalSlides }).map((_, i) => (
              <div key={i} className="rounded-full transition-all"
                style={{ width: i === 0 ? "20px" : "7px", height: "7px", background: i === 0 ? "#fff" : "rgba(255,255,255,0.3)" }} />
            ))}
          </div>
        </div>
      </div>

      {/* Navigation footer */}
      <div className="px-5 py-3 border-t flex items-center justify-between shrink-0"
        style={{ borderColor: C.border, background: C.surface }}>
        <span className="text-[12px] font-semibold" style={{ color: C.muted }}>
          1 / {totalSlides}
        </span>
        <button onClick={handleStartLearning}
          className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-[12px] font-bold text-white transition-all hover:opacity-90"
          style={{ background: hasCodingMocks ? C.green : C.navy }}>
          {hasCodingMocks ? <><IconTerminal size={14} /> Open Coding Environment</> : <>Start Learning <IconArrowRight size={14} /></>}
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  QUESTION SLIDE — no images, bullet-point explanations, fixed height
 * ───────────────────────────────────────────────────────────────────────────── */

interface QuestionSlideProps {
  question: Question;
  idx: number;
  total: number;
  onNext: () => void;
  onPrev: () => void;
  isFirst: boolean;
  isLast: boolean;
  hasQuiz: boolean;
  onGoToQuiz: () => void;
  onCompleteSection: () => void;
  direction: "right" | "left";
  sectionTitle: string;
}

function QuestionSlide({ question, idx, total, onNext, onPrev, isFirst, isLast, hasQuiz, onGoToQuiz, onCompleteSection, direction, sectionTitle }: QuestionSlideProps) {
  const animClass = direction === "right" ? "slide-enter-right" : "slide-enter-left";

  return (
    <div key={`${idx}`} className={`${animClass} flex flex-col rounded-2xl border overflow-hidden`}
      style={{ background: C.card, borderColor: C.border, height: '100%' }}>

      {/* ── Hero Banner (fixed) ── */}
      <div className="relative shrink-0" style={{ height: "90px", background: `linear-gradient(135deg, ${C.navy} 0%, ${C.purple} 100%)` }}>
        <div className="absolute inset-0 flex flex-col justify-end p-4" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 100%)" }}>
          <p className="text-[10px] font-semibold tracking-wider uppercase mb-0.5" style={{ color: C.purpleLight }}>{sectionTitle}</p>
          <h3 className="text-[15px] font-bold leading-snug text-white" style={{ fontFamily: "var(--font-playfair), 'Playfair Display', serif" }}>
            {question.q}
          </h3>
        </div>
        <div className="absolute top-4 right-5 flex gap-1.5 items-center">
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} className="rounded-full transition-all"
              style={{ width: i === idx ? "20px" : "7px", height: "7px", background: i === idx ? "#fff" : "rgba(255,255,255,0.3)" }} />
          ))}
        </div>
      </div>

      {/* ── Fixed Content Area ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">

        {/* Answer Block */}
        <div style={{ borderTop: '0.5px solid #e5e7eb', padding: '10px 16px' }}>
          <div className="flex items-center gap-2 mb-1.5">
            <IconCheckCircle size={14} color={C.green} />
            <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.green }}>ANSWER</p>
          </div>
          <p className="text-[12.5px] font-medium leading-relaxed" style={{ color: C.body }}>
            {question.a}
          </p>
        </div>

        {/* Detailed Explanation Block — BULLET POINTS, NO IMAGES */}
        <div style={{ borderTop: '0.5px solid #e5e7eb', padding: '10px 16px 16px' }}>
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#f59e0b' }} />
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#f59e0b' }}>DETAILED EXPLANATION</p>
          </div>

          {question.detailedExplanation ? (() => {
            const paragraphs = question.detailedExplanation.split('\n\n').filter(Boolean);
            const heading = paragraphs[0] || '';
            const bodyParagraphs = paragraphs.slice(1);

            return (
              <div>
                {/* Heading with purple left border */}
                <div style={{ borderLeft: `3px solid ${C.purple}`, paddingLeft: 12, marginBottom: 12 }}>
                  <h4 className="text-[14px] font-bold" style={{ color: C.heading, fontFamily: "var(--font-playfair), 'Playfair Display', serif", margin: 0 }}>
                    {heading}
                  </h4>
                </div>

                {/* Bullet points — one per paragraph */}
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} className="space-y-2">
                  {bodyParagraphs.map((para, pi) => (
                    <li key={pi} className="flex items-start gap-2.5">
                      <span className="shrink-0 rounded-full mt-[6px]"
                        style={{ width: 6, height: 6, background: POINT_COLORS[pi % POINT_COLORS.length], flexShrink: 0 }} />
                      <p className="text-[12px] leading-[1.65]" style={{ color: C.body, margin: 0 }}>
                        {para}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })() : (
            /* Fallback bullet points from explanation */
            (() => {
              const points = deriveExplanationPoints(question.explanation);
              return (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} className="space-y-2.5">
                  {points.map((item, pi) => (
                    <li key={pi} className="flex items-start gap-2.5">
                      <span className="mt-[6px] shrink-0 rounded-full" style={{ width: 6, height: 6, background: item.color }} />
                      <p className="text-[12px] leading-[1.65]" style={{ color: C.body, margin: 0 }}>
                        {item.text}
                      </p>
                    </li>
                  ))}
                </ul>
              );
            })()
          )}
        </div>
      </div>

      {/* ── Navigation Footer (fixed) ── */}
      <div className="shrink-0 px-5 py-3 border-t flex items-center justify-between gap-3"
        style={{ borderColor: C.border, background: C.surface }}>
        <button onClick={onPrev} disabled={isFirst}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold transition-all"
          style={{
            background: isFirst ? "#F3F4F6" : C.card,
            color: isFirst ? "#D1D5DB" : C.navy,
            border: `1px solid ${isFirst ? "#E5E7EB" : C.border}`,
            opacity: isFirst ? 0.6 : 1,
            cursor: isFirst ? "not-allowed" : "pointer",
          }}>
          <IconArrowLeft size={14} /> Prev
        </button>

        <span className="text-[12px] font-semibold" style={{ color: C.muted }}>
          {idx + 1} / {total}
        </span>

        {isLast ? (
          <button onClick={hasQuiz ? onGoToQuiz : onCompleteSection}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-[12px] font-bold text-white transition-all hover:opacity-90"
            style={{ background: C.navy }}>
            {hasQuiz ? "Take Quiz" : "Complete Section"} <IconArrowRight size={14} />
          </button>
        ) : (
          <button onClick={onNext}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-[12px] font-bold text-white transition-all hover:opacity-90"
            style={{ background: C.navy }}>
            Next <IconArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  CODING SLIDE — Judge0 powered (used inside full-page overlay)
 * ───────────────────────────────────────────────────────────────────────────── */

const JUDGE0_URL = "https://ce.judge0.com";

const DIFF_COLORS: Record<string, { bg: string; text: string }> = {
  Easy:   { bg: "#dcfce7", text: "#166534" },
  Medium: { bg: "#fef9c3", text: "#854d0e" },
  Hard:   { bg: "#fee2e2", text: "#991b1b" },
};

type Verdict = "accepted" | "wrong" | "tle" | "ce" | "re" | "pending" | null;

interface TestResult {
  caseLabel: string;
  status: string;
  statusId: number;
  stdout: string | null;
  stderr: string | null;
  compileOutput: string | null;
  expected: string;
  runtime: string | null;
  memory: number | null;
  passed: boolean;
}

function verdictStyle(v: Verdict): { bg: string; text: string; label: string } {
  if (v === "accepted") return { bg: "#059669", text: "#fff", label: "Accepted" };
  if (v === "wrong")    return { bg: "#dc2626", text: "#fff", label: "Wrong Answer" };
  if (v === "tle")      return { bg: "#d97706", text: "#fff", label: "Time Limit Exceeded" };
  if (v === "ce")       return { bg: "#7c3aed", text: "#fff", label: "Compilation Error" };
  if (v === "re")       return { bg: "#b91c1c", text: "#fff", label: "Runtime Error" };
  return { bg: "#6b7280", text: "#fff", label: "Pending" };
}

function statusToVerdict(statusId: number): Verdict {
  if (statusId === 3)  return "accepted";
  if (statusId === 4)  return "wrong";
  if (statusId === 5)  return "tle";
  if (statusId === 6)  return "ce";
  if (statusId >= 7 && statusId <= 12) return "re";
  return "pending";
}

interface CodingSlideProps {
  mock: CodingMock;
  idx: number;
  total: number;
  onNext: () => void;
  onPrev: () => void;
  isFirst: boolean;
  isLast: boolean;
  hasQuiz: boolean;
  onGoToQuiz: () => void;
  onCompleteSection: () => void;
  direction: "right" | "left";
  sectionConcepts: string[];
  onGoToConcept?: (concept: string) => void;
}

function CodingSlide({ mock, idx, total, onNext, onPrev, isFirst, isLast, hasQuiz, onGoToQuiz, onCompleteSection, sectionConcepts, onGoToConcept }: CodingSlideProps) {
  const templates: LangTemplate[] = mock.templates ?? [
    { id: mock.languageId ?? 71, label: "Python", monacoLang: "python", code: mock.template ?? "" }
  ];

  const [activeLangIdx, setActiveLangIdx] = useState(0);
  const [codes, setCodes] = useState<Record<number, string>>(
    Object.fromEntries(templates.map(t => [t.id, t.code]))
  );
  const [activePanel, setActivePanel] = useState<"description" | "testcase" | "result" | "report">("description");
  const [activeCaseIdx, setActiveCaseIdx] = useState(0);
  const [running, setRunning] = useState(false);
  const [runMode, setRunMode] = useState<"run" | "submit" | null>(null);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [verdict, setVerdict] = useState<Verdict>(null);
  const [totalRuntime, setTotalRuntime] = useState<string | null>(null);
  const [totalMemory, setTotalMemory] = useState<number | null>(null);
  const [passedCount, setPassedCount] = useState<number | null>(null);

  const [reportData, setReportData] = useState<any>(null);
  const [isReportLoading, setIsReportLoading] = useState(false);

  const lang = templates[activeLangIdx];
  const currentCode = codes[lang.id] ?? lang.code;
  const setCurrentCode = (newCode: string) => setCodes(prev => ({ ...prev, [lang.id]: newCode }));

  const resetResults = () => {
    setTestResults([]); setVerdict(null); setTotalRuntime(null); setTotalMemory(null); setPassedCount(null);
    setReportData(null);
  };

  const pollTokens = async (tokens: string[], cases: { input: string; expected: string; label?: string }[]) => {
    const results: TestResult[] = [];
    for (let i = 0; i < tokens.length; i++) {
      let data: any = null;
      for (let attempt = 0; attempt < 20; attempt++) {
        const r = await fetch(`${JUDGE0_URL}/submissions/${tokens[i]}?base64_encoded=false&fields=status,stdout,stderr,compile_output,time,memory`);
        data = await r.json();
        if (data.status?.id !== 1 && data.status?.id !== 2) break;
        await new Promise(res => setTimeout(res, 800));
      }
      results.push({
        caseLabel: cases[i].label ?? `Case ${i + 1}`,
        status: data.status?.description ?? "Unknown",
        statusId: data.status?.id ?? 0,
        stdout: data.stdout ?? null,
        stderr: data.stderr ?? null,
        compileOutput: data.compile_output ?? null,
        expected: cases[i].expected,
        runtime: data.time ?? null,
        memory: data.memory ?? null,
        passed: data.status?.id === 3,
      });
    }
    return results;
  };

  const submitToJudge0 = async (cases: { input: string; expected: string; label?: string }[]) => {
    const payload = cases.map(tc => ({
      source_code: currentCode, language_id: lang.id, stdin: tc.input,
      expected_output: tc.expected, cpu_time_limit: 5, memory_limit: 131072,
    }));
    const batchRes = await fetch(`${JUDGE0_URL}/submissions/batch?base64_encoded=false`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissions: payload }),
    });
    const batchData = await batchRes.json();
    return (batchData as any[]).map((s: any) => s.token);
  };

  const handleRun = async () => {
    setRunning(true); setRunMode("run"); resetResults(); setActivePanel("result");
    try {
      const sampleCases = mock.testCases.slice(0, 3);
      const tokens = await submitToJudge0(sampleCases);
      const results = await pollTokens(tokens, sampleCases);
      setTestResults(results);
      const allPassed = results.every(r => r.passed);
      setVerdict(allPassed ? "accepted" : statusToVerdict(results.find(r => !r.passed)?.statusId ?? 4));
      setPassedCount(results.filter(r => r.passed).length);
      const runtimes = results.map(r => r.runtime ? parseFloat(r.runtime) : 0);
      setTotalRuntime((Math.max(...runtimes) * 1000).toFixed(0));
      setTotalMemory(Math.max(...results.map(r => r.memory ?? 0)));
    } catch (e: any) {
      setTestResults([{ caseLabel: "Error", status: "Network Error", statusId: 0, stdout: null, stderr: String(e.message || e), compileOutput: null, expected: "", runtime: null, memory: null, passed: false }]);
      setVerdict("re");
    } finally { setRunning(false); }
  };

  const handleSubmit = async () => {
    setRunning(true); setRunMode("submit"); resetResults(); setActivePanel("result");
    try {
      const tokens = await submitToJudge0(mock.testCases);
      const results = await pollTokens(tokens, mock.testCases);
      setTestResults(results);
      const allPassed = results.every(r => r.passed);
      setVerdict(allPassed ? "accepted" : statusToVerdict(results.find(r => !r.passed)?.statusId ?? 4));
      setPassedCount(results.filter(r => r.passed).length);
      const runtimes = results.map(r => r.runtime ? parseFloat(r.runtime) : 0);
      setTotalRuntime((Math.max(...runtimes) * 1000).toFixed(0));
      setTotalMemory(Math.max(...results.map(r => r.memory ?? 0)));
    } catch (e: any) {
      setTestResults([{ caseLabel: "Error", status: "Network Error", statusId: 0, stdout: null, stderr: String(e.message || e), compileOutput: null, expected: "", runtime: null, memory: null, passed: false }]);
      setVerdict("re");
    } finally { setRunning(false); }
  };

  const diffStyle = DIFF_COLORS[mock.difficulty ?? "Medium"] ?? DIFF_COLORS.Medium;
  const vStyle = verdict ? verdictStyle(verdict) : null;

  if (activePanel === "report" && reportData) {
    return (
      <div className="flex flex-col editorial-scrollbar" style={{ background: "#0d1117", height: '100%', overflowY: 'auto' }}>
        {/* Top Report Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #1e2535' }}>
           <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
               <button onClick={() => setActivePanel("description")} style={{background: 'transparent', border: 'none', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600}}>
                   <IconArrowLeft size={16} /> Back
               </button>
               <div style={{width: 1, height: 16, background: '#1e2535'}}></div>
               <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                  <IconCode size={16} color="#ef4444" />
                  <span style={{color: '#e2e8f0', fontSize: 16, fontWeight: 700}}>Performance Report — {mock.question}</span>
               </div>
           </div>
           
           <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
               <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end'}}>
                   <span style={{color: passedCount === mock.testCases.length ? '#4ade80' : '#f59e0b', fontSize: 13, fontWeight: 800}}>
                     {passedCount}/{mock.testCases.length} Passed {Math.round((passedCount || 0) / mock.testCases.length * 100)}%
                   </span>
                   <span style={{color: '#9ca3af', fontSize: 11}}>
                     {passedCount === mock.testCases.length ? 'Excellent Work' : 'Needs Improvement'}
                   </span>
               </div>
               <button onClick={() => { setActivePanel("description"); setReportData(null); }} style={{background: '#1e1e2e', border: '1px solid #1e2535', color: '#818cf8', padding: '6px 14px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 700}}>
                   ⟳ Re-analyse
               </button>
           </div>
        </div>

        {/* Tabs */}
        <div style={{display: 'flex', gap: 24, padding: '0 24px', borderBottom: '1px solid #1e2535', marginTop: 16}}>
            <div style={{color: '#fff', fontSize: 13, fontWeight: 700, paddingBottom: 12, borderBottom: '2px solid #ef4444', display: 'flex', alignItems: 'center', gap: 6}}>
                <IconPanelLeft size={16} color="#ef4444" /> Overview
            </div>
            <div style={{color: '#6b7280', fontSize: 13, fontWeight: 600, paddingBottom: 12, display: 'flex', alignItems: 'center', gap: 6}}>
                <IconTerminal size={14} /> Test Cases ({passedCount}/{mock.testCases.length})
            </div>
            <div style={{color: '#6b7280', fontSize: 13, fontWeight: 600, paddingBottom: 12, display: 'flex', alignItems: 'center', gap: 6}}>
                Skill Analysis
            </div>
        </div>

        {/* Main Content Area */}
        <div style={{padding: '32px 24px', maxWidth: 1000, margin: '0 auto', width: '100%'}}>
             {/* 3 columns STATS */}
             <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', border: '1px solid #1e2535', borderRadius: 8, overflow: 'hidden', marginBottom: 32}}>
                 <div style={{padding: '24px', background: '#0d1117', textAlign: 'center', borderRight: '1px solid #1e2535'}}>
                     <p style={{color: '#6b7280', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8}}>Test Cases</p>
                     <p style={{color: passedCount === mock.testCases.length ? '#4ade80' : '#f59e0b', fontSize: 32, fontWeight: 300, margin: 0, lineHeight: 1}}>
                         <span style={{fontWeight: 700}}>{passedCount}</span> <span style={{fontSize: 20, color: '#4b5563'}}>/ {mock.testCases.length}</span>
                     </p>
                     <p style={{color: '#4b5563', fontSize: 12, marginTop: 8}}>passed</p>
                 </div>
                 <div style={{padding: '24px', background: '#0d1117', textAlign: 'center', borderRight: '1px solid #1e2535'}}>
                     <p style={{color: '#6b7280', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8}}>Score</p>
                     <p style={{color: '#818cf8', fontSize: 32, fontWeight: 300, margin: 0, lineHeight: 1}}>
                         <span style={{fontWeight: 700}}>{Math.round((passedCount || 0) / mock.testCases.length * 100)}%</span>
                     </p>
                     <p style={{color: '#4b5563', fontSize: 12, marginTop: 8}}>overall</p>
                 </div>
                 <div style={{padding: '24px', background: '#0d1117', textAlign: 'center'}}>
                     <p style={{color: '#6b7280', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8}}>Skill Gaps</p>
                     <p style={{color: reportData.lagging_skills.length > 0 ? '#f59e0b' : '#4ade80', fontSize: 32, fontWeight: 700, margin: 0, lineHeight: 1}}>
                         {reportData.lagging_skills.length}
                     </p>
                     <p style={{color: '#4b5563', fontSize: 12, marginTop: 8}}>identified</p>
                 </div>
             </div>

             <h3 style={{color: '#f59e0b', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8}}>Overall Assessment</h3>
             <p style={{color: '#d1d5db', fontSize: 14, fontStyle: 'italic', lineHeight: 1.6, marginBottom: 24}}>
                 {reportData.analysis}
             </p>

             <h3 style={{color: '#6b7280', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8}}>Skills Tested In This Problem</h3>
             <div style={{display: 'flex', gap: 12, marginBottom: 32, flexWrap: 'wrap'}}>
                 {(sectionConcepts.length > 0 ? sectionConcepts : ['Algorithmic Logic']).map(sc => (
                     <span key={sc} style={{color: '#9ca3af', fontSize: 13}}>[<span style={{color: '#38bdf8', borderBottom: '1px solid #38bdf8'}}>{sc}</span>]</span>
                 ))}
             </div>

             <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 40}}>
                   <div style={{background: 'rgba(5, 150, 105, 0.1)', border: '1px solid #059669', borderRadius: 4, padding: '16px'}}>
                       <h4 style={{color: '#34d399', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6}}>
                           <IconCheckCircle size={14} color="#34d399" /> Strengths
                       </h4>
                       <ul style={{margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8}}>
                           {reportData.strengths?.map((s: string, i: number) => (
                               <li key={i} style={{color: '#d1d5db', fontSize: 13, display: 'flex', alignItems: 'flex-start', gap: 8}}>
                                   <span style={{color: '#34d399'}}>•</span> <span style={{lineHeight: 1.4}}>{s}</span>
                               </li>
                           ))}
                       </ul>
                   </div>
                   <div style={{background: 'rgba(220, 38, 38, 0.1)', border: '1px solid #dc2626', borderRadius: 4, padding: '16px'}}>
                       <h4 style={{color: '#f87171', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6}}>
                           <IconX size={14} color="#f87171" /> Code Issues
                       </h4>
                       <ul style={{margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8}}>
                           {reportData.weaknesses?.map((w: string, i: number) => (
                               <li key={i} style={{color: '#d1d5db', fontSize: 13, display: 'flex', alignItems: 'flex-start', gap: 8}}>
                                   <span style={{color: '#f87171'}}>•</span> <span style={{lineHeight: 1.4}}>{w}</span>
                               </li>
                           ))}
                       </ul>
                   </div>
             </div>

             {reportData.lagging_skills.length > 0 && (
                 <>
                     <h3 style={{color: '#e2e8f0', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8}}>
                        <IconPanelLeft size={14} color="#e2e8f0"/> Study Priority Queue
                     </h3>
                     <p style={{color: '#6b7280', fontSize: 11, marginBottom: 14}}>Topics you struggled with — click to go directly to that section in your course plan.</p>
                     <div style={{border: '1px solid #1e2535', borderRadius: 6, overflow: 'hidden', marginBottom: 40}}>
                         {reportData.lagging_skills.map((skill: any, idx: number) => (
                             <div key={idx} style={{display: 'flex', background: idx % 2 === 0 ? '#1e1e2e' : '#161b27', borderBottom: idx < reportData.lagging_skills.length - 1 ? '1px solid #1e2535' : 'none', alignItems: 'stretch'}}>
                                 {/* Priority number */}
                                 <div style={{padding: '14px 16px', background: idx === 0 ? '#312e81' : '#1a1f2e', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 52, flexShrink: 0, borderRight: '1px solid #1e2535'}}>
                                     <span style={{color: idx === 0 ? '#fff' : '#6b7280', fontSize: 16, fontWeight: 800}}>{idx + 1}</span>
                                 </div>
                                 {/* Skill info */}
                                 <div style={{padding: '12px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'center'}}>
                                     <div style={{display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap'}}>
                                         <span style={{color: idx === 0 ? '#f87171' : '#9ca3af', fontSize: 13, fontWeight: 700}}>{skill.skill}</span>
                                         {skill.course_topic && (
                                             <span style={{fontSize: 10, padding: '2px 7px', borderRadius: 4, background: 'rgba(124,116,212,0.18)', color: '#a78bfa', fontWeight: 600, border: '1px solid rgba(124,116,212,0.25)'}}>
                                                 DSA › {skill.course_topic}
                                             </span>
                                         )}
                                     </div>
                                     <span style={{color: '#6b7280', fontSize: 11, lineHeight: 1.45}}>{skill.explanation}</span>
                                 </div>
                                 {/* Redirect button */}
                                 <div style={{padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', borderLeft: '1px solid #1e2535', flexShrink: 0, minWidth: 150}}>
                                     <button
                                         onClick={() => {
                                             const target = skill.course_topic || skill.skill;
                                                        onGoToConcept?.(target);
                                         }}
                                         style={{
                                             display: 'flex', alignItems: 'center', gap: 6,
                                             background: idx === 0 ? 'linear-gradient(135deg, #4338ca, #7c3aed)' : '#1e2535',
                                             border: idx === 0 ? '1px solid #6366f1' : '1px solid #2a3042',
                                             color: idx === 0 ? '#e0e7ff' : '#6b7280',
                                             fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                             padding: '6px 12px', borderRadius: 6,
                                             whiteSpace: 'nowrap', transition: 'all 0.15s',
                                         }}
                                         title={`Go to ${skill.course_topic || skill.skill} in the course plan`}
                                     >
                                         <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                             <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
                                         </svg>
                                         {idx === 0 ? 'Review in Course Plan →' : 'Go to Topic'}
                                     </button>
                                 </div>
                             </div>
                         ))}
                     </div>
                 </>
             )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ background: C.card, height: '100%', overflow: 'hidden' }}>
      {/* ══ TOP BAR ══ */}
      <div style={{ background: "#0d1117", padding: "0 16px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0 8px" }}>
          <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 8px", display: "flex" }}>
            <IconCode size={16} color="#7C74D4" />
          </div>
          <div style={{ flex: 1 }}>
            <span style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 15 }}>{mock.question}</span>
            &nbsp;
            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: diffStyle.bg, color: diffStyle.text }}>
              {mock.difficulty ?? "Medium"}
            </span>
          </div>
          <span style={{ color: "#6b7280", fontSize: 11, fontWeight: 600 }}>{idx + 1} / {total}</span>
        </div>
        <div style={{ display: "flex", gap: 2, paddingBottom: 0, borderBottom: "1px solid #1e2535" }}>
          {(["description", "testcase", "result"] as const).map(tab => (
            <button key={tab} onClick={() => setActivePanel(tab)}
              style={{
                fontSize: 11, fontWeight: 600, padding: "6px 14px",
                color: activePanel === tab ? "#fff" : "#6b7280",
                background: "transparent", border: "none", cursor: "pointer",
                borderBottom: activePanel === tab ? "2px solid #7C74D4" : "2px solid transparent",
                textTransform: "capitalize",
              }}>
              {tab === "result" ? (verdict && vStyle ? <span style={{ color: vStyle.bg }}>{vStyle.label}</span> : "Result") : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
          {reportData && (
            <button onClick={() => setActivePanel("report")}
              style={{
                fontSize: 11, fontWeight: 600, padding: "6px 14px",
                color: activePanel === "report" ? "#fff" : "#6b7280",
                background: "transparent", border: "none", cursor: "pointer",
                borderBottom: activePanel === "report" ? "2px solid #7C74D4" : "2px solid transparent",
              }}>
              <span style={{ color: "#3b82f6" }}>Detailed Report</span>
            </button>
          )}
        </div>
      </div>

      {/* ══ MAIN SPLIT ══ */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}>
        {/* LEFT PANEL */}
        <div className="editorial-scrollbar" style={{ width: 360, overflowY: "auto", borderRight: "1px solid #1e2535", background: "#0d1117", padding: "14px 16px" }}>
          {activePanel === "description" && (
            <div>
              <p style={{ color: "#d1d5db", fontSize: 13, lineHeight: 1.7, marginBottom: 16, whiteSpace: "pre-wrap" }}>{mock.description}</p>
              {(mock.examples ?? []).map((ex, i) => (
                <div key={i} style={{ background: "#161b27", borderRadius: 8, padding: "10px 14px", marginBottom: 10, border: "1px solid #1e2535" }}>
                  <p style={{ color: "#7C74D4", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Example {i + 1}</p>
                  <p style={{ color: "#9ca3af", fontSize: 12, fontFamily: "monospace", marginBottom: 2 }}><strong style={{ color: "#e2e8f0" }}>Input:</strong> {ex.input}</p>
                  <p style={{ color: "#9ca3af", fontSize: 12, fontFamily: "monospace", marginBottom: ex.explanation ? 4 : 0 }}><strong style={{ color: "#e2e8f0" }}>Output:</strong> {ex.output}</p>
                  {ex.explanation && <p style={{ color: "#6b7280", fontSize: 11, marginTop: 4 }}><strong>Explanation:</strong> {ex.explanation}</p>}
                </div>
              ))}
              <div style={{ marginTop: 12 }}>
                <p style={{ color: "#6b7280", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Constraints</p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {(mock.constraints ?? []).map((c, i) => (
                    <li key={i} style={{ color: "#9ca3af", fontSize: 12, display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 4 }}>
                      <span style={{ color: "#7C74D4", marginTop: 3 }}>•</span> <code style={{ color: "#e2e8f0" }}>{c}</code>
                    </li>
                  ))}
                </ul>
              </div>
              {mock.hint && (
                <div style={{ marginTop: 16, padding: "12px 14px", background: "#16472b", borderRadius: 8, border: "1px solid #166534" }}>
                  <p style={{ color: "#86efac", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
                    <IconLightbulb size={12} color="#86efac" /> Hint
                  </p>
                  <p style={{ color: "#d1fae5", fontSize: 12, lineHeight: 1.6, margin: 0 }}>{mock.hint}</p>
                </div>
              )}
            </div>
          )}

          {activePanel === "testcase" && (
            <div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
                {mock.testCases.slice(0, 5).map((tc, i) => (
                  <button key={i} onClick={() => setActiveCaseIdx(i)}
                    style={{ fontSize: 10, fontWeight: 600, padding: "4px 10px", borderRadius: 6, background: activeCaseIdx === i ? "#7C74D4" : "#161b27", color: activeCaseIdx === i ? "#fff" : "#6b7280", border: `1px solid ${activeCaseIdx === i ? "#7C74D4" : "#1e2535"}`, cursor: "pointer" }}>
                    {tc.label ?? `Case ${i + 1}`}
                  </button>
                ))}
              </div>
              {mock.testCases[activeCaseIdx] && (
                <div style={{ background: "#161b27", borderRadius: 8, padding: "12px 14px", border: "1px solid #1e2535" }}>
                  <p style={{ color: "#6b7280", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Input</p>
                  <pre style={{ color: "#e2e8f0", fontSize: 12, fontFamily: "monospace", margin: 0, whiteSpace: "pre-wrap" }}>{mock.testCases[activeCaseIdx].input}</pre>
                  <p style={{ color: "#6b7280", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginTop: 10, marginBottom: 6 }}>Expected Output</p>
                  <pre style={{ color: "#4ade80", fontSize: 12, fontFamily: "monospace", margin: 0 }}>{mock.testCases[activeCaseIdx].expected}</pre>
                </div>
              )}
            </div>
          )}

          {activePanel === "result" && (
            <div>
              {running ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "24px 0", color: "#6b7280" }}>
                  <div style={{ width: 32, height: 32, border: "3px solid #7C74D4", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  <p style={{ fontSize: 12, fontWeight: 600 }}>{runMode === "submit" ? "Running all test cases…" : "Running sample tests…"}</p>
                  <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
                </div>
              ) : testResults.length === 0 ? (
                <div style={{ color: "#374151", fontSize: 12, textAlign: "center", padding: "24px 0" }}>Click Run or Submit to see results.</div>
              ) : (
                <div>
                  {vStyle && (
                    <div style={{ background: vStyle.bg, borderRadius: 8, padding: "10px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
                      {verdict === "accepted" ? <IconCheckCircle size={20} color="#fff" /> : <span style={{ fontSize: 18 }}>✗</span>}
                      <div>
                        <p style={{ color: vStyle.text, fontWeight: 800, fontSize: 14, margin: 0 }}>{vStyle.label}</p>
                        {runMode === "submit" && passedCount !== null && (
                          <p style={{ color: vStyle.text, fontSize: 11, margin: 0, opacity: 0.85 }}>{passedCount} / {mock.testCases.length} test cases passed</p>
                        )}
                      </div>
                    </div>
                  )}
                  {verdict === "accepted" && totalRuntime && (
                    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                      <div style={{ background: "#161b27", borderRadius: 8, padding: "8px 12px", flex: 1, border: "1px solid #1e2535" }}>
                        <p style={{ color: "#6b7280", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, margin: 0, marginBottom: 2 }}>Runtime</p>
                        <p style={{ color: "#4ade80", fontSize: 16, fontWeight: 800, margin: 0 }}>{totalRuntime} ms</p>
                      </div>
                      {totalMemory && (
                        <div style={{ background: "#161b27", borderRadius: 8, padding: "8px 12px", flex: 1, border: "1px solid #1e2535" }}>
                          <p style={{ color: "#6b7280", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, margin: 0, marginBottom: 2 }}>Memory</p>
                          <p style={{ color: "#60a5fa", fontSize: 16, fontWeight: 800, margin: 0 }}>{(totalMemory / 1024).toFixed(1)} MB</p>
                        </div>
                      )}
                    </div>
                  )}
                  {testResults.map((r, i) => (
                    <div key={i} style={{ background: "#161b27", borderRadius: 8, padding: "10px 14px", marginBottom: 8, border: `1px solid ${r.passed ? "#166534" : "#7f1d1d"}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 13 }}>{r.passed ? "✅" : "❌"}</span>
                        <span style={{ color: "#e2e8f0", fontSize: 11, fontWeight: 700 }}>{r.caseLabel}</span>
                        <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 99, fontWeight: 700, background: r.passed ? "#14532d" : "#450a0a", color: r.passed ? "#86efac" : "#fca5a5" }}>{r.status}</span>
                        {r.runtime && <span style={{ color: "#6b7280", fontSize: 10, marginLeft: "auto" }}>{(parseFloat(r.runtime)*1000).toFixed(0)}ms</span>}
                      </div>
                      {!r.passed && (
                        <div style={{ fontSize: 11, fontFamily: "monospace" }}>
                          <div><span style={{ color: "#6b7280" }}>Expected: </span><span style={{ color: "#86efac" }}>{r.expected}</span></div>
                          {r.stdout && <div style={{ marginTop: 3 }}><span style={{ color: "#6b7280" }}>Got: </span><span style={{ color: "#fca5a5" }}>{r.stdout.trim()}</span></div>}
                          {r.compileOutput && <div style={{ color: "#f87171", whiteSpace: "pre-wrap", marginTop: 6 }}><strong>Compile Error:</strong>{"\n"}{r.compileOutput}</div>}
                          {r.stderr && !r.compileOutput && <div style={{ color: "#f87171", whiteSpace: "pre-wrap", marginTop: 6 }}>{r.stderr.slice(0, 200)}</div>}
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {runMode === "submit" && testResults.length > 0 && (
                    <div style={{ marginTop: 20 }}>
                      <button 
                        onClick={() => {
                          if (reportData) {
                            setActivePanel("report");
                            return;
                          }
                          
                          const passedCount = testResults.filter(r => r.passed).length;
                          const totalCount = testResults.length;
                          let lagging_skills = [];
                          let analysisChunks = [];
                          let strengths = [];
                          let weaknesses = [];

                          const hasCompileError = testResults.some(r => r.compileOutput);
                          const hasTLE = testResults.some(r => r.status && r.status.toLowerCase().includes("time limit"));
                          const hasMLE = testResults.some(r => r.status && r.status.toLowerCase().includes("memory limit"));
                          const hasRuntimeError = testResults.some(r => r.stderr && !r.compileOutput);
                          const hasWrongAnswer = testResults.some(r => !r.passed && !r.compileOutput && !r.stderr && !(r.status && r.status.toLowerCase().includes("limit")));

                          if (!hasCompileError) {
                              strengths.push("Code compiled without errors");
                          }
                          if (passedCount > 0) {
                              strengths.push(`Passed ${passedCount} out of ${totalCount} test cases`);
                              if (!hasWrongAnswer && !hasCompileError && !hasRuntimeError) {
                                  strengths.push("Correct output format handling");
                              }
                          }

                          if (passedCount === totalCount) {
                            analysisChunks.push(`Brilliant! You successfully passed all ${totalCount} test cases. Your logic and edge case handling are solid.`);
                            strengths.push("Optimal algorithmic design");
                            strengths.push("Accounted for all edge cases");
                          } else {
                            if (passedCount === 0) weaknesses.push("Did not pass any basic test cases");
                            analysisChunks.push(`You passed ${passedCount} out of ${totalCount} test cases.`);
                            
                            const sc = sectionConcepts.join(" ").toLowerCase();

                            // Helper: map a skill keyword to the exact DSA course section title
                            const mapSkillToCourseTopic = (skillName: string): string => {
                              const s = skillName.toLowerCase();
                              if (s.includes("time") || s.includes("complexity") || s.includes("big o")) return "Time & Space Complexity";
                              if (s.includes("space") || s.includes("memory")) return "Time & Space Complexity";
                              if (s.includes("array") || s.includes("string") || s.includes("two sum") || s.includes("hash map") || s.includes("two pointer") || s.includes("kadane") || s.includes("subarray")) return "Arrays & Strings";
                              if (s.includes("tree") || s.includes("graph") || s.includes("bfs") || s.includes("dfs") || s.includes("traversal") || s.includes("bst")) return "Trees & Graphs";
                              if (s.includes("dp") || s.includes("dynamic") || s.includes("knapsack") || s.includes("fibonacci") || s.includes("memoization")) return "Dynamic Programming";
                              if (s.includes("exception") || s.includes("error") || s.includes("runtime") || s.includes("syntax") || s.includes("compile")) return "Arrays & Strings";
                              // Check sectionConcepts for a match
                              for (const concept of sectionConcepts) {
                                const c = concept.toLowerCase();
                                if (c.includes("array") || c.includes("string") || c.includes("two sum") || c.includes("hash")) return "Arrays & Strings";
                                if (c.includes("tree") || c.includes("graph") || c.includes("traversal")) return "Trees & Graphs";
                                if (c.includes("dp") || c.includes("dynamic")) return "Dynamic Programming";
                                if (c.includes("complexity") || c.includes("time") || c.includes("space") || c.includes("big o")) return "Time & Space Complexity";
                              }
                              return "Arrays & Strings";
                            };

                            if (hasCompileError) {
                              analysisChunks.push("Your code has compilation errors, indicating a gap in language syntax.");
                              const courseTopic = mapSkillToCourseTopic("syntax");
                              lagging_skills.push({ skill: "Language Syntax", explanation: "Compilation errors prevent code from running. Check your types, brackets, and syntax.", in_course: sectionConcepts.length > 0, course_topic: courseTopic });
                              weaknesses.push("Syntax or compilation error");
                            }
                            if (hasRuntimeError) {
                              analysisChunks.push("Your code crashed with a Runtime Error.");
                              const courseTopic = mapSkillToCourseTopic("exception");
                              lagging_skills.push({ skill: "Exception Handling", explanation: "Runtime errors occur due to unhandled edge cases like null references or index out of bounds.", in_course: sc.includes("exception") || sc.includes("error"), course_topic: courseTopic });
                              weaknesses.push("Unhandled runtime exceptions");
                            }
                            if (hasTLE) {
                              analysisChunks.push("Your solution exceeded the time limit (TLE).");
                              const courseTopic = mapSkillToCourseTopic("time complexity");
                              lagging_skills.push({ skill: "Time Complexity", explanation: "Your algorithm is too slow for large inputs. Consider optimizing with a hash map or two-pointer approach.", in_course: true, course_topic: courseTopic });
                              weaknesses.push("Time Limit Exceeded — inefficient approach (likely O(n²))");
                            }
                            if (hasMLE) {
                              analysisChunks.push("Your solution exceeded the memory limit (MLE).");
                              const courseTopic = mapSkillToCourseTopic("space complexity");
                              lagging_skills.push({ skill: "Space Complexity", explanation: "Your algorithm uses too much memory. Avoid creating large intermediate structures.", in_course: true, course_topic: courseTopic });
                              weaknesses.push("Memory limit exceeded due to space issues");
                            }
                            if (hasWrongAnswer) {
                              analysisChunks.push("Your code yields the wrong output for some scenarios.");
                              const logicSkill = sectionConcepts.length > 0 ? sectionConcepts[0] : "Algorithmic Logic";
                              const courseTopic = mapSkillToCourseTopic(logicSkill);
                              lagging_skills.push({ skill: logicSkill, explanation: "The core logic does not cover all edge cases or inputs. Review the topic in your DSA course plan.", in_course: true, course_topic: courseTopic });
                              weaknesses.push("Edge cases failed on specific inputs");
                            }
                          }

                          setReportData({
                            analysis: analysisChunks.join(" "),
                            lagging_skills,
                            strengths,
                            weaknesses
                          });
                          setActivePanel("report");
                        }}
                        style={{ width: "100%", padding: "10px", borderRadius: 8, background: "#3b82f6", color: "#fff", fontWeight: 700, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                      >
                         <IconLightbulb size={16} /> View Detailed Report
                      </button>
                    </div>
                  )}

                </div>
              )}
            </div>
          )}

          {activePanel === "report" && reportData && (
            <div>
               <div style={{ background: "#161b27", borderRadius: 8, padding: "14px", border: "1px solid #1e2535", marginBottom: 12 }}>
                 <p style={{ color: "#3b82f6", fontSize: 13, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                   <IconLightbulb size={16} /> Performance Analysis
                 </p>
                 <p style={{ color: "#d1d5db", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                   {reportData.analysis}
                 </p>
               </div>
               
               <p style={{ color: "#6b7280", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Skill Gaps Detected</p>
               {reportData.lagging_skills.length === 0 ? (
                 <p style={{ color: "#9ca3af", fontSize: 12 }}>No significant skill gaps detected.</p>
               ) : (
                 <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                   {reportData.lagging_skills.map((skill: any, idx: number) => (
                     <div key={idx} style={{ background: "#161b27", borderRadius: 8, padding: "12px", border: "1px solid #1e2535", borderLeft: `3px solid ${skill.in_course ? "#f59e0b" : "#ef4444"}` }}>
                       <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                         <span style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 700 }}>{skill.skill}</span>
                         {!skill.in_course && (
                           <span 
                             onClick={() => onGoToConcept?.(skill.skill)}
                             style={{ background: "#450a0a", color: "#fca5a5", fontSize: 9, padding: "3px 8px", borderRadius: 4, fontWeight: 700, cursor: onGoToConcept ? "pointer" : "default" }}
                             title="Click to search for this concept in the study plan or externally"
                           >
                             External Source Path 🌐
                           </span>
                         )}
                         {skill.in_course && (
                           <span 
                             onClick={() => onGoToConcept?.(skill.skill)}
                             style={{ background: "#451a03", color: "#fcd34d", fontSize: 9, padding: "3px 8px", borderRadius: 4, fontWeight: 700, cursor: onGoToConcept ? "pointer" : "default" }}
                             title="Click to jump to this concept in the study plan"
                           >
                             Review in Course Plan ➡️
                           </span>
                         )}
                       </div>
                       <p style={{ color: "#9ca3af", fontSize: 12, lineHeight: 1.5, margin: 0 }}>{skill.explanation}</p>
                     </div>
                   ))}
                 </div>
               )}
            </div>
          )}

        </div>


        {/* RIGHT PANEL: Editor */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#1e1e2e", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", background: "#13131e", borderBottom: "1px solid #1e2535", flexShrink: 0 }}>
            {templates.map((t, i) => (
              <button key={t.id} onClick={() => setActiveLangIdx(i)}
                style={{ fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 6, background: activeLangIdx === i ? "#7C74D4" : "#161b27", color: activeLangIdx === i ? "#fff" : "#6b7280", border: `1px solid ${activeLangIdx === i ? "#7C74D4" : "#1e2535"}`, cursor: "pointer", transition: "all 0.15s" }}>
                {t.label}
              </button>
            ))}
            <button onClick={() => setCurrentCode(lang.code)}
              style={{ fontSize: 10, color: "#6b7280", background: "transparent", border: "none", cursor: "pointer", marginLeft: "auto", padding: "4px 8px" }}>
              Reset
            </button>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <MonacoEditor
              height="100%"
              language={lang.monacoLang}
              theme="vs-dark"
              value={currentCode}
              onChange={v => setCurrentCode(v ?? "")}
              options={{ fontSize: 13, minimap: { enabled: false }, scrollBeyondLastLine: false, wordWrap: "on", lineNumbers: "on", tabSize: 4, automaticLayout: true, padding: { top: 12 }, fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontLigatures: true, smoothScrolling: true, cursorSmoothCaretAnimation: "on" }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "#13131e", borderTop: "1px solid #1e2535", flexShrink: 0 }}>
            <button onClick={() => setActivePanel("testcase")} style={{ fontSize: 11, color: "#6b7280", background: "transparent", border: "none", cursor: "pointer", marginRight: "auto" }}>Console</button>
            <button onClick={handleRun} disabled={running}
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, padding: "7px 18px", borderRadius: 8, background: running ? "#374151" : "#1e2535", color: running ? "#6b7280" : "#d1d5db", border: "1px solid #374151", cursor: running ? "not-allowed" : "pointer" }}>
              <IconPlay size={11} />{running && runMode === "run" ? "Running…" : "Run"}
            </button>
            <button onClick={handleSubmit} disabled={running}
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, padding: "7px 18px", borderRadius: 8, background: running ? "#374151" : C.green, color: "#fff", border: "none", cursor: running ? "not-allowed" : "pointer" }}>
              {running && runMode === "submit" ? "Submitting…" : "Submit"}
            </button>
          </div>
        </div>
      </div>

      {/* BOTTOM NAV */}
      <div className="px-5 py-3 border-t flex items-center justify-between gap-3 shrink-0"
        style={{ borderColor: C.border, background: C.surface }}>
        <button onClick={onPrev} disabled={isFirst}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold transition-all"
          style={{ background: isFirst ? "#F3F4F6" : C.card, color: isFirst ? "#D1D5DB" : C.navy, border: `1px solid ${isFirst ? "#E5E7EB" : C.border}`, opacity: isFirst ? 0.6 : 1, cursor: isFirst ? "not-allowed" : "pointer" }}>
          <IconArrowLeft size={14} /> Prev
        </button>
        <span className="text-[12px] font-semibold" style={{ color: C.muted }}>{idx + 1} / {total}</span>
        {isLast ? (
          <button onClick={hasQuiz ? onGoToQuiz : onCompleteSection}
            disabled={!hasQuiz && passedCount === 0}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-[12px] font-bold text-white transition-all hover:opacity-90"
            style={{ background: !hasQuiz && passedCount === 0 ? "#d1d5db" : C.navy, cursor: !hasQuiz && passedCount === 0 ? "not-allowed" : "pointer", opacity: !hasQuiz && passedCount === 0 ? 0.6 : 1 }}>
            {hasQuiz ? "Take Quiz" : "Complete"} <IconArrowRight size={14} />
          </button>
        ) : (
          <button onClick={onNext}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-[12px] font-bold text-white transition-all hover:opacity-90"
            style={{ background: C.navy }}>
            Next <IconArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  CODING FULL PAGE OVERLAY — opens when "Open Coding Environment" is clicked
 * ───────────────────────────────────────────────────────────────────────────── */

interface CodingFullPageProps {
  section: Section;
  onClose: () => void;
  onComplete: () => void;
  onSkip: () => void;
  onGoToConcept?: (concept: string) => void;
}

function CodingFullPage({ section, onClose, onComplete, onSkip, onGoToConcept }: CodingFullPageProps) {
  const mocks = section.codingMocks || [];
  const [mockIdx, setMockIdx] = useState(0);

  if (mocks.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#0d1117',
      display: 'flex', flexDirection: 'column',
      fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
    }}>
      <style>{editorialStyles}</style>

      {/* Top navigation bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '0 20px', height: 52,
        background: '#161b27',
        borderBottom: '1px solid #1e2535',
        flexShrink: 0,
      }}>
        {/* Back button */}
        <button onClick={onClose}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            color: '#9ca3af', background: 'transparent', border: 'none',
            cursor: 'pointer', fontSize: 13, fontWeight: 600,
            padding: '6px 10px', borderRadius: 6,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#1e2535')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <IconArrowLeft size={14} /> Back to Study Plan
        </button>

        <div style={{ width: 1, height: 20, background: '#1e2535' }} />

        {/* Section title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ background: 'rgba(124,116,212,0.2)', borderRadius: 6, padding: '4px 6px', display: 'flex' }}>
            <IconTerminal size={14} color="#7C74D4" />
          </div>
          <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 14 }}>{section.title}</span>
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(5,150,105,0.2)', color: '#86efac', fontWeight: 700 }}>
            Live Sandbox
          </span>
        </div>

        {/* Mock selector tabs (if multiple mocks) */}
        {mocks.length > 1 && (
          <>
            <div style={{ width: 1, height: 20, background: '#1e2535', marginLeft: 4 }} />
            <div style={{ display: 'flex', gap: 4 }}>
              {mocks.map((m, i) => (
                <button key={i} onClick={() => setMockIdx(i)}
                  style={{
                    fontSize: 11, fontWeight: 700, padding: '4px 14px', borderRadius: 6,
                    background: mockIdx === i ? '#7C74D4' : '#1e2535',
                    color: mockIdx === i ? '#fff' : '#6b7280',
                    border: `1px solid ${mockIdx === i ? '#7C74D4' : '#2a3042'}`,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}>
                  Problem {i + 1}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Complete button (right side) */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#6b7280', fontSize: 11 }}>{mockIdx + 1} of {mocks.length} problem{mocks.length > 1 ? 's' : ''}</span>
          <button onClick={onSkip}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12, fontWeight: 700, padding: '6px 16px', borderRadius: 8,
              background: '#1e2535', color: '#e2e8f0', border: '1px solid #2a3042', cursor: 'pointer',
            }}>
            Skip Section
          </button>
        </div>
      </div>

      {/* Coding slide fills the rest */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <CodingSlide
          key={mockIdx}
          mock={mocks[mockIdx]}
          idx={mockIdx}
          total={mocks.length}
          onNext={() => mockIdx < mocks.length - 1 && setMockIdx(mockIdx + 1)}
          onPrev={() => mockIdx > 0 && setMockIdx(mockIdx - 1)}
          isFirst={mockIdx === 0}
          isLast={mockIdx === mocks.length - 1}
          hasQuiz={false}
          onGoToQuiz={() => {}}
          onCompleteSection={onComplete}
          direction="right"
          sectionConcepts={section.concepts || []}
          onGoToConcept={onGoToConcept}
        />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  MAIN PAGE
 * ───────────────────────────────────────────────────────────────────────────── */

export default function StudyPlanPage() {
  const [selectedPlanId, setSelectedPlanId] = useState("tcs");
  const [selectedModuleIdx, setSelectedModuleIdx] = useState(0);
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0);
  const [completedSections, setCompletedSections] = useState<boolean[]>([]);
  const [quizState, setQuizState] = useState<'none' | 'active' | 'submitted'>('none');
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizAnsweredIdx, setQuizAnsweredIdx] = useState<number>(-1); // Track which question is showing feedback
  const [skippedQuestions, setSkippedQuestions] = useState<Set<number>>(new Set()); // Track skipped questions
  const [moduleComplete, setModuleComplete] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [expandedModules, setExpandedModules] = useState<Record<number, boolean>>({ 0: true });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Slide state
  const [slideIdx, setSlideIdx] = useState(0);
  const [slideDirection, setSlideDirection] = useState<"right" | "left">("right");
  const [quizSlideIdx, setQuizSlideIdx] = useState(0);

  // ── NEW: Coding full page overlay state ──────────────────────
  const [codingFullPageSection, setCodingFullPageSection] = useState<Section | null>(null);
  const [jumpSectionIdx, setJumpSectionIdx] = useState<number | null>(null);

  const handleJumpToConcept = (topic: string) => {
    const searchTopic = topic.toLowerCase();
    const planModules = PLAN_MODULES[activePlan.company] ?? PLAN_MODULES["TCS"];
    for (let m = 0; m < planModules.length; m++) {
      const sects = getSections(planModules[m].title || "");
      for (let s = 0; s < sects.length; s++) {
         const conceptList = sects[s].concepts || [];
         const hasConcept = conceptList.some((c: string) => c.toLowerCase().includes(searchTopic) || searchTopic.includes(c.toLowerCase()));
         if (hasConcept || sects[s].title.toLowerCase().includes(searchTopic)) {
            setCodingFullPageSection(null);
            setSelectedModuleIdx(m);
            setExpandedModules(prev => ({...prev, [m]: true}));
            if (m === selectedModuleIdx) {
               setCurrentSectionIdx(s);
               setSlideIdx(0);
               setSlideDirection("right");
            } else {
               setJumpSectionIdx(s);
            }
            return;
         }
      }
    }
    // Fallback: If exact topic not found, provide an external learning path
    const extUrl = `https://www.google.com/search?q=${encodeURIComponent(topic + " programming concepts tutorial")}`;
    window.open(extUrl, "_blank");
  };


  // ── SCORM state ──────────────────────────────────────────────
  const [scormLoading, setScormLoading] = useState(true);
  const [passedSet, setPassedSet] = useState<Set<string>>(new Set());
  const [studentId, setStudentId] = useState<number | null>(null);
  const [planId, setPlanId] = useState<number | null>(null);
  const sectionStartRef = useRef<number>(Date.now());

  // ── Quiz countdown timer ─────────────────────────────────────
  useEffect(() => {
    if (quizState === 'active' && timeLeft !== null && timeLeft > 0) {
      const id = setInterval(() => setTimeLeft(prev => (prev !== null ? prev - 1 : prev)), 1000);
      return () => clearInterval(id);
    } else if (quizState === 'active' && timeLeft === 0) {
      setQuizState('submitted');
    }
  }, [quizState, timeLeft]);

  const formatTime = (seconds: number | null) => {
    if (seconds === null) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // ── Boot: load student_id, plan_id, then SCORM progress ──────
  useEffect(() => {
    const sid = Number(sessionStorage.getItem("student_id"));
    const tid = Number(sessionStorage.getItem("target_id"));
    const storedCompany = sessionStorage.getItem("company_name") ?? "";

    if (!sid) { setScormLoading(false); return; }
    setStudentId(sid);

    if (storedCompany) {
      const matched = ALL_PLANS.find(p => p.company.toLowerCase() === storedCompany.toLowerCase());
      if (matched) setSelectedPlanId(matched.id);
    }

    if (!tid) { setScormLoading(false); return; }

    getLatestPrep(sid, tid)
      .then(async (plan) => {
        const pid = plan.plan_id;
        setPlanId(pid);
        const [summary, progress] = await Promise.all([
          fetchScormSummary(sid, pid).catch(() => null),
          fetchScormProgress(sid, pid).catch(() => ({ sections: [] as ScormSectionItem[] })),
        ]);
        const rows = progress.sections;
        const ps = buildPassedSet(rows);
        setPassedSet(ps);
        if (summary && summary.completion_status !== "not_attempted") {
          setSelectedModuleIdx(summary.last_accessed_module);
          setExpandedModules({ [summary.last_accessed_module]: true });
        }
      })
      .catch(() => { })
      .finally(() => setScormLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activePlan = ALL_PLANS.find(p => p.id === selectedPlanId) ?? ALL_PLANS[0];
  const modules = PLAN_MODULES[activePlan.company] ?? PLAN_MODULES["TCS"];
  const currentModule = modules[selectedModuleIdx];
  const sections = getSections(currentModule?.title || "");

  // ── Restore per-section completion when module/plan changes ──
  useEffect(() => {
    const restored = sections.map((_, sIdx) => passedSet.has(`${selectedModuleIdx}-${sIdx}`));
    setCompletedSections(restored);
    const firstIncomplete = restored.findIndex(v => !v);
    const resumeAt = firstIncomplete === -1 ? sections.length - 1 : firstIncomplete;
    
    if (jumpSectionIdx !== null) {
      setCurrentSectionIdx(jumpSectionIdx);
      setJumpSectionIdx(null);
    } else {
      setCurrentSectionIdx(resumeAt);
    }
    
    setQuizState('none');
    setQuizAnswers({});
    setQuizAnsweredIdx(-1);
    setSkippedQuestions(new Set());
    setModuleComplete(firstIncomplete === -1 && sections.length > 0);
    setTimeLeft(null);
    setSlideIdx(0);
    setSlideDirection("right");
    setQuizSlideIdx(0);
    sectionStartRef.current = Date.now();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModuleIdx, selectedPlanId, passedSet]);

  useEffect(() => {
    sectionStartRef.current = Date.now();
    if (studentId !== null && planId !== null) {
      updateBookmark(studentId, planId, selectedModuleIdx, currentSectionIdx);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSectionIdx]);

  const handleSelectPlan = (plan: typeof ALL_PLANS[0]) => {
    if (plan.expired) return;
    setSelectedPlanId(plan.id);
    setSelectedModuleIdx(0);
    setExpandedModules({ 0: true });
  };

  const currentSection = sections[currentSectionIdx];
  const qLen = currentSection?.questions?.length || 0;
  const cLen = currentSection?.codingMocks?.length || 0;
  const hasIntro = !!(currentSection?.coverImage);
  // For coding sections, totalQs is just 1 (intro only — coding opens in full page)
  const isCodingSection = cLen > 0 && qLen === 0;
  const totalQs = isCodingSection ? 1 : (hasIntro ? 1 : 0) + qLen;

  const handleStartQuiz = () => {
    setQuizAnswers({});
    setQuizAnsweredIdx(-1);
    setSkippedQuestions(new Set());
    setQuizState('active');
    setQuizSlideIdx(0);
    setTimeLeft((currentSection?.quiz?.length || 0) * 60);
  };

  const handlePickAnswer = (qIdx: number, optIdx: number) => {
    if (quizState !== 'active') return;
    setQuizAnswers(prev => ({ ...prev, [qIdx]: optIdx }));
    setQuizAnsweredIdx(qIdx); // Show feedback immediately for this question
  };

  const handleSkipQuestion = () => {
    setSkippedQuestions(prev => new Set([...prev, quizSlideIdx]));
    // Move to next question or submit if last
    if (quizSlideIdx < currentQuiz.length - 1) {
      setQuizSlideIdx(quizSlideIdx + 1);
      setQuizAnsweredIdx(-1); // Reset feedback state for next question
    } else {
      handleSubmitQuiz();
    }
  };

  const handleSubmitQuiz = () => setQuizState('submitted');

  const currentQuiz = currentSection?.quiz || [];
  const quizScore = quizState === 'submitted'
    ? currentQuiz.filter((q, i) => quizAnswers[i] === q.correctIndex).length
    : 0;
  const quizPassed = quizState === 'submitted' && quizScore >= Math.ceil(currentQuiz.length / 2);

  const totalSectionsInPlan = modules.reduce((sum, mod) => sum + getSections(mod.title).length, 0);

  const handleProceed = async () => {
    const elapsedSeconds = Math.round((Date.now() - sectionStartRef.current) / 1000);
    const updated = [...completedSections];
    updated[currentSectionIdx] = true;
    setCompletedSections(updated);
    const newPassedSet = new Set(passedSet);
    newPassedSet.add(`${selectedModuleIdx}-${currentSectionIdx}`);
    setPassedSet(newPassedSet);

    if (studentId !== null && planId !== null) {
      reportSectionComplete({
        plan_id: planId, student_id: studentId,
        module_index: selectedModuleIdx, section_index: currentSectionIdx,
        section_title: currentSection?.title ?? "",
        status: (quizPassed || currentQuiz.length === 0) ? "passed" : "failed",
        score_raw: quizScore, score_max: currentQuiz.length,
        time_spent_seconds: elapsedSeconds,
        total_modules: modules.length, total_sections: totalSectionsInPlan,
      }).catch(() => { });
    }

    if (currentSectionIdx < sections.length - 1) {
      setCurrentSectionIdx(currentSectionIdx + 1);
      setQuizState('none'); setQuizAnswers({}); setQuizAnsweredIdx(-1); setSkippedQuestions(new Set()); setTimeLeft(null);
      setSlideIdx(0); setSlideDirection("right"); setQuizSlideIdx(0);
    } else {
      setModuleComplete(true);
    }
  };

  const handleNavSection = (idx: number) => {
    if (idx <= currentSectionIdx || completedSections[idx]) {
      setCurrentSectionIdx(idx);
      setQuizState('none'); setQuizAnswers({}); setQuizAnsweredIdx(-1); setSkippedQuestions(new Set()); setTimeLeft(null);
      setSlideIdx(0); setSlideDirection("right"); setQuizSlideIdx(0);
    }
  };

  const getModuleProgress = (modIdx: number) => {
    const modSections = getSections(modules[modIdx]?.title || "");
    if (modSections.length === 0) return 0;
    const passed = modulePassedCount(passedSet, modIdx, modSections.length);
    return Math.round((passed / modSections.length) * 100);
  };

  // Slide navigation
  const goToNextSlide = () => {
    if (slideIdx < totalQs - 1) { setSlideDirection("right"); setSlideIdx(slideIdx + 1); }
  };
  const goToPrevSlide = () => {
    if (slideIdx > 0) { setSlideDirection("left"); setSlideIdx(slideIdx - 1); }
  };

  // ── Coding full page handlers ────────────────────────────────
  const handleOpenCoding = () => {
    if (currentSection) setCodingFullPageSection(currentSection);
  };
  const handleCloseCoding = () => setCodingFullPageSection(null);
  const handleCompleteCoding = () => {
    setCodingFullPageSection(null);
    // If the section has a quiz, start it; otherwise proceed
    if (currentQuiz.length > 0) {
      handleStartQuiz();
    } else {
      handleProceed();
    }
  };

  const handleSkipCoding = () => {
    setCodingFullPageSection(null);
    setQuizState('none'); setQuizAnswers({}); setQuizAnsweredIdx(-1); setSkippedQuestions(new Set()); setTimeLeft(null);
    if (currentSectionIdx < sections.length - 1) {
      setCurrentSectionIdx(currentSectionIdx + 1);
      setSlideIdx(0); setSlideDirection("right"); setQuizSlideIdx(0);
    } else {
      setSlideIdx(0); setQuizSlideIdx(0);
    }
  };

  return (
    <>
      {/* ─── CODING FULL PAGE OVERLAY ─── */}
      {codingFullPageSection && (
        <CodingFullPage
          section={codingFullPageSection}
          onClose={handleCloseCoding}
          onComplete={handleCompleteCoding}
          onSkip={handleSkipCoding}
          onGoToConcept={handleJumpToConcept}
        />
      )}

      <div className="h-full flex flex-col" style={{ fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}>
        <style>{editorialStyles}</style>
        <div className="w-full h-full flex flex-col overflow-hidden">

          {scormLoading && (
            <div className="flex items-center gap-2 mb-3 text-[12px] font-medium" style={{ color: C.purple }}>
              <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30" strokeLinecap="round" />
              </svg>
              Syncing progress...
            </div>
          )}


          {/* Company + Plan selector bar */}
          <div className="flex gap-3 mb-4 shrink-0">
            <div className="flex-1 flex items-center gap-4 px-4 py-2.5 rounded-xl border" style={{ borderColor: C.border, background: C.card }}>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.muted }}>Company</p>
                <p className="text-[14px] font-bold" style={{ color: C.heading }}>{activePlan.company}</p>
              </div>
              <div className="w-px h-8" style={{ background: C.border }} />
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.muted }}>Role</p>
                <p className="text-[14px] font-bold" style={{ color: C.heading }}>{activePlan.role}</p>
              </div>
            </div>
            {ALL_PLANS.filter(p => !p.expired).map(plan => (
              <button key={plan.id} onClick={() => handleSelectPlan(plan)}
                className="shrink-0 rounded-xl border px-4 py-2.5 transition-all text-left"
                style={{ borderColor: plan.id === selectedPlanId ? C.purple : C.border, background: plan.id === selectedPlanId ? C.purpleBg : C.card }}>
                <p className="text-[12px] font-bold" style={{ color: plan.id === selectedPlanId ? C.purple : C.heading }}>{plan.company}</p>
                <p className="text-[10px] mt-0.5" style={{ color: C.muted }}>{plan.role}</p>
              </button>
            ))}
          </div>

          {/* Main split layout — overflow-hidden: NO outer scrolling */}
          <div className="flex gap-5 overflow-hidden" style={{ flex: 1, minHeight: 0 }}>

            {/* ═══ LEFT: Module Tree Sidebar ═══ */}
            <div className={`${isSidebarCollapsed ? "w-[48px]" : "w-[280px]"} shrink-0 flex flex-col overflow-y-auto editorial-scrollbar pb-4 transition-[width] duration-300 ease-in-out`}>
              <div className={`rounded-xl border ${isSidebarCollapsed ? "p-2 items-center flex flex-col" : "p-3"}`} style={{ borderColor: C.border, background: C.card }}>
                <div className={`flex items-center ${isSidebarCollapsed ? "justify-center w-full" : "gap-2 mb-3"}`}>
                  <button
                    onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    className="hover:opacity-70 transition-opacity p-1 rounded hover:bg-gray-100"
                    style={{ color: C.muted }}
                    title={isSidebarCollapsed ? "Expand" : "Collapse"}>
                    <IconPanelLeft size={16} />
                  </button>
                  {!isSidebarCollapsed && (
                    <p className="text-[9px] font-bold tracking-widest uppercase m-0" style={{ color: C.muted }}>
                      {activePlan.company} Modules
                    </p>
                  )}
                </div>

                {!isSidebarCollapsed && (
                  <div className="space-y-1.5 w-full">
                    {modules.map((mod, idx) => {
                      const isActive = idx === selectedModuleIdx;
                      const isExpanded = !!expandedModules[idx];
                      const modSections = getSections(mod.title);
                      const modProgress = getModuleProgress(idx);
                      const isComplete = modProgress === 100;

                      const handleModuleClick = () => {
                        if (!isActive) { setSelectedModuleIdx(idx); setExpandedModules(prev => ({ ...prev, [idx]: true })); }
                        else { setExpandedModules(prev => ({ ...prev, [idx]: !isExpanded })); }
                      };

                      return (
                        <div key={idx}>
                          <button onClick={handleModuleClick}
                            className="w-full text-left rounded-lg border px-3 py-2.5 transition-all flex items-center gap-3"
                            style={{ borderColor: isActive ? C.purple : C.border, background: isActive ? C.purpleBg : C.card }}>
                            <div className="flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold shrink-0"
                              style={{ background: isComplete ? C.green : isActive ? C.navy : "#F3F4F6", color: (isComplete || isActive) ? "#fff" : C.muted }}>
                              {isComplete ? <IconCheck size={14} color="#fff" /> : idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p className="text-[12px] font-bold truncate" style={{ color: isActive ? C.purple : C.heading }}>{mod.title}</p>
                                <span className="text-[10px] font-bold ml-2 shrink-0" style={{ color: modProgress > 0 ? C.green : C.muted }}>{modProgress}%</span>
                              </div>
                              <p className="text-[10px]" style={{ color: C.muted }}>{mod.sub}</p>
                              <div className="h-1 w-full rounded-full mt-1.5 overflow-hidden" style={{ background: "#E5E7EB" }}>
                                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${modProgress}%`, background: modProgress === 0 ? "#E5E7EB" : C.green }} />
                              </div>
                            </div>
                            <IconChevron size={14} className={`shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                          </button>

                          {isExpanded && isActive && (
                            <div className="ml-5 mt-1.5 space-y-0.5 border-l-2 pl-3" style={{ borderColor: C.purpleBg }}>
                              {modSections.map((sec, sIdx) => {
                                const isSecActive = sIdx === currentSectionIdx;
                                const isSecDone = completedSections[sIdx];
                                const isSecLocked = sIdx > currentSectionIdx && !completedSections[sIdx];
                                return (
                                  <button key={sIdx} onClick={() => handleNavSection(sIdx)} disabled={isSecLocked}
                                    className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                                    style={{ background: isSecActive ? C.purple : isSecDone ? C.greenLight : "transparent", color: isSecActive ? "#fff" : isSecDone ? C.green : isSecLocked ? "#D1D5DB" : C.muted, cursor: isSecLocked ? "not-allowed" : "pointer" }}>
                                    {isSecDone ? (
                                      <IconCheckCircle size={12} color={isSecActive ? "#fff" : C.green} />
                                    ) : isSecLocked ? (
                                      <IconLock size={11} />
                                    ) : (
                                      <span className="w-4 h-4 rounded-full text-[8px] flex items-center justify-center font-bold shrink-0"
                                        style={{ background: isSecActive ? "rgba(255,255,255,0.3)" : "#F3F4F6", color: isSecActive ? "#fff" : C.muted }}>{sIdx + 1}</span>
                                    )}
                                    <span className="truncate">{sec.title}</span>
                                    {/* Coding badge */}
                                    {(sec.codingMocks?.length ?? 0) > 0 && (
                                      <span className="ml-auto shrink-0">
                                        <IconTerminal size={10} />
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ═══ CENTER: Content Area — FIXED, NO OUTER SCROLL ═══ */}
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

              {moduleComplete ? (
                <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border" style={{ borderColor: C.border, background: C.card }}>
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: C.greenLight }}>
                    <IconCheck size={28} color={C.green} />
                  </div>
                  <h3 className="text-xl font-bold mb-2" style={{ color: C.heading }}>Module Complete!</h3>
                  <p className="text-[13px] mb-6" style={{ color: C.muted }}>You have finished all {sections.length} sections in <strong>{currentModule?.title}</strong>.</p>
                  <p className="text-[12px]" style={{ color: C.muted }}>Select the next module from the left panel to continue.</p>
                </div>
              ) : (
                <>

                  {/* ── SLIDE AREA — flex-1 with overflow-hidden: slides are fixed height ── */}
                  <div className="flex-1 min-h-0 overflow-hidden">
                    {quizState === 'none' && (
                      <>
                        {/* Section Intro Slide */}
                        {hasIntro && slideIdx === 0 && currentSection && (
                          <SectionIntroSlide
                            key={`intro-${currentSectionIdx}`}
                            sectionTitle={currentSection.title}
                            sectionIndex={currentSectionIdx}
                            totalSections={sections.length}
                            concepts={currentSection.concepts || []}
                            coverImage={currentSection.coverImage || ''}
                            totalSlides={totalQs}
                            onNext={goToNextSlide}
                            hasCodingMocks={isCodingSection}
                            onOpenCoding={handleOpenCoding}
                            direction={slideDirection}
                            timeMinutes={currentSection.timeMinutes}
                          />
                        )}

                        {/* Q&A Slides */}
                        {(() => {
                          const introOffset = hasIntro ? 1 : 0;
                          const questionIdx = slideIdx - introOffset;
                          return !isCodingSection && slideIdx >= introOffset && questionIdx < qLen && currentSection?.questions[questionIdx] && (
                            <QuestionSlide
                              key={`q-${currentSectionIdx}-${questionIdx}`}
                              question={currentSection.questions[questionIdx]}
                              idx={slideIdx}
                              total={totalQs}
                              onNext={goToNextSlide}
                              onPrev={goToPrevSlide}
                              isFirst={slideIdx === 0}
                              isLast={slideIdx === totalQs - 1}
                              hasQuiz={(currentSection?.quiz?.length || 0) > 0}
                              onGoToQuiz={handleStartQuiz}
                              onCompleteSection={handleProceed}
                              direction={slideDirection}
                              sectionTitle={currentSection?.title || ""}
                            />
                          );
                        })()}
                      </>
                    )}

                    {/* ── SECTION QUIZ ── */}
                    {(quizState === 'active' || quizState === 'submitted') && (
                      <div className="flex flex-col h-full overflow-hidden fade-up gap-3">
                        {/* Quiz header */}
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="rounded-lg border px-5 py-3 flex-1 flex justify-between items-center" style={{ borderColor: C.border, background: quizState === 'submitted' ? (quizPassed ? C.greenLight + "30" : "#fef2f220") : C.purpleBg }}>
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: quizState === 'submitted' ? (quizPassed ? C.green : "#dc2626") : C.purple }}>
                                {quizState === 'submitted' ? (quizPassed ? <IconCheck size={18} color="#fff" /> : <span style={{ color: '#fff', fontSize: '16px' }}>✕</span>) : <IconBook size={16} color="#fff" />}
                              </div>
                              <div>
                                <h3 className="text-[13px] font-bold" style={{ color: C.heading }}>Section Quiz — {currentSection?.title}</h3>
                                <p className="text-[10px]" style={{ color: C.muted }}>
                                  {quizState === 'submitted' ? `${quizScore} / ${currentQuiz.length} correct` : `${currentQuiz.length} questions — Need ${Math.ceil(currentQuiz.length / 2)}+ correct`}
                                </p>
                              </div>
                            </div>
                            {quizState === 'active' && timeLeft !== null && (
                              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-bold text-[12px]"
                                style={{ borderColor: timeLeft <= 10 ? "#fca5a5" : C.border, background: timeLeft <= 10 ? "#fef2f2" : C.card, color: timeLeft <= 10 ? "#dc2626" : C.heading }}>
                                <IconClock size={12} /> {formatTime(timeLeft)}
                              </div>
                            )}
                          </div>
                          {quizState === 'active' && (
                            <button onClick={() => { setQuizState('none'); setSlideIdx(0); setQuizSlideIdx(0); setQuizAnswers({}); setQuizAnsweredIdx(-1); setSkippedQuestions(new Set()); }}
                              className="px-3 py-2 rounded-lg border text-[11px] font-semibold transition-all hover:shadow-sm"
                              style={{ borderColor: C.border, color: C.muted, background: C.card }}>
                              <IconArrowLeft size={12} /> Back
                            </button>
                          )}
                        </div>

                        {/* Score banner */}
                        {quizState === 'submitted' && (
                          <div className="rounded-lg border px-4 py-2 flex items-center justify-between shrink-0" style={{ borderColor: quizPassed ? C.green : "#fca5a5", background: quizPassed ? C.greenLight + "20" : "#fef2f210" }}>
                            <div className="flex items-center gap-3">
                              <div style={{ width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: quizPassed ? C.green : "#dc2626", color: '#fff', fontSize: '16px', fontWeight: 'bold' }}>
                                {quizPassed ? '✓' : '✕'}
                              </div>
                              <div>
                                <p className="text-lg font-bold leading-none" style={{ color: quizPassed ? C.green : "#dc2626" }}>{quizScore} / {currentQuiz.length}</p>
                                <p className="text-[11px] font-medium mt-1" style={{ color: quizPassed ? C.green : "#dc2626" }}>
                                  {quizPassed ? (quizScore === currentQuiz.length ? "Perfect! All correct!" : "Passed! Great work!") : "Not passed — review answers below and retry"}
                                </p>
                              </div>
                            </div>
                            {quizPassed && (
                              <button onClick={handleProceed}
                                className="px-4 py-1.5 rounded-lg font-bold text-[11px] text-white transition-all hover:opacity-90 inline-flex items-center gap-1.5"
                                style={{ background: C.navy }}>
                                {currentSectionIdx < sections.length - 1 ? "Next Section" : "Complete Module"} <IconArrowRight size={12} />
                              </button>
                            )}
                          </div>
                        )}

                        {/* Questions */}
                        <div className="flex-1 min-h-0 overflow-y-auto editorial-scrollbar pr-2 flex flex-col">
                          {currentQuiz.map((qz, qIdx) => {
                            if (qIdx !== quizSlideIdx && quizState !== 'submitted') return null;
                            if (quizState === 'submitted' && qIdx !== quizSlideIdx) return null;
                            const ua = quizAnswers[qIdx];
                            const hasExplanation = quizAnsweredIdx === qIdx && ua !== undefined;
                            
                            return (
                              <div key={qIdx} className="rounded-xl border flex flex-col flex-1 overflow-hidden"
                                style={{ borderColor: quizState === 'submitted' ? ua === qz.correctIndex ? C.green : "#fca5a5" : C.border, background: C.card }}>
                                
                                {/* Question Header */}
                                <div className="px-4 py-3 border-b flex items-start gap-3 shrink-0" style={{ borderColor: C.border, background: quizState === 'submitted' ? ua === qz.correctIndex ? C.greenLight + "15" : "#fef2f215" : C.card }}>
                                  <span className="flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold shrink-0" style={{ background: quizState === 'submitted' ? ua === qz.correctIndex ? C.green : "#dc2626" : C.purpleBg, color: quizState === 'submitted' ? "#fff" : C.purple }}>{qIdx + 1}</span>
                                  <p className="text-[14px] font-semibold leading-relaxed" style={{ color: C.heading, fontFamily: "var(--font-playfair), serif" }}>{qz.question}</p>
                                </div>
                                
                                {/* Options Container */}
                                <div className="px-4 py-3 flex-1 flex flex-col justify-start gap-2">
                                  {qz.options.map((opt, optIdx) => {
                                    const isAnswered = ua !== undefined;
                                    const isCorrectOpt = ua === qz.correctIndex;
                                    const isSelectedOpt = ua === optIdx;
                                    const isWrongSelected = isAnswered && isSelectedOpt && !isCorrectOpt;
                                    const showCorrect = isAnswered && optIdx === qz.correctIndex;
                                    
                                    let bgColor = C.surface;
                                    let borderColor = C.border;
                                    let textColor = C.body;
                                    let boxShadow = "none";
                                    
                                    if (showCorrect) {
                                      bgColor = C.greenLight;
                                      borderColor = C.green;
                                      textColor = C.green;
                                      boxShadow = `0 0 0 3px ${C.greenLight}40`;
                                    } else if (isWrongSelected) {
                                      bgColor = "#fef2f2";
                                      borderColor = "#fca5a5";
                                      textColor = "#dc2626";
                                      boxShadow = `0 0 0 3px #fca5a540`;
                                    } else if (isSelectedOpt && !isAnswered) {
                                      bgColor = C.purpleBg;
                                      borderColor = C.purple;
                                      boxShadow = `0 0 0 3px ${C.purple}20`;
                                    }
                                    
                                    return (
                                      <button key={optIdx} onClick={() => handlePickAnswer(qIdx, optIdx)} disabled={isAnswered}
                                        className="w-full text-left px-4 py-3 rounded-lg text-[13px] font-medium transition-all border-2"
                                        style={{ background: bgColor, borderColor: borderColor, color: textColor, cursor: isAnswered ? 'not-allowed' : 'pointer', opacity: isAnswered ? 1 : 1, boxShadow: showCorrect || isWrongSelected ? boxShadow : "none" }}>
                                        <div className="flex items-center justify-between">
                                          <span><span className="font-bold" style={{ opacity: 0.8 }}>{String.fromCharCode(65 + optIdx)}.</span> {opt}</span>
                                          {showCorrect && <span><IconCheck size={16} color={C.green} /></span>}
                                          {isWrongSelected && <span style={{ fontSize: 16, color: "#dc2626" }}>✕</span>}
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                                
                                {/* Explanation Box - Display in Active (on feedback) */}
                                {hasExplanation && quizState !== 'submitted' && ua !== undefined && (
                                  <div className="px-4 py-2 border-t shrink-0" style={{ borderColor: C.border, background: ua === qz.correctIndex ? C.greenLight + "10" : "#fef2f210" }}>
                                    <div className="rounded-lg px-4 py-3 border-l-4" style={{ borderLeftColor: ua === qz.correctIndex ? C.green : "#dc2626", background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.03)" }}>
                                      <div className="flex items-center gap-2 mb-2">
                                        <IconLightbulb size={14} color={ua === qz.correctIndex ? C.green : "#dc2626"} />
                                        <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: ua === qz.correctIndex ? C.green : "#dc2626" }}>
                                          {ua === qz.correctIndex ? '✓ Correct!' : '✕ Incorrect'}
                                        </p>
                                      </div>
                                      <p className="text-[12px] leading-relaxed" style={{ color: C.body }}>{qz.explanation}</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center justify-between pt-3 border-t shrink-0 gap-2" style={{ borderColor: C.border, padding: '12px 0 0 0' }}>
                          {quizState === 'active' && (
                            <>
                              <button onClick={() => setQuizSlideIdx(Math.max(0, quizSlideIdx - 1))} disabled={quizSlideIdx === 0}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold transition-all"
                                style={{ background: quizSlideIdx === 0 ? "#F3F4F6" : C.card, color: quizSlideIdx === 0 ? "#D1D5DB" : C.navy, border: `1px solid ${quizSlideIdx === 0 ? "#E5E7EB" : C.border}`, opacity: quizSlideIdx === 0 ? 0.6 : 1, cursor: quizSlideIdx === 0 ? "not-allowed" : "pointer" }}>
                                <IconArrowLeft size={12} /> Back
                              </button>

                              <div className="flex-1" />

                              {/* Skip button - always available during quiz */}
                              <button onClick={handleSkipQuestion}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold transition-all border"
                                style={{ background: "#F3F4F6", color: "#6B7280", borderColor: "#E5E7EB" }}>
                                ↷ Skip
                              </button>

                              {quizSlideIdx < currentQuiz.length - 1 ? (
                                <button 
                                  onClick={() => {
                                    setQuizSlideIdx(quizSlideIdx + 1);
                                    setQuizAnsweredIdx(-1);
                                  }}
                                  disabled={quizAnswers[quizSlideIdx] === undefined && !skippedQuestions.has(quizSlideIdx)}
                                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-semibold transition-all"
                                  style={{ 
                                    background: (quizAnswers[quizSlideIdx] !== undefined || skippedQuestions.has(quizSlideIdx)) ? C.navy : "#F3F4F6", 
                                    color: (quizAnswers[quizSlideIdx] !== undefined || skippedQuestions.has(quizSlideIdx)) ? "#fff" : "#D1D5DB", 
                                    border: `1px solid ${(quizAnswers[quizSlideIdx] !== undefined || skippedQuestions.has(quizSlideIdx)) ? C.navy : "#E5E7EB"}`,
                                    cursor: (quizAnswers[quizSlideIdx] !== undefined || skippedQuestions.has(quizSlideIdx)) ? 'pointer' : 'not-allowed'
                                  }}>
                                  Next <IconArrowRight size={12} />
                                </button>
                              ) : (
                                <button 
                                  onClick={handleSubmitQuiz}
                                  disabled={Object.keys(quizAnswers).length + skippedQuestions.size < currentQuiz.length}
                                  className="px-5 py-2 rounded-lg font-bold text-[11px] transition-all"
                                  style={{ 
                                    background: (Object.keys(quizAnswers).length + skippedQuestions.size === currentQuiz.length) ? C.navy : "#F3F4F6", 
                                    color: (Object.keys(quizAnswers).length + skippedQuestions.size === currentQuiz.length) ? "#fff" : "#D1D5DB", 
                                    cursor: (Object.keys(quizAnswers).length + skippedQuestions.size === currentQuiz.length) ? 'pointer' : 'not-allowed',
                                    border: `1px solid ${(Object.keys(quizAnswers).length + skippedQuestions.size === currentQuiz.length) ? C.navy : "#E5E7EB"}`
                                  }}>
                                  Submit
                                </button>
                              )}
                            </>
                          )}

                          {quizState === 'submitted' && (
                            <>
                              <button onClick={() => setQuizSlideIdx(Math.max(0, quizSlideIdx - 1))} disabled={quizSlideIdx === 0}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold transition-all"
                                style={{ background: quizSlideIdx === 0 ? "#F3F4F6" : C.card, color: quizSlideIdx === 0 ? "#D1D5DB" : C.navy, border: `1px solid ${quizSlideIdx === 0 ? "#E5E7EB" : C.border}`, opacity: quizSlideIdx === 0 ? 0.6 : 1, cursor: quizSlideIdx === 0 ? "not-allowed" : "pointer" }}>
                                <IconArrowLeft size={12} /> Back
                              </button>

                              <div className="flex-1" />

                              {quizSlideIdx < currentQuiz.length - 1 ? (
                                <button onClick={() => setQuizSlideIdx(quizSlideIdx + 1)}
                                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-semibold transition-all"
                                  style={{ background: C.card, color: C.navy, border: `1px solid ${C.border}` }}>
                                  Next <IconArrowRight size={12} />
                                </button>
                              ) : (
                                !quizPassed ? (
                                  <button onClick={() => { setQuizAnswers({}); setSkippedQuestions(new Set()); setQuizAnsweredIdx(-1); setQuizState('active'); setQuizSlideIdx(0); }}
                                    className="px-4 py-2 rounded-lg border font-bold text-[11px] transition-all hover:shadow-sm"
                                    style={{ borderColor: C.border, color: C.heading, background: C.card }}>
                                    Retry
                                  </button>
                                ) : (
                                  <button onClick={handleProceed}
                                    className="flex items-center gap-1.5 px-5 py-2 rounded-lg font-bold text-[11px] text-white transition-all hover:opacity-90"
                                    style={{ background: C.navy }}>
                                    {currentSectionIdx < sections.length - 1 ? "Next" : "Done"} <IconArrowRight size={12} />
                                  </button>
                                )
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
