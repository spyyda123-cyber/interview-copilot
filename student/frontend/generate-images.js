/**
 * Generate SVG concept images for the study plan slides
 * Run: node generate-images.js
 */
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'public', 'study-images');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const W = 800;
const H = 340;

// ── Shared palette ──
const BG1 = '#0f0a2a';
const BG2 = '#1e1b4b';
const ACCENT = '#7c3aed';
const TEAL = '#14b8a6';
const AMBER = '#f59e0b';
const ROSE = '#f43f5e';
const GREEN = '#10b981';
const BLUE = '#3b82f6';
const SKY = '#38bdf8';
const PINK = '#ec4899';
const WHITE = '#ffffff';
const MUTED = '#94a3b8';
const SURFACE = 'rgba(255,255,255,0.06)';
const BORDER = 'rgba(255,255,255,0.10)';

function svgWrap(inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${BG1}"/>
      <stop offset="100%" stop-color="${BG2}"/>
    </linearGradient>
    <style>
      text { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; }
    </style>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)" rx="16"/>
  <!-- Grid dots -->
  <g opacity="0.04">
    ${Array.from({length: 20}).map((_,r) => Array.from({length: 40}).map((_,c) => `<circle cx="${c*20+10}" cy="${r*20+10}" r="1" fill="white"/>`).join('')).join('\n    ')}
  </g>
  ${inner}
</svg>`;
}

function pillBox(x, y, w, h, color, label, icon) {
  return `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${color}" opacity="0.15" stroke="${color}" stroke-width="1" stroke-opacity="0.3"/>
  <text x="${x + w/2}" y="${y + h/2 - 6}" fill="${color}" font-size="13" font-weight="700" text-anchor="middle">${icon}</text>
  <text x="${x + w/2}" y="${y + h/2 + 12}" fill="${WHITE}" font-size="11" font-weight="600" text-anchor="middle">${label}</text>`;
}

function badge(x, y, text, color) {
  const tw = text.length * 6.5 + 16;
  return `
  <rect x="${x}" y="${y}" width="${tw}" height="22" rx="11" fill="${color}" opacity="0.2"/>
  <text x="${x + tw/2}" y="${y + 15}" fill="${color}" font-size="9" font-weight="700" text-anchor="middle" letter-spacing="1">${text}</text>`;
}

function title(x, y, text) {
  return `<text x="${x}" y="${y}" fill="${WHITE}" font-size="22" font-weight="800" letter-spacing="-0.5">${text}</text>`;
}

function subtitle(x, y, text) {
  return `<text x="${x}" y="${y}" fill="${MUTED}" font-size="12" font-weight="500">${text}</text>`;
}

function card(x, y, w, h) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${SURFACE}" stroke="${BORDER}" stroke-width="1"/>`;
}

function colorDot(x, y, color) {
  return `<circle cx="${x}" cy="${y}" r="5" fill="${color}"/>`;
}

// ═══════════════════════════════════════════════════════
// IMAGE DEFINITIONS
// ═══════════════════════════════════════════════════════

const images = {
  // ── OOP Concepts Section ──────────────────────────
  'oop_concepts': svgWrap(`
    ${badge(40, 30, 'SECTION', ACCENT)}
    ${title(40, 75, 'OOP Concepts')}
    ${subtitle(40, 100, 'Encapsulation · Abstraction · Inheritance · Polymorphism')}
    <line x1="40" y1="115" x2="760" y2="115" stroke="${ACCENT}" stroke-width="2" opacity="0.3"/>
    ${pillBox(40, 140, 170, 80, TEAL, 'Encapsulation', '🔒')}
    ${pillBox(230, 140, 170, 80, AMBER, 'Abstraction', '🎭')}
    ${pillBox(420, 140, 170, 80, ACCENT, 'Inheritance', '🌳')}
    ${pillBox(610, 140, 170, 80, ROSE, 'Polymorphism', '🔄')}
    ${card(40, 245, 720, 70)}
    <text x="60" y="272" fill="${MUTED}" font-size="11">Core principles that define how Java organises and structures code</text>
    <text x="60" y="292" fill="${MUTED}" font-size="11">into reusable, maintainable, and extensible components.</text>
  `),

  'q_oop_pillars': svgWrap(`
    ${badge(40, 25, 'CONCEPT', GREEN)}
    ${title(40, 65, 'Four Pillars of OOP')}
    <line x1="40" y1="82" x2="760" y2="82" stroke="${GREEN}" stroke-width="2" opacity="0.3"/>
    <!-- Four pillar columns -->
    ${card(40, 100, 170, 210)}
    <rect x="40" y="100" width="170" height="5" rx="2" fill="${TEAL}"/>
    <text x="125" y="140" fill="${TEAL}" font-size="28" text-anchor="middle">🔒</text>
    <text x="125" y="168" fill="${WHITE}" font-size="13" font-weight="700" text-anchor="middle">Encapsulation</text>
    <text x="125" y="190" fill="${MUTED}" font-size="10" text-anchor="middle">Bundles data &amp; methods</text>
    <text x="125" y="205" fill="${MUTED}" font-size="10" text-anchor="middle">private / protected</text>
    <text x="125" y="220" fill="${MUTED}" font-size="10" text-anchor="middle">getters &amp; setters</text>
    <text x="125" y="280" fill="${TEAL}" font-size="9" font-weight="600" text-anchor="middle">Access Control</text>

    ${card(230, 100, 170, 210)}
    <rect x="230" y="100" width="170" height="5" rx="2" fill="${AMBER}"/>
    <text x="315" y="140" fill="${AMBER}" font-size="28" text-anchor="middle">🎭</text>
    <text x="315" y="168" fill="${WHITE}" font-size="13" font-weight="700" text-anchor="middle">Abstraction</text>
    <text x="315" y="190" fill="${MUTED}" font-size="10" text-anchor="middle">Hides complexity</text>
    <text x="315" y="205" fill="${MUTED}" font-size="10" text-anchor="middle">abstract classes</text>
    <text x="315" y="220" fill="${MUTED}" font-size="10" text-anchor="middle">interfaces</text>
    <text x="315" y="280" fill="${AMBER}" font-size="9" font-weight="600" text-anchor="middle">Simplified Interface</text>

    ${card(420, 100, 170, 210)}
    <rect x="420" y="100" width="170" height="5" rx="2" fill="${BLUE}"/>
    <text x="505" y="140" fill="${BLUE}" font-size="28" text-anchor="middle">🌳</text>
    <text x="505" y="168" fill="${WHITE}" font-size="13" font-weight="700" text-anchor="middle">Inheritance</text>
    <text x="505" y="190" fill="${MUTED}" font-size="10" text-anchor="middle">Code reuse via extends</text>
    <text x="505" y="205" fill="${MUTED}" font-size="10" text-anchor="middle">parent → child</text>
    <text x="505" y="220" fill="${MUTED}" font-size="10" text-anchor="middle">"is-a" relationship</text>
    <text x="505" y="280" fill="${BLUE}" font-size="9" font-weight="600" text-anchor="middle">Class Hierarchy</text>

    ${card(610, 100, 170, 210)}
    <rect x="610" y="100" width="170" height="5" rx="2" fill="${ROSE}"/>
    <text x="695" y="140" fill="${ROSE}" font-size="28" text-anchor="middle">🔄</text>
    <text x="695" y="168" fill="${WHITE}" font-size="13" font-weight="700" text-anchor="middle">Polymorphism</text>
    <text x="695" y="190" fill="${MUTED}" font-size="10" text-anchor="middle">One interface, many forms</text>
    <text x="695" y="205" fill="${MUTED}" font-size="10" text-anchor="middle">overloading (compile)</text>
    <text x="695" y="220" fill="${MUTED}" font-size="10" text-anchor="middle">overriding (runtime)</text>
    <text x="695" y="280" fill="${ROSE}" font-size="9" font-weight="600" text-anchor="middle">Dynamic Dispatch</text>
  `),

  'q_abstract_interface': svgWrap(`
    ${badge(40, 25, 'COMPARISON', AMBER)}
    ${title(40, 65, 'Abstract Class vs Interface')}
    <line x1="40" y1="82" x2="760" y2="82" stroke="${AMBER}" stroke-width="2" opacity="0.3"/>

    <!-- Left: Abstract Class -->
    ${card(40, 100, 350, 210)}
    <rect x="40" y="100" width="350" height="5" rx="2" fill="${TEAL}"/>
    <text x="215" y="130" fill="${TEAL}" font-size="14" font-weight="700" text-anchor="middle">Abstract Class</text>
    ${colorDot(70, 155, TEAL)}
    <text x="85" y="159" fill="${MUTED}" font-size="11">Can have constructors</text>
    ${colorDot(70, 180, TEAL)}
    <text x="85" y="184" fill="${MUTED}" font-size="11">Instance variables (state)</text>
    ${colorDot(70, 205, TEAL)}
    <text x="85" y="209" fill="${MUTED}" font-size="11">Concrete + abstract methods</text>
    ${colorDot(70, 230, TEAL)}
    <text x="85" y="234" fill="${MUTED}" font-size="11">Single inheritance only</text>
    <rect x="70" y="260" width="290" height="30" rx="8" fill="${TEAL}" opacity="0.15"/>
    <text x="215" y="280" fill="${TEAL}" font-size="10" font-weight="600" text-anchor="middle">extends — ONE parent class</text>

    <!-- VS divider -->
    <circle cx="400" cy="205" r="18" fill="${ACCENT}" opacity="0.3"/>
    <text x="400" y="210" fill="${WHITE}" font-size="11" font-weight="800" text-anchor="middle">VS</text>

    <!-- Right: Interface -->
    ${card(420, 100, 350, 210)}
    <rect x="420" y="100" width="350" height="5" rx="2" fill="${AMBER}"/>
    <text x="595" y="130" fill="${AMBER}" font-size="14" font-weight="700" text-anchor="middle">Interface</text>
    ${colorDot(450, 155, AMBER)}
    <text x="465" y="159" fill="${MUTED}" font-size="11">No constructors</text>
    ${colorDot(450, 180, AMBER)}
    <text x="465" y="184" fill="${MUTED}" font-size="11">Constants only (static final)</text>
    ${colorDot(450, 205, AMBER)}
    <text x="465" y="209" fill="${MUTED}" font-size="11">Default + static (Java 8+)</text>
    ${colorDot(450, 230, AMBER)}
    <text x="465" y="234" fill="${MUTED}" font-size="11">Multiple implementation</text>
    <rect x="450" y="260" width="290" height="30" rx="8" fill="${AMBER}" opacity="0.15"/>
    <text x="595" y="280" fill="${AMBER}" font-size="10" font-weight="600" text-anchor="middle">implements — MANY interfaces</text>
  `),

  'q_overload_override': svgWrap(`
    ${badge(40, 25, 'COMPARISON', BLUE)}
    ${title(40, 65, 'Overloading vs Overriding')}
    <line x1="40" y1="82" x2="760" y2="82" stroke="${BLUE}" stroke-width="2" opacity="0.3"/>

    ${card(40, 100, 350, 210)}
    <rect x="40" y="100" width="350" height="5" rx="2" fill="${BLUE}"/>
    <text x="215" y="130" fill="${BLUE}" font-size="14" font-weight="700" text-anchor="middle">Method Overloading</text>
    <text x="215" y="150" fill="${MUTED}" font-size="10" text-anchor="middle">Compile-Time Polymorphism</text>
    <rect x="70" y="165" width="290" height="24" rx="6" fill="${SURFACE}"/>
    <text x="85" y="182" fill="${SKY}" font-size="11" font-family="monospace">add(int a, int b)</text>
    <rect x="70" y="195" width="290" height="24" rx="6" fill="${SURFACE}"/>
    <text x="85" y="212" fill="${SKY}" font-size="11" font-family="monospace">add(double a, double b)</text>
    <rect x="70" y="225" width="290" height="24" rx="6" fill="${SURFACE}"/>
    <text x="85" y="242" fill="${SKY}" font-size="11" font-family="monospace">add(int a, int b, int c)</text>
    <rect x="70" y="265" width="290" height="28" rx="8" fill="${BLUE}" opacity="0.15"/>
    <text x="215" y="284" fill="${BLUE}" font-size="10" font-weight="600" text-anchor="middle">Same name · Different params</text>

    <circle cx="400" cy="205" r="18" fill="${ACCENT}" opacity="0.3"/>
    <text x="400" y="210" fill="${WHITE}" font-size="11" font-weight="800" text-anchor="middle">VS</text>

    ${card(420, 100, 350, 210)}
    <rect x="420" y="100" width="350" height="5" rx="2" fill="${GREEN}"/>
    <text x="595" y="130" fill="${GREEN}" font-size="14" font-weight="700" text-anchor="middle">Method Overriding</text>
    <text x="595" y="150" fill="${MUTED}" font-size="10" text-anchor="middle">Runtime Polymorphism</text>
    <rect x="450" y="165" width="290" height="24" rx="6" fill="${SURFACE}"/>
    <text x="465" y="182" fill="${MUTED}" font-size="11" font-family="monospace">// Parent class</text>
    <rect x="450" y="195" width="290" height="24" rx="6" fill="${SURFACE}"/>
    <text x="465" y="212" fill="${SKY}" font-size="11" font-family="monospace">void draw() { ... }</text>
    <rect x="450" y="225" width="290" height="24" rx="6" fill="${SURFACE}"/>
    <text x="465" y="242" fill="${GREEN}" font-size="11" font-family="monospace">@Override draw() { ... }</text>
    <rect x="450" y="265" width="290" height="28" rx="8" fill="${GREEN}" opacity="0.15"/>
    <text x="595" y="284" fill="${GREEN}" font-size="10" font-weight="600" text-anchor="middle">Same signature · Subclass replaces</text>
  `),

  'q_final_keyword': svgWrap(`
    ${badge(40, 25, 'KEYWORD', ROSE)}
    ${title(40, 65, 'The final Keyword')}
    <line x1="40" y1="82" x2="760" y2="82" stroke="${ROSE}" stroke-width="2" opacity="0.3"/>
    ${card(40, 100, 230, 140)}
    <rect x="40" y="100" width="230" height="5" rx="2" fill="${TEAL}"/>
    <text x="155" y="130" fill="${TEAL}" font-size="13" font-weight="700" text-anchor="middle">final Variable</text>
    <text x="155" y="155" fill="${MUTED}" font-size="11" text-anchor="middle">Value assigned once</text>
    <text x="155" y="175" fill="${MUTED}" font-size="11" text-anchor="middle">Cannot be reassigned</text>
    <rect x="60" y="200" width="190" height="24" rx="6" fill="${SURFACE}"/>
    <text x="75" y="217" fill="${SKY}" font-size="10" font-family="monospace">final int MAX = 100;</text>

    ${card(290, 100, 230, 140)}
    <rect x="290" y="100" width="230" height="5" rx="2" fill="${AMBER}"/>
    <text x="405" y="130" fill="${AMBER}" font-size="13" font-weight="700" text-anchor="middle">final Method</text>
    <text x="405" y="155" fill="${MUTED}" font-size="11" text-anchor="middle">Cannot be overridden</text>
    <text x="405" y="175" fill="${MUTED}" font-size="11" text-anchor="middle">Locks critical logic</text>
    <rect x="310" y="200" width="190" height="24" rx="6" fill="${SURFACE}"/>
    <text x="325" y="217" fill="${SKY}" font-size="10" font-family="monospace">final void validate()</text>

    ${card(540, 100, 230, 140)}
    <rect x="540" y="100" width="230" height="5" rx="2" fill="${ROSE}"/>
    <text x="655" y="130" fill="${ROSE}" font-size="13" font-weight="700" text-anchor="middle">final Class</text>
    <text x="655" y="155" fill="${MUTED}" font-size="11" text-anchor="middle">Cannot be extended</text>
    <text x="655" y="175" fill="${MUTED}" font-size="11" text-anchor="middle">e.g. String, Integer</text>
    <rect x="560" y="200" width="190" height="24" rx="6" fill="${SURFACE}"/>
    <text x="575" y="217" fill="${SKY}" font-size="10" font-family="monospace">final class String</text>

    ${card(40, 260, 730, 50)}
    <text x="60" y="285" fill="${MUTED}" font-size="11">Constants use </text>
    <text x="140" y="285" fill="${SKY}" font-size="11" font-family="monospace">static final</text>
    <text x="240" y="285" fill="${MUTED}" font-size="11"> — UPPER_SNAKE_CASE convention</text>
  `),

  'q_equals_reference': svgWrap(`
    ${badge(40, 25, 'COMPARISON', GREEN)}
    ${title(40, 65, '== vs .equals()')}
    <line x1="40" y1="82" x2="760" y2="82" stroke="${GREEN}" stroke-width="2" opacity="0.3"/>
    ${card(40, 100, 350, 210)}
    <rect x="40" y="100" width="350" height="5" rx="2" fill="${ROSE}"/>
    <text x="215" y="132" fill="${ROSE}" font-size="14" font-weight="700" text-anchor="middle">== (Reference)</text>
    <text x="215" y="152" fill="${MUTED}" font-size="10" text-anchor="middle">Compares memory addresses</text>
    <rect x="100" y="170" width="80" height="40" rx="8" fill="${SURFACE}" stroke="${ROSE}" stroke-width="1"/>
    <text x="140" y="195" fill="${WHITE}" font-size="10" text-anchor="middle">obj A</text>
    <rect x="230" y="170" width="80" height="40" rx="8" fill="${SURFACE}" stroke="${ROSE}" stroke-width="1"/>
    <text x="270" y="195" fill="${WHITE}" font-size="10" text-anchor="middle">obj B</text>
    <line x1="180" y1="190" x2="230" y2="190" stroke="${ROSE}" stroke-width="2" stroke-dasharray="4"/>
    <text x="205" y="185" fill="${ROSE}" font-size="9" text-anchor="middle">≠</text>
    <text x="215" y="240" fill="${MUTED}" font-size="10" text-anchor="middle">Same content ≠ Same reference</text>
    <rect x="70" y="260" width="290" height="30" rx="8" fill="${ROSE}" opacity="0.15"/>
    <text x="215" y="280" fill="${ROSE}" font-size="10" font-weight="600" text-anchor="middle">Points to same object in heap?</text>

    <circle cx="400" cy="205" r="18" fill="${ACCENT}" opacity="0.3"/>
    <text x="400" y="210" fill="${WHITE}" font-size="11" font-weight="800" text-anchor="middle">VS</text>

    ${card(420, 100, 350, 210)}
    <rect x="420" y="100" width="350" height="5" rx="2" fill="${GREEN}"/>
    <text x="595" y="132" fill="${GREEN}" font-size="14" font-weight="700" text-anchor="middle">.equals() (Value)</text>
    <text x="595" y="152" fill="${MUTED}" font-size="10" text-anchor="middle">Compares logical content</text>
    <rect x="480" y="170" width="80" height="40" rx="8" fill="${SURFACE}" stroke="${GREEN}" stroke-width="1"/>
    <text x="520" y="195" fill="${WHITE}" font-size="10" text-anchor="middle">"Hello"</text>
    <rect x="610" y="170" width="80" height="40" rx="8" fill="${SURFACE}" stroke="${GREEN}" stroke-width="1"/>
    <text x="650" y="195" fill="${WHITE}" font-size="10" text-anchor="middle">"Hello"</text>
    <line x1="560" y1="190" x2="610" y2="190" stroke="${GREEN}" stroke-width="2"/>
    <text x="585" y="185" fill="${GREEN}" font-size="9" text-anchor="middle">=</text>
    <text x="595" y="240" fill="${MUTED}" font-size="10" text-anchor="middle">Same content = Equal values</text>
    <rect x="450" y="260" width="290" height="30" rx="8" fill="${GREEN}" opacity="0.15"/>
    <text x="595" y="280" fill="${GREEN}" font-size="10" font-weight="600" text-anchor="middle">Content logically equivalent?</text>
  `),

  // ── Collections Framework ──────────────────────────
  'collections_framework': svgWrap(`
    ${badge(40, 30, 'SECTION', BLUE)}
    ${title(40, 75, 'Collections Framework')}
    ${subtitle(40, 100, 'List · Set · Queue · Map — Unified data structure architecture')}
    <line x1="40" y1="115" x2="760" y2="115" stroke="${BLUE}" stroke-width="2" opacity="0.3"/>
    ${pillBox(40, 140, 170, 80, TEAL, 'List', '📋')}
    ${pillBox(230, 140, 170, 80, AMBER, 'Set', '🎯')}
    ${pillBox(420, 140, 170, 80, BLUE, 'Queue', '📦')}
    ${pillBox(610, 140, 170, 80, PINK, 'Map', '🗺️')}
    ${card(40, 245, 720, 70)}
    <text x="60" y="272" fill="${MUTED}" font-size="11">Standardized interfaces and implementations for storing</text>
    <text x="60" y="292" fill="${MUTED}" font-size="11">and manipulating groups of objects efficiently in Java.</text>
  `),

  'q_collections_arch': svgWrap(`
    ${badge(40, 25, 'ARCHITECTURE', BLUE)}
    ${title(40, 65, 'Collections Hierarchy')}
    <line x1="40" y1="82" x2="760" y2="82" stroke="${BLUE}" stroke-width="2" opacity="0.3"/>
    <!-- Root -->
    <rect x="310" y="95" width="180" height="35" rx="8" fill="${ACCENT}" opacity="0.3" stroke="${ACCENT}" stroke-width="1"/>
    <text x="400" y="118" fill="${WHITE}" font-size="12" font-weight="700" text-anchor="middle">Collection &lt;root&gt;</text>
    <!-- Lines down -->
    <line x1="300" y1="130" x2="300" y2="150" stroke="${BORDER}" stroke-width="1.5"/>
    <line x1="400" y1="130" x2="400" y2="150" stroke="${BORDER}" stroke-width="1.5"/>
    <line x1="500" y1="130" x2="500" y2="150" stroke="${BORDER}" stroke-width="1.5"/>
    <line x1="300" y1="130" x2="500" y2="130" stroke="${BORDER}" stroke-width="1.5"/>
    <!-- Branches -->
    <rect x="210" y="150" width="140" height="32" rx="8" fill="${TEAL}" opacity="0.2" stroke="${TEAL}" stroke-width="1"/>
    <text x="280" y="172" fill="${TEAL}" font-size="11" font-weight="700" text-anchor="middle">List (ordered)</text>
    <rect x="370" y="150" width="140" height="32" rx="8" fill="${AMBER}" opacity="0.2" stroke="${AMBER}" stroke-width="1"/>
    <text x="440" y="172" fill="${AMBER}" font-size="11" font-weight="700" text-anchor="middle">Set (unique)</text>
    <rect x="530" y="150" width="140" height="32" rx="8" fill="${BLUE}" opacity="0.2" stroke="${BLUE}" stroke-width="1"/>
    <text x="600" y="172" fill="${BLUE}" font-size="11" font-weight="700" text-anchor="middle">Queue (FIFO)</text>
    <!-- Implementations -->
    <text x="250" y="210" fill="${MUTED}" font-size="10" text-anchor="middle">ArrayList</text>
    <text x="330" y="210" fill="${MUTED}" font-size="10" text-anchor="middle">LinkedList</text>
    <text x="420" y="210" fill="${MUTED}" font-size="10" text-anchor="middle">HashSet</text>
    <text x="490" y="210" fill="${MUTED}" font-size="10" text-anchor="middle">TreeSet</text>
    <text x="580" y="210" fill="${MUTED}" font-size="10" text-anchor="middle">PriorityQueue</text>
    <text x="670" y="210" fill="${MUTED}" font-size="10" text-anchor="middle">ArrayDeque</text>
    <!-- Map separate -->
    <rect x="60" y="150" width="130" height="32" rx="8" fill="${PINK}" opacity="0.2" stroke="${PINK}" stroke-width="1"/>
    <text x="125" y="172" fill="${PINK}" font-size="11" font-weight="700" text-anchor="middle">Map (key→val)</text>
    <text x="90" y="210" fill="${MUTED}" font-size="10" text-anchor="middle">HashMap</text>
    <text x="160" y="210" fill="${MUTED}" font-size="10" text-anchor="middle">TreeMap</text>
    ${card(40, 240, 730, 75)}
    <text x="60" y="265" fill="${MUTED}" font-size="11">Key utilities: Collections (sort, search), Comparable/Comparator (ordering)</text>
    <text x="60" y="285" fill="${MUTED}" font-size="11">Thread-safe: ConcurrentHashMap, CopyOnWriteArrayList</text>
  `),

  'q_arraylist_linked': svgWrap(`
    ${badge(40, 25, 'COMPARISON', TEAL)}
    ${title(40, 65, 'ArrayList vs LinkedList')}
    <line x1="40" y1="82" x2="760" y2="82" stroke="${TEAL}" stroke-width="2" opacity="0.3"/>
    ${card(40, 100, 350, 210)}
    <rect x="40" y="100" width="350" height="5" rx="2" fill="${TEAL}"/>
    <text x="215" y="130" fill="${TEAL}" font-size="14" font-weight="700" text-anchor="middle">ArrayList</text>
    <!-- Array blocks -->
    ${[0,1,2,3,4,5].map(i => `<rect x="${80+i*45}" y="148" width="40" height="30" rx="4" fill="${SURFACE}" stroke="${TEAL}" stroke-width="1"/><text x="${100+i*45}" y="168" fill="${WHITE}" font-size="10" text-anchor="middle">[${i}]</text>`).join('\n    ')}
    <text x="215" y="205" fill="${MUTED}" font-size="10" text-anchor="middle">Contiguous memory · Dynamic array</text>
    <rect x="70" y="215" width="130" height="22" rx="6" fill="${GREEN}" opacity="0.15"/>
    <text x="135" y="231" fill="${GREEN}" font-size="10" font-weight="600" text-anchor="middle">get(i): O(1) ✓</text>
    <rect x="210" y="215" width="150" height="22" rx="6" fill="${ROSE}" opacity="0.15"/>
    <text x="285" y="231" fill="${ROSE}" font-size="10" font-weight="600" text-anchor="middle">insert/del: O(n) ✗</text>
    <rect x="70" y="270" width="290" height="28" rx="8" fill="${TEAL}" opacity="0.12"/>
    <text x="215" y="289" fill="${TEAL}" font-size="10" font-weight="600" text-anchor="middle">Best for: Read-heavy, random access</text>

    <circle cx="400" cy="205" r="18" fill="${ACCENT}" opacity="0.3"/>
    <text x="400" y="210" fill="${WHITE}" font-size="11" font-weight="800" text-anchor="middle">VS</text>

    ${card(420, 100, 350, 210)}
    <rect x="420" y="100" width="350" height="5" rx="2" fill="${AMBER}"/>
    <text x="595" y="130" fill="${AMBER}" font-size="14" font-weight="700" text-anchor="middle">LinkedList</text>
    <!-- Linked nodes -->
    ${[0,1,2,3].map(i => `<rect x="${460+i*75}" y="148" width="50" height="30" rx="4" fill="${SURFACE}" stroke="${AMBER}" stroke-width="1"/><text x="${485+i*75}" y="168" fill="${WHITE}" font-size="10" text-anchor="middle">N${i}</text>${i<3?`<line x1="${510+i*75}" y1="163" x2="${460+(i+1)*75}" y2="163" stroke="${AMBER}" stroke-width="1.5" marker-end="url(#arrowAmber)"/>`:''}`).join('\n    ')}
    <text x="595" y="205" fill="${MUTED}" font-size="10" text-anchor="middle">Doubly linked nodes · Scattered heap</text>
    <rect x="450" y="215" width="150" height="22" rx="6" fill="${ROSE}" opacity="0.15"/>
    <text x="525" y="231" fill="${ROSE}" font-size="10" font-weight="600" text-anchor="middle">get(i): O(n) ✗</text>
    <rect x="610" y="215" width="130" height="22" rx="6" fill="${GREEN}" opacity="0.15"/>
    <text x="675" y="231" fill="${GREEN}" font-size="10" font-weight="600" text-anchor="middle">insert/del: O(1) ✓</text>
    <rect x="450" y="270" width="290" height="28" rx="8" fill="${AMBER}" opacity="0.12"/>
    <text x="595" y="289" fill="${AMBER}" font-size="10" font-weight="600" text-anchor="middle">Best for: Frequent insert/remove</text>
  `),

  'q_hashmap_treemap': svgWrap(`
    ${badge(40, 25, 'COMPARISON', ACCENT)}
    ${title(40, 65, 'HashMap vs TreeMap')}
    <line x1="40" y1="82" x2="760" y2="82" stroke="${ACCENT}" stroke-width="2" opacity="0.3"/>
    ${card(40, 100, 350, 210)}
    <rect x="40" y="100" width="350" height="5" rx="2" fill="${BLUE}"/>
    <text x="215" y="130" fill="${BLUE}" font-size="14" font-weight="700" text-anchor="middle">HashMap</text>
    <text x="215" y="150" fill="${MUTED}" font-size="10" text-anchor="middle">Hash table with buckets</text>
    ${colorDot(70, 175, BLUE)}
    <text x="85" y="179" fill="${MUTED}" font-size="11">O(1) average get/put</text>
    ${colorDot(70, 198, BLUE)}
    <text x="85" y="202" fill="${MUTED}" font-size="11">Unordered keys</text>
    ${colorDot(70, 221, BLUE)}
    <text x="85" y="225" fill="${MUTED}" font-size="11">Allows 1 null key</text>
    ${colorDot(70, 244, BLUE)}
    <text x="85" y="248" fill="${MUTED}" font-size="11">Best for: Fast lookups</text>
    <rect x="70" y="265" width="290" height="28" rx="8" fill="${BLUE}" opacity="0.12"/>
    <text x="215" y="284" fill="${BLUE}" font-size="10" font-weight="600" text-anchor="middle">hashCode() → bucket index</text>

    <circle cx="400" cy="205" r="18" fill="${ACCENT}" opacity="0.3"/>
    <text x="400" y="210" fill="${WHITE}" font-size="11" font-weight="800" text-anchor="middle">VS</text>

    ${card(420, 100, 350, 210)}
    <rect x="420" y="100" width="350" height="5" rx="2" fill="${GREEN}"/>
    <text x="595" y="130" fill="${GREEN}" font-size="14" font-weight="700" text-anchor="middle">TreeMap</text>
    <text x="595" y="150" fill="${MUTED}" font-size="10" text-anchor="middle">Red-Black balanced tree</text>
    ${colorDot(450, 175, GREEN)}
    <text x="465" y="179" fill="${MUTED}" font-size="11">O(log n) all operations</text>
    ${colorDot(450, 198, GREEN)}
    <text x="465" y="202" fill="${MUTED}" font-size="11">Sorted keys (natural order)</text>
    ${colorDot(450, 221, GREEN)}
    <text x="465" y="225" fill="${MUTED}" font-size="11">No null keys allowed</text>
    ${colorDot(450, 244, GREEN)}
    <text x="465" y="248" fill="${MUTED}" font-size="11">Best for: Range queries</text>
    <rect x="450" y="265" width="290" height="28" rx="8" fill="${GREEN}" opacity="0.12"/>
    <text x="595" y="284" fill="${GREEN}" font-size="10" font-weight="600" text-anchor="middle">Comparable/Comparator ordering</text>
  `),

  'q_concurrent_map': svgWrap(`
    ${badge(40, 25, 'THREAD-SAFETY', GREEN)}
    ${title(40, 65, 'ConcurrentHashMap')}
    <line x1="40" y1="82" x2="760" y2="82" stroke="${GREEN}" stroke-width="2" opacity="0.3"/>
    ${card(40, 100, 360, 80)}
    <rect x="40" y="100" width="360" height="5" rx="2" fill="${ROSE}"/>
    <text x="220" y="130" fill="${ROSE}" font-size="13" font-weight="700" text-anchor="middle">❌ Hashtable (single lock)</text>
    <text x="220" y="155" fill="${MUTED}" font-size="10" text-anchor="middle">Entire map locked → bottleneck under contention</text>
    ${card(420, 100, 350, 80)}
    <rect x="420" y="100" width="350" height="5" rx="2" fill="${GREEN}"/>
    <text x="595" y="130" fill="${GREEN}" font-size="13" font-weight="700" text-anchor="middle">✓ ConcurrentHashMap</text>
    <text x="595" y="155" fill="${MUTED}" font-size="10" text-anchor="middle">Bucket-level locking → high throughput</text>
    ${card(40, 200, 730, 115)}
    ${colorDot(70, 225, GREEN)}
    <text x="85" y="229" fill="${MUTED}" font-size="11">Reads: Non-blocking (no locks needed)</text>
    ${colorDot(70, 250, AMBER)}
    <text x="85" y="254" fill="${MUTED}" font-size="11">Writes: CAS operations + bucket-level sync (Java 8+)</text>
    ${colorDot(70, 275, ROSE)}
    <text x="85" y="279" fill="${MUTED}" font-size="11">No null keys or values allowed (avoids ambiguity in concurrent context)</text>
    ${colorDot(70, 300, BLUE)}
    <text x="85" y="304" fill="${MUTED}" font-size="11">Ideal for: caches, shared counters, multi-threaded read-heavy workloads</text>
  `),

  'q_iterator': svgWrap(`
    ${badge(40, 25, 'COMPARISON', AMBER)}
    ${title(40, 65, 'Iterator vs ListIterator')}
    <line x1="40" y1="82" x2="760" y2="82" stroke="${AMBER}" stroke-width="2" opacity="0.3"/>
    ${card(40, 100, 350, 210)}
    <rect x="40" y="100" width="350" height="5" rx="2" fill="${BLUE}"/>
    <text x="215" y="130" fill="${BLUE}" font-size="14" font-weight="700" text-anchor="middle">Iterator</text>
    ${colorDot(70, 155, BLUE)}
    <text x="85" y="159" fill="${MUTED}" font-size="11">Forward-only traversal →</text>
    ${colorDot(70, 180, BLUE)}
    <text x="85" y="184" fill="${MUTED}" font-size="11">hasNext(), next(), remove()</text>
    ${colorDot(70, 205, BLUE)}
    <text x="85" y="209" fill="${MUTED}" font-size="11">Works with all Collections</text>
    ${colorDot(70, 230, BLUE)}
    <text x="85" y="234" fill="${MUTED}" font-size="11">for-each uses Iterator internally</text>
    <rect x="70" y="260" width="290" height="30" rx="8" fill="${BLUE}" opacity="0.15"/>
    <text x="215" y="280" fill="${BLUE}" font-size="10" font-weight="600" text-anchor="middle">Universal · Simple · Read + Remove</text>

    <circle cx="400" cy="205" r="18" fill="${ACCENT}" opacity="0.3"/>
    <text x="400" y="210" fill="${WHITE}" font-size="11" font-weight="800" text-anchor="middle">VS</text>

    ${card(420, 100, 350, 210)}
    <rect x="420" y="100" width="350" height="5" rx="2" fill="${GREEN}"/>
    <text x="595" y="130" fill="${GREEN}" font-size="14" font-weight="700" text-anchor="middle">ListIterator</text>
    ${colorDot(450, 155, GREEN)}
    <text x="465" y="159" fill="${MUTED}" font-size="11">Bidirectional ← →</text>
    ${colorDot(450, 180, GREEN)}
    <text x="465" y="184" fill="${MUTED}" font-size="11">add(), set(), index access</text>
    ${colorDot(450, 205, GREEN)}
    <text x="465" y="209" fill="${MUTED}" font-size="11">List interface only</text>
    ${colorDot(450, 230, GREEN)}
    <text x="465" y="234" fill="${MUTED}" font-size="11">hasPrevious(), previousIndex()</text>
    <rect x="450" y="260" width="290" height="30" rx="8" fill="${GREEN}" opacity="0.15"/>
    <text x="595" y="280" fill="${GREEN}" font-size="10" font-weight="600" text-anchor="middle">Powerful · Modify + Navigate both ways</text>
  `),

  // ── Streams & Lambdas ──────────────────────────
  'streams_lambdas': svgWrap(`
    ${badge(40, 30, 'SECTION', ACCENT)}
    ${title(40, 75, 'Streams & Lambdas')}
    ${subtitle(40, 100, 'Declarative data processing · Functional programming in Java 8+')}
    <line x1="40" y1="115" x2="760" y2="115" stroke="${ACCENT}" stroke-width="2" opacity="0.3"/>
    ${pillBox(40, 140, 170, 80, TEAL, 'Stream API', '🌊')}
    ${pillBox(230, 140, 170, 80, AMBER, 'Lambdas', 'λ')}
    ${pillBox(420, 140, 170, 80, BLUE, 'map/flatMap', '🔀')}
    ${pillBox(610, 140, 170, 80, GREEN, 'Optional', '❓')}
    ${card(40, 245, 720, 70)}
    <text x="60" y="272" fill="${MUTED}" font-size="11">Lazy evaluation pipelines for transforming collections</text>
    <text x="60" y="292" fill="${MUTED}" font-size="11">with functional-style operations and null-safe containers.</text>
  `),

  'q_streams_pipeline': svgWrap(`
    ${badge(40, 25, 'CONCEPT', TEAL)}
    ${title(40, 65, 'Stream Pipeline')}
    <line x1="40" y1="82" x2="760" y2="82" stroke="${TEAL}" stroke-width="2" opacity="0.3"/>
    <!-- Pipeline flow -->
    <rect x="40" y="110" width="130" height="50" rx="10" fill="${BLUE}" opacity="0.2" stroke="${BLUE}" stroke-width="1"/>
    <text x="105" y="132" fill="${BLUE}" font-size="10" font-weight="700" text-anchor="middle">SOURCE</text>
    <text x="105" y="148" fill="${MUTED}" font-size="9" text-anchor="middle">List / Array</text>
    <text x="185" y="140" fill="${MUTED}" font-size="16">→</text>
    <rect x="200" y="110" width="130" height="50" rx="10" fill="${AMBER}" opacity="0.2" stroke="${AMBER}" stroke-width="1"/>
    <text x="265" y="132" fill="${AMBER}" font-size="10" font-weight="700" text-anchor="middle">FILTER</text>
    <text x="265" y="148" fill="${MUTED}" font-size="9" text-anchor="middle">Intermediate (lazy)</text>
    <text x="345" y="140" fill="${MUTED}" font-size="16">→</text>
    <rect x="360" y="110" width="130" height="50" rx="10" fill="${ACCENT}" opacity="0.2" stroke="${ACCENT}" stroke-width="1"/>
    <text x="425" y="132" fill="${ACCENT}" font-size="10" font-weight="700" text-anchor="middle">MAP</text>
    <text x="425" y="148" fill="${MUTED}" font-size="9" text-anchor="middle">Transform (lazy)</text>
    <text x="505" y="140" fill="${MUTED}" font-size="16">→</text>
    <rect x="520" y="110" width="130" height="50" rx="10" fill="${GREEN}" opacity="0.2" stroke="${GREEN}" stroke-width="1"/>
    <text x="585" y="132" fill="${GREEN}" font-size="10" font-weight="700" text-anchor="middle">COLLECT</text>
    <text x="585" y="148" fill="${GREEN}" font-size="9" text-anchor="middle">Terminal (triggers)</text>
    ${card(40, 185, 730, 130)}
    ${colorDot(70, 210, TEAL)}
    <text x="85" y="214" fill="${MUTED}" font-size="11">Streams don't store data — they process from a source lazily</text>
    ${colorDot(70, 235, AMBER)}
    <text x="85" y="239" fill="${MUTED}" font-size="11">Intermediate ops (filter, map, sorted) are deferred until terminal op</text>
    ${colorDot(70, 260, GREEN)}
    <text x="85" y="264" fill="${MUTED}" font-size="11">Terminal ops (collect, forEach, count) trigger the entire pipeline</text>
    ${colorDot(70, 285, ROSE)}
    <text x="85" y="289" fill="${MUTED}" font-size="11">A Stream can only be consumed once — then it's closed</text>
  `),

  'q_lambda_func': svgWrap(`
    ${badge(40, 25, 'CONCEPT', AMBER)}
    ${title(40, 65, 'Lambda Expressions')}
    <line x1="40" y1="82" x2="760" y2="82" stroke="${AMBER}" stroke-width="2" opacity="0.3"/>
    ${card(40, 100, 430, 100)}
    <text x="60" y="125" fill="${AMBER}" font-size="12" font-weight="700">Syntax</text>
    <rect x="60" y="135" width="390" height="30" rx="6" fill="${SURFACE}"/>
    <text x="75" y="156" fill="${SKY}" font-size="13" font-family="monospace">(params) → expression</text>
    <rect x="60" y="170" width="390" height="22" rx="6" fill="${SURFACE}"/>
    <text x="75" y="186" fill="${SKY}" font-size="11" font-family="monospace">(a, b) → a + b   // replaces anonymous class</text>

    ${card(490, 100, 280, 100)}
    <text x="510" y="125" fill="${GREEN}" font-size="12" font-weight="700">Functional Interfaces</text>
    <text x="510" y="148" fill="${MUTED}" font-size="10">Predicate&lt;T&gt;  → boolean test(T)</text>
    <text x="510" y="165" fill="${MUTED}" font-size="10">Function&lt;T,R&gt; → R apply(T)</text>
    <text x="510" y="182" fill="${MUTED}" font-size="10">Consumer&lt;T&gt;  → void accept(T)</text>

    ${card(40, 220, 730, 95)}
    ${colorDot(70, 248, TEAL)}
    <text x="85" y="252" fill="${MUTED}" font-size="11">Uses invokedynamic (not anonymous inner classes) — more efficient</text>
    ${colorDot(70, 273, AMBER)}
    <text x="85" y="277" fill="${MUTED}" font-size="11">Captured variables must be effectively final (thread-safety)</text>
    ${colorDot(70, 298, ACCENT)}
    <text x="85" y="302" fill="${MUTED}" font-size="11">@FunctionalInterface annotation documents single abstract method</text>
  `),

  'q_map_flatmap': svgWrap(`
    ${badge(40, 25, 'COMPARISON', ACCENT)}
    ${title(40, 65, 'map() vs flatMap()')}
    <line x1="40" y1="82" x2="760" y2="82" stroke="${ACCENT}" stroke-width="2" opacity="0.3"/>
    ${card(40, 100, 350, 210)}
    <rect x="40" y="100" width="350" height="5" rx="2" fill="${BLUE}"/>
    <text x="215" y="130" fill="${BLUE}" font-size="14" font-weight="700" text-anchor="middle">map()</text>
    <text x="215" y="150" fill="${MUTED}" font-size="10" text-anchor="middle">One-to-One transformation</text>
    <rect x="80" y="165" width="60" height="28" rx="6" fill="${SURFACE}" stroke="${BLUE}" stroke-width="1"/>
    <text x="110" y="184" fill="${WHITE}" font-size="10" text-anchor="middle">A</text>
    <text x="155" y="184" fill="${MUTED}" font-size="12">→</text>
    <rect x="170" y="165" width="60" height="28" rx="6" fill="${BLUE}" opacity="0.2" stroke="${BLUE}" stroke-width="1"/>
    <text x="200" y="184" fill="${BLUE}" font-size="10" text-anchor="middle">A'</text>
    <rect x="80" y="200" width="60" height="28" rx="6" fill="${SURFACE}" stroke="${BLUE}" stroke-width="1"/>
    <text x="110" y="219" fill="${WHITE}" font-size="10" text-anchor="middle">B</text>
    <text x="155" y="219" fill="${MUTED}" font-size="12">→</text>
    <rect x="170" y="200" width="60" height="28" rx="6" fill="${BLUE}" opacity="0.2" stroke="${BLUE}" stroke-width="1"/>
    <text x="200" y="219" fill="${BLUE}" font-size="10" text-anchor="middle">B'</text>
    <rect x="70" y="265" width="290" height="28" rx="8" fill="${BLUE}" opacity="0.12"/>
    <text x="215" y="284" fill="${BLUE}" font-size="10" font-weight="600" text-anchor="middle">Each element → exactly one output</text>

    <circle cx="400" cy="205" r="18" fill="${ACCENT}" opacity="0.3"/>
    <text x="400" y="210" fill="${WHITE}" font-size="11" font-weight="800" text-anchor="middle">VS</text>

    ${card(420, 100, 350, 210)}
    <rect x="420" y="100" width="350" height="5" rx="2" fill="${GREEN}"/>
    <text x="595" y="130" fill="${GREEN}" font-size="14" font-weight="700" text-anchor="middle">flatMap()</text>
    <text x="595" y="150" fill="${MUTED}" font-size="10" text-anchor="middle">One-to-Many + Flatten</text>
    <rect x="460" y="165" width="60" height="28" rx="6" fill="${SURFACE}" stroke="${GREEN}" stroke-width="1"/>
    <text x="490" y="184" fill="${WHITE}" font-size="10" text-anchor="middle">A</text>
    <text x="535" y="178" fill="${MUTED}" font-size="12">→</text>
    <rect x="550" y="160" width="45" height="20" rx="4" fill="${GREEN}" opacity="0.2" stroke="${GREEN}" stroke-width="1"/>
    <text x="572" y="175" fill="${GREEN}" font-size="9" text-anchor="middle">A1</text>
    <rect x="600" y="160" width="45" height="20" rx="4" fill="${GREEN}" opacity="0.2" stroke="${GREEN}" stroke-width="1"/>
    <text x="622" y="175" fill="${GREEN}" font-size="9" text-anchor="middle">A2</text>
    <rect x="650" y="160" width="45" height="20" rx="4" fill="${GREEN}" opacity="0.2" stroke="${GREEN}" stroke-width="1"/>
    <text x="672" y="175" fill="${GREEN}" font-size="9" text-anchor="middle">A3</text>
    <rect x="460" y="200" width="60" height="28" rx="6" fill="${SURFACE}" stroke="${GREEN}" stroke-width="1"/>
    <text x="490" y="219" fill="${WHITE}" font-size="10" text-anchor="middle">B</text>
    <text x="535" y="213" fill="${MUTED}" font-size="12">→</text>
    <rect x="550" y="195" width="45" height="20" rx="4" fill="${GREEN}" opacity="0.2" stroke="${GREEN}" stroke-width="1"/>
    <text x="572" y="210" fill="${GREEN}" font-size="9" text-anchor="middle">B1</text>
    <rect x="600" y="195" width="45" height="20" rx="4" fill="${GREEN}" opacity="0.2" stroke="${GREEN}" stroke-width="1"/>
    <text x="622" y="210" fill="${GREEN}" font-size="9" text-anchor="middle">B2</text>
    <rect x="450" y="265" width="290" height="28" rx="8" fill="${GREEN}" opacity="0.12"/>
    <text x="595" y="284" fill="${GREEN}" font-size="10" font-weight="600" text-anchor="middle">Each element → Stream → Flattened</text>
  `),

  'q_terminal_ops': svgWrap(`
    ${badge(40, 25, 'CONCEPT', GREEN)}
    ${title(40, 65, 'Terminal Operations')}
    <line x1="40" y1="82" x2="760" y2="82" stroke="${GREEN}" stroke-width="2" opacity="0.3"/>
    ${card(40, 100, 230, 80)}
    <rect x="40" y="100" width="230" height="5" rx="2" fill="${TEAL}"/>
    <text x="155" y="128" fill="${TEAL}" font-size="12" font-weight="700" text-anchor="middle">collect()</text>
    <text x="155" y="148" fill="${MUTED}" font-size="10" text-anchor="middle">→ List, Map, Set, String</text>
    <text x="155" y="165" fill="${MUTED}" font-size="10" text-anchor="middle">Most versatile terminal op</text>

    ${card(290, 100, 230, 80)}
    <rect x="290" y="100" width="230" height="5" rx="2" fill="${AMBER}"/>
    <text x="405" y="128" fill="${AMBER}" font-size="12" font-weight="700" text-anchor="middle">reduce()</text>
    <text x="405" y="148" fill="${MUTED}" font-size="10" text-anchor="middle">Combines → single result</text>
    <text x="405" y="165" fill="${MUTED}" font-size="10" text-anchor="middle">Identity + BinaryOperator</text>

    ${card(540, 100, 230, 80)}
    <rect x="540" y="100" width="230" height="5" rx="2" fill="${ROSE}"/>
    <text x="655" y="128" fill="${ROSE}" font-size="12" font-weight="700" text-anchor="middle">forEach()</text>
    <text x="655" y="148" fill="${MUTED}" font-size="10" text-anchor="middle">Side effects (printing)</text>
    <text x="655" y="165" fill="${MUTED}" font-size="10" text-anchor="middle">No return value</text>

    ${card(40, 200, 350, 80)}
    <rect x="40" y="200" width="350" height="5" rx="2" fill="${BLUE}"/>
    <text x="215" y="228" fill="${BLUE}" font-size="12" font-weight="700" text-anchor="middle">Short-circuit</text>
    <text x="215" y="248" fill="${MUTED}" font-size="10" text-anchor="middle">findFirst() · anyMatch() · allMatch()</text>
    <text x="215" y="265" fill="${MUTED}" font-size="10" text-anchor="middle">Stop early — don't process all elements</text>

    ${card(420, 200, 350, 80)}
    <rect x="420" y="200" width="350" height="5" rx="2" fill="${GREEN}"/>
    <text x="595" y="228" fill="${GREEN}" font-size="12" font-weight="700" text-anchor="middle">Aggregation</text>
    <text x="595" y="248" fill="${MUTED}" font-size="10" text-anchor="middle">count() · min() · max()</text>
    <text x="595" y="265" fill="${MUTED}" font-size="10" text-anchor="middle">Statistical summaries of the stream</text>

    ${card(40, 295, 730, 30)}
    <text x="60" y="315" fill="${MUTED}" font-size="10">Terminal ops trigger the pipeline · Stream closes after execution · One terminal op per stream</text>
  `),

  'q_optional_null': svgWrap(`
    ${badge(40, 25, 'CONCEPT', GREEN)}
    ${title(40, 65, 'Optional — Null Safety')}
    <line x1="40" y1="82" x2="760" y2="82" stroke="${GREEN}" stroke-width="2" opacity="0.3"/>
    ${card(40, 100, 370, 80)}
    <text x="60" y="125" fill="${GREEN}" font-size="12" font-weight="700">Creation</text>
    <rect x="60" y="135" width="330" height="22" rx="6" fill="${SURFACE}"/>
    <text x="75" y="151" fill="${SKY}" font-size="10" font-family="monospace">Optional.of(val) | ofNullable(val) | empty()</text>
    <text x="60" y="172" fill="${MUTED}" font-size="9">of() throws on null · ofNullable() wraps safely · empty() = absent</text>

    ${card(430, 100, 340, 80)}
    <text x="450" y="125" fill="${AMBER}" font-size="12" font-weight="700">Retrieval</text>
    <rect x="450" y="135" width="300" height="22" rx="6" fill="${SURFACE}"/>
    <text x="465" y="151" fill="${SKY}" font-size="10" font-family="monospace">orElse() | orElseGet() | orElseThrow()</text>
    <text x="450" y="172" fill="${MUTED}" font-size="9">Safe fallback values · Never use get() directly</text>

    ${card(40, 200, 730, 115)}
    <text x="60" y="225" fill="${ACCENT}" font-size="12" font-weight="700">Functional Chaining</text>
    <rect x="60" y="238" width="690" height="28" rx="6" fill="${SURFACE}"/>
    <text x="75" y="258" fill="${SKY}" font-size="11" font-family="monospace">user.map(User::getAddr).map(Addr::getCity).orElse("Unknown")</text>
    ${colorDot(70, 285, GREEN)}
    <text x="85" y="289" fill="${MUTED}" font-size="10">map() transforms if present · flatMap() avoids double-wrapping · filter() conditional</text>
    ${colorDot(70, 305, ROSE)}
    <text x="85" y="309" fill="${MUTED}" font-size="10">Eliminates NullPointerException · Forces explicit null handling</text>
  `),

  // ── Spring Boot ──────────────────────────
  'spring_boot': svgWrap(`
    ${badge(40, 30, 'SECTION', GREEN)}
    ${title(40, 75, 'Spring Boot + Microservices')}
    ${subtitle(40, 100, 'Auto-configuration · REST APIs · JPA · Docker')}
    <line x1="40" y1="115" x2="760" y2="115" stroke="${GREEN}" stroke-width="2" opacity="0.3"/>
    ${pillBox(40, 140, 170, 80, GREEN, 'Spring Boot', '🍃')}
    ${pillBox(230, 140, 170, 80, BLUE, 'REST APIs', '🌐')}
    ${pillBox(420, 140, 170, 80, AMBER, 'JPA/Hibernate', '🗄️')}
    ${pillBox(610, 140, 170, 80, SKY, 'Docker', '🐳')}
    ${card(40, 245, 720, 70)}
    <text x="60" y="272" fill="${MUTED}" font-size="11">Enterprise Java development with convention over configuration,</text>
    <text x="60" y="292" fill="${MUTED}" font-size="11">embedded servers, and production-ready containerization.</text>
  `),

  'q_spring_core': svgWrap(`
    ${badge(40, 25, 'CONCEPT', GREEN)}
    ${title(40, 65, 'What is Spring Boot?')}
    <line x1="40" y1="82" x2="760" y2="82" stroke="${GREEN}" stroke-width="2" opacity="0.3"/>
    ${card(40, 100, 730, 215)}
    ${colorDot(70, 130, GREEN)}
    <text x="85" y="134" fill="${WHITE}" font-size="12" font-weight="600">Opinionated framework built on Spring ecosystem</text>
    ${colorDot(70, 158, TEAL)}
    <text x="85" y="162" fill="${MUTED}" font-size="11">Auto-configuration: scans classpath → configures beans automatically</text>
    ${colorDot(70, 183, AMBER)}
    <text x="85" y="187" fill="${MUTED}" font-size="11">Embedded server: standalone JAR with Tomcat/Jetty (no WAR deployment)</text>
    ${colorDot(70, 208, BLUE)}
    <text x="85" y="212" fill="${MUTED}" font-size="11">Starter dependencies: curated library bundles (web, data, security)</text>
    ${colorDot(70, 233, ACCENT)}
    <text x="85" y="237" fill="${MUTED}" font-size="11">application.properties/yml: centralized config for all environments</text>
    <rect x="60" y="260" width="690" height="35" rx="8" fill="${GREEN}" opacity="0.1"/>
    <text x="80" y="282" fill="${GREEN}" font-size="11" font-weight="600">Convention over Configuration → Zero XML → Production-ready in minutes</text>
  `),

  'q_spring_starters': svgWrap(`
    ${badge(40, 25, 'CONCEPT', BLUE)}
    ${title(40, 65, 'Spring Boot Starters')}
    <line x1="40" y1="82" x2="760" y2="82" stroke="${BLUE}" stroke-width="2" opacity="0.3"/>
    ${card(40, 100, 230, 70)}
    <rect x="40" y="100" width="230" height="4" rx="2" fill="${GREEN}"/>
    <text x="155" y="125" fill="${GREEN}" font-size="11" font-weight="700" text-anchor="middle">starter-web</text>
    <text x="155" y="145" fill="${MUTED}" font-size="9" text-anchor="middle">MVC + Tomcat + Jackson</text>
    ${card(290, 100, 230, 70)}
    <rect x="290" y="100" width="230" height="4" rx="2" fill="${BLUE}"/>
    <text x="405" y="125" fill="${BLUE}" font-size="11" font-weight="700" text-anchor="middle">starter-data-jpa</text>
    <text x="405" y="145" fill="${MUTED}" font-size="9" text-anchor="middle">JPA + Hibernate + HikariCP</text>
    ${card(540, 100, 230, 70)}
    <rect x="540" y="100" width="230" height="4" rx="2" fill="${ROSE}"/>
    <text x="655" y="125" fill="${ROSE}" font-size="11" font-weight="700" text-anchor="middle">starter-security</text>
    <text x="655" y="145" fill="${MUTED}" font-size="9" text-anchor="middle">Auth + CSRF + Form login</text>
    ${card(40, 185, 230, 70)}
    <rect x="40" y="185" width="230" height="4" rx="2" fill="${AMBER}"/>
    <text x="155" y="210" fill="${AMBER}" font-size="11" font-weight="700" text-anchor="middle">starter-test</text>
    <text x="155" y="230" fill="${MUTED}" font-size="9" text-anchor="middle">JUnit + Mockito + Spring Test</text>
    ${card(290, 185, 230, 70)}
    <rect x="290" y="185" width="230" height="4" rx="2" fill="${TEAL}"/>
    <text x="405" y="210" fill="${TEAL}" font-size="11" font-weight="700" text-anchor="middle">starter-actuator</text>
    <text x="405" y="230" fill="${MUTED}" font-size="9" text-anchor="middle">Health + Metrics + Monitoring</text>
    ${card(540, 185, 230, 70)}
    <rect x="540" y="185" width="230" height="4" rx="2" fill="${ACCENT}"/>
    <text x="655" y="210" fill="${ACCENT}" font-size="11" font-weight="700" text-anchor="middle">Custom Starters</text>
    <text x="655" y="230" fill="${MUTED}" font-size="9" text-anchor="middle">Org-wide shared configs</text>
    ${card(40, 275, 730, 40)}
    <text x="60" y="300" fill="${MUTED}" font-size="10">Parent POM manages version alignment — eliminates "dependency hell"</text>
  `),

  'q_spring_annotation': svgWrap(`
    ${badge(40, 25, 'ANNOTATION', ACCENT)}
    ${title(40, 65, '@SpringBootApplication')}
    <line x1="40" y1="82" x2="760" y2="82" stroke="${ACCENT}" stroke-width="2" opacity="0.3"/>
    <text x="400" y="115" fill="${WHITE}" font-size="12" font-weight="700" text-anchor="middle">=  @Configuration  +  @EnableAutoConfiguration  +  @ComponentScan</text>
    ${card(40, 135, 230, 100)}
    <rect x="40" y="135" width="230" height="5" rx="2" fill="${TEAL}"/>
    <text x="155" y="165" fill="${TEAL}" font-size="12" font-weight="700" text-anchor="middle">@Configuration</text>
    <text x="155" y="185" fill="${MUTED}" font-size="10" text-anchor="middle">Bean definitions via @Bean</text>
    <text x="155" y="202" fill="${MUTED}" font-size="10" text-anchor="middle">Java-based config (no XML)</text>
    ${card(290, 135, 230, 100)}
    <rect x="290" y="135" width="230" height="5" rx="2" fill="${AMBER}"/>
    <text x="405" y="165" fill="${AMBER}" font-size="12" font-weight="700" text-anchor="middle">@EnableAutoConfig</text>
    <text x="405" y="185" fill="${MUTED}" font-size="10" text-anchor="middle">Classpath scanning</text>
    <text x="405" y="202" fill="${MUTED}" font-size="10" text-anchor="middle">spring.factories → auto beans</text>
    ${card(540, 135, 230, 100)}
    <rect x="540" y="135" width="230" height="5" rx="2" fill="${GREEN}"/>
    <text x="655" y="165" fill="${GREEN}" font-size="12" font-weight="700" text-anchor="middle">@ComponentScan</text>
    <text x="655" y="185" fill="${MUTED}" font-size="10" text-anchor="middle">Discovers @Component,</text>
    <text x="655" y="202" fill="${MUTED}" font-size="10" text-anchor="middle">@Service, @Controller</text>
    ${card(40, 255, 730, 60)}
    <text x="60" y="280" fill="${MUTED}" font-size="10">Place main class at root package → all sub-packages auto-scanned</text>
    <text x="60" y="300" fill="${MUTED}" font-size="10">The single entry point annotation that bootstraps your entire application</text>
  `),

  'q_actuator': svgWrap(`
    ${badge(40, 25, 'MONITORING', TEAL)}
    ${title(40, 65, 'Spring Boot Actuator')}
    <line x1="40" y1="82" x2="760" y2="82" stroke="${TEAL}" stroke-width="2" opacity="0.3"/>
    ${card(40, 100, 175, 80)}
    <rect x="40" y="100" width="175" height="4" rx="2" fill="${GREEN}"/>
    <text x="127" y="125" fill="${GREEN}" font-size="11" font-weight="700" text-anchor="middle">/health</text>
    <text x="127" y="145" fill="${MUTED}" font-size="9" text-anchor="middle">App + DB + disk status</text>
    <text x="127" y="160" fill="${MUTED}" font-size="9" text-anchor="middle">Used by K8s probes</text>
    ${card(230, 100, 175, 80)}
    <rect x="230" y="100" width="175" height="4" rx="2" fill="${BLUE}"/>
    <text x="317" y="125" fill="${BLUE}" font-size="11" font-weight="700" text-anchor="middle">/metrics</text>
    <text x="317" y="145" fill="${MUTED}" font-size="9" text-anchor="middle">JVM, GC, HTTP latency</text>
    <text x="317" y="160" fill="${MUTED}" font-size="9" text-anchor="middle">Prometheus compatible</text>
    ${card(420, 100, 175, 80)}
    <rect x="420" y="100" width="175" height="4" rx="2" fill="${AMBER}"/>
    <text x="507" y="125" fill="${AMBER}" font-size="11" font-weight="700" text-anchor="middle">/loggers</text>
    <text x="507" y="145" fill="${MUTED}" font-size="9" text-anchor="middle">Dynamic log levels</text>
    <text x="507" y="160" fill="${MUTED}" font-size="9" text-anchor="middle">No restart needed</text>
    ${card(610, 100, 160, 80)}
    <rect x="610" y="100" width="160" height="4" rx="2" fill="${ROSE}"/>
    <text x="690" y="125" fill="${ROSE}" font-size="11" font-weight="700" text-anchor="middle">/env</text>
    <text x="690" y="145" fill="${MUTED}" font-size="9" text-anchor="middle">Environment props</text>
    <text x="690" y="160" fill="${MUTED}" font-size="9" text-anchor="middle">Active profiles</text>
    ${card(40, 200, 730, 50)}
    <text x="60" y="225" fill="${MUTED}" font-size="10">Other endpoints: /info, /threaddump, /heapdump — enable via management.endpoints.web.exposure.include</text>
    <text x="60" y="240" fill="${MUTED}" font-size="10">Only /health and /info exposed by default (security best practice)</text>
  `),

  // ── REST API & Spring Web ──────────────────
  'rest_api_docker': svgWrap(`
    ${badge(40, 30, 'SECTION', BLUE)}
    ${title(40, 75, 'REST API & Docker')}
    ${subtitle(40, 100, 'HTTP methods · Controllers · JPA · Containerization')}
    <line x1="40" y1="115" x2="760" y2="115" stroke="${BLUE}" stroke-width="2" opacity="0.3"/>
    ${pillBox(40, 140, 170, 80, BLUE, 'REST Methods', '🌐')}
    ${pillBox(230, 140, 170, 80, AMBER, 'Controllers', '🎮')}
    ${pillBox(420, 140, 170, 80, GREEN, 'JPA', '🗄️')}
    ${pillBox(610, 140, 170, 80, SKY, 'Docker', '🐳')}
    ${card(40, 245, 720, 70)}
    <text x="60" y="272" fill="${MUTED}" font-size="11">Building production-ready APIs with Spring MVC,</text>
    <text x="60" y="292" fill="${MUTED}" font-size="11">persisting data with Hibernate, containerizing with Docker.</text>
  `),

  'q_rest_methods': svgWrap(`
    ${badge(40, 25, 'HTTP', BLUE)}
    ${title(40, 65, 'REST HTTP Methods')}
    <line x1="40" y1="82" x2="760" y2="82" stroke="${BLUE}" stroke-width="2" opacity="0.3"/>
    ${card(40, 100, 140, 65)}
    <rect x="40" y="100" width="140" height="4" rx="2" fill="${GREEN}"/>
    <text x="110" y="125" fill="${GREEN}" font-size="13" font-weight="700" text-anchor="middle">GET</text>
    <text x="110" y="145" fill="${MUTED}" font-size="9" text-anchor="middle">Retrieve · Safe</text>
    ${card(195, 100, 140, 65)}
    <rect x="195" y="100" width="140" height="4" rx="2" fill="${BLUE}"/>
    <text x="265" y="125" fill="${BLUE}" font-size="13" font-weight="700" text-anchor="middle">POST</text>
    <text x="265" y="145" fill="${MUTED}" font-size="9" text-anchor="middle">Create · Not idempotent</text>
    ${card(350, 100, 140, 65)}
    <rect x="350" y="100" width="140" height="4" rx="2" fill="${AMBER}"/>
    <text x="420" y="125" fill="${AMBER}" font-size="13" font-weight="700" text-anchor="middle">PUT</text>
    <text x="420" y="145" fill="${MUTED}" font-size="9" text-anchor="middle">Replace · Idempotent</text>
    ${card(505, 100, 140, 65)}
    <rect x="505" y="100" width="140" height="4" rx="2" fill="${ACCENT}"/>
    <text x="575" y="125" fill="${ACCENT}" font-size="13" font-weight="700" text-anchor="middle">PATCH</text>
    <text x="575" y="145" fill="${MUTED}" font-size="9" text-anchor="middle">Partial update</text>
    ${card(660, 100, 110, 65)}
    <rect x="660" y="100" width="110" height="4" rx="2" fill="${ROSE}"/>
    <text x="715" y="125" fill="${ROSE}" font-size="13" font-weight="700" text-anchor="middle">DELETE</text>
    <text x="715" y="145" fill="${MUTED}" font-size="9" text-anchor="middle">Remove</text>
    ${card(40, 185, 730, 130)}
    <text x="60" y="210" fill="${WHITE}" font-size="12" font-weight="600">Status Codes</text>
    <text x="60" y="232" fill="${GREEN}" font-size="10">2xx Success:</text><text x="140" y="232" fill="${MUTED}" font-size="10">200 OK · 201 Created · 204 No Content</text>
    <text x="60" y="252" fill="${AMBER}" font-size="10">4xx Client:</text><text x="140" y="252" fill="${MUTED}" font-size="10">400 Bad Request · 401 Unauthorized · 404 Not Found</text>
    <text x="60" y="272" fill="${ROSE}" font-size="10">5xx Server:</text><text x="140" y="272" fill="${MUTED}" font-size="10">500 Internal Error · 503 Service Unavailable</text>
    <text x="60" y="300" fill="${MUTED}" font-size="10">Best practice: nouns for URIs (/users), plural collections, API versioning (v1/)</text>
  `),

  'q_controller': svgWrap(`
    ${badge(40, 25, 'COMPARISON', AMBER)}
    ${title(40, 65, '@Controller vs @RestController')}
    <line x1="40" y1="82" x2="760" y2="82" stroke="${AMBER}" stroke-width="2" opacity="0.3"/>
    ${card(40, 100, 350, 180)}
    <rect x="40" y="100" width="350" height="5" rx="2" fill="${BLUE}"/>
    <text x="215" y="130" fill="${BLUE}" font-size="14" font-weight="700" text-anchor="middle">@Controller</text>
    ${colorDot(70, 155, BLUE)}
    <text x="85" y="159" fill="${MUTED}" font-size="11">Returns view names (HTML)</text>
    ${colorDot(70, 178, BLUE)}
    <text x="85" y="182" fill="${MUTED}" font-size="11">ViewResolver → Thymeleaf/JSP</text>
    ${colorDot(70, 201, BLUE)}
    <text x="85" y="205" fill="${MUTED}" font-size="11">Server-side rendered pages</text>
    <rect x="70" y="230" width="290" height="28" rx="8" fill="${BLUE}" opacity="0.12"/>
    <text x="215" y="249" fill="${BLUE}" font-size="10" font-weight="600" text-anchor="middle">Return "index" → renders template</text>

    <circle cx="400" cy="195" r="18" fill="${ACCENT}" opacity="0.3"/>
    <text x="400" y="200" fill="${WHITE}" font-size="11" font-weight="800" text-anchor="middle">VS</text>

    ${card(420, 100, 350, 180)}
    <rect x="420" y="100" width="350" height="5" rx="2" fill="${GREEN}"/>
    <text x="595" y="130" fill="${GREEN}" font-size="14" font-weight="700" text-anchor="middle">@RestController</text>
    ${colorDot(450, 155, GREEN)}
    <text x="465" y="159" fill="${MUTED}" font-size="11">= @Controller + @ResponseBody</text>
    ${colorDot(450, 178, GREEN)}
    <text x="465" y="182" fill="${MUTED}" font-size="11">Returns JSON/XML directly</text>
    ${colorDot(450, 201, GREEN)}
    <text x="465" y="205" fill="${MUTED}" font-size="11">REST API for SPA frontends</text>
    <rect x="450" y="230" width="290" height="28" rx="8" fill="${GREEN}" opacity="0.12"/>
    <text x="595" y="249" fill="${GREEN}" font-size="10" font-weight="600" text-anchor="middle">Return object → serialized to JSON</text>
  `),

  'q_exception': svgWrap(`
    ${badge(40, 25, 'PATTERN', ROSE)}
    ${title(40, 65, 'Global Exception Handling')}
    <line x1="40" y1="82" x2="760" y2="82" stroke="${ROSE}" stroke-width="2" opacity="0.3"/>
    ${card(40, 100, 730, 215)}
    <rect x="60" y="120" width="690" height="28" rx="6" fill="${SURFACE}"/>
    <text x="75" y="140" fill="${ACCENT}" font-size="11" font-family="monospace">@ControllerAdvice + @ExceptionHandler</text>
    <text x="60" y="175" fill="${WHITE}" font-size="11" font-weight="600">Exception → HTTP Status Mapping:</text>
    ${colorDot(70, 200, AMBER)}
    <text x="85" y="204" fill="${MUTED}" font-size="11">ResourceNotFoundException → 404 Not Found</text>
    ${colorDot(70, 225, ROSE)}
    <text x="85" y="229" fill="${MUTED}" font-size="11">ValidationException → 400 Bad Request</text>
    ${colorDot(70, 250, ACCENT)}
    <text x="85" y="254" fill="${MUTED}" font-size="11">AccessDeniedException → 403 Forbidden</text>
    ${colorDot(70, 275, BLUE)}
    <text x="85" y="279" fill="${MUTED}" font-size="11">Exception (catch-all) → 500 Internal Server Error</text>
    <rect x="60" y="290" width="690" height="20" rx="6" fill="${ROSE}" opacity="0.1"/>
    <text x="75" y="305" fill="${ROSE}" font-size="9" font-weight="600">Consistent error responses without try-catch in every controller</text>
  `),

  'q_jpa_orm': svgWrap(`
    ${badge(40, 25, 'CONCEPT', AMBER)}
    ${title(40, 65, 'JPA — Object-Relational Mapping')}
    <line x1="40" y1="82" x2="760" y2="82" stroke="${AMBER}" stroke-width="2" opacity="0.3"/>
    ${card(40, 100, 310, 70)}
    <text x="195" y="125" fill="${WHITE}" font-size="14" text-anchor="middle">Java Object</text>
    <rect x="60" y="135" width="270" height="22" rx="6" fill="${SURFACE}"/>
    <text x="75" y="151" fill="${SKY}" font-size="10" font-family="monospace">@Entity User { id, name, email }</text>
    <text x="365" y="140" fill="${AMBER}" font-size="20">⇌</text>
    ${card(400, 100, 370, 70)}
    <text x="585" y="125" fill="${WHITE}" font-size="14" text-anchor="middle">Database Table</text>
    <rect x="420" y="135" width="330" height="22" rx="6" fill="${SURFACE}"/>
    <text x="435" y="151" fill="${SKY}" font-size="10" font-family="monospace">users (id, name, email) — SQL table</text>
    ${card(40, 190, 730, 125)}
    ${colorDot(70, 218, GREEN)}
    <text x="85" y="222" fill="${MUTED}" font-size="11">JPA = specification · Hibernate = implementation</text>
    ${colorDot(70, 243, BLUE)}
    <text x="85" y="247" fill="${MUTED}" font-size="11">Spring Data JPA: Repository pattern → auto CRUD without SQL</text>
    ${colorDot(70, 268, AMBER)}
    <text x="85" y="272" fill="${MUTED}" font-size="11">Derived queries: findByEmailAndStatus() → auto-generates WHERE clause</text>
    ${colorDot(70, 293, ACCENT)}
    <text x="85" y="297" fill="${MUTED}" font-size="11">@Query for custom JPQL/native SQL, Specification API for dynamic queries</text>
  `),

  'q_jpa_annotations': svgWrap(`
    ${badge(40, 25, 'ANNOTATIONS', AMBER)}
    ${title(40, 65, 'JPA Annotations')}
    <line x1="40" y1="82" x2="760" y2="82" stroke="${AMBER}" stroke-width="2" opacity="0.3"/>
    ${card(40, 100, 350, 190)}
    <text x="60" y="125" fill="${WHITE}" font-size="12" font-weight="700">Entity Mapping</text>
    <rect x="60" y="138" width="310" height="22" rx="6" fill="${SURFACE}"/>
    <text x="75" y="154" fill="${TEAL}" font-size="10" font-family="monospace">@Entity — marks JPA entity</text>
    <rect x="60" y="165" width="310" height="22" rx="6" fill="${SURFACE}"/>
    <text x="75" y="181" fill="${AMBER}" font-size="10" font-family="monospace">@Table(name = "users")</text>
    <rect x="60" y="192" width="310" height="22" rx="6" fill="${SURFACE}"/>
    <text x="75" y="208" fill="${BLUE}" font-size="10" font-family="monospace">@Id + @GeneratedValue</text>
    <rect x="60" y="219" width="310" height="22" rx="6" fill="${SURFACE}"/>
    <text x="75" y="235" fill="${GREEN}" font-size="10" font-family="monospace">@Column(nullable, unique, length)</text>
    <text x="60" y="268" fill="${MUTED}" font-size="9">@Transient excludes from persistence</text>

    ${card(420, 100, 350, 190)}
    <text x="440" y="125" fill="${WHITE}" font-size="12" font-weight="700">Relationships</text>
    <rect x="440" y="138" width="310" height="22" rx="6" fill="${SURFACE}"/>
    <text x="455" y="154" fill="${TEAL}" font-size="10" font-family="monospace">@OneToMany / @ManyToOne</text>
    <rect x="440" y="165" width="310" height="22" rx="6" fill="${SURFACE}"/>
    <text x="455" y="181" fill="${AMBER}" font-size="10" font-family="monospace">@ManyToMany (join table)</text>
    <rect x="440" y="192" width="310" height="22" rx="6" fill="${SURFACE}"/>
    <text x="455" y="208" fill="${BLUE}" font-size="10" font-family="monospace">@JoinColumn (foreign key)</text>
    <rect x="440" y="219" width="310" height="22" rx="6" fill="${SURFACE}"/>
    <text x="455" y="235" fill="${GREEN}" font-size="10" font-family="monospace">FetchType.LAZY (recommended)</text>
    <text x="440" y="268" fill="${MUTED}" font-size="9">Lazy loading = load on access (performance)</text>
  `),

  'q_docker': svgWrap(`
    ${badge(40, 25, 'DEVOPS', SKY)}
    ${title(40, 65, 'Docker — Containerization')}
    <line x1="40" y1="82" x2="760" y2="82" stroke="${SKY}" stroke-width="2" opacity="0.3"/>
    ${card(40, 100, 230, 100)}
    <rect x="40" y="100" width="230" height="4" rx="2" fill="${SKY}"/>
    <text x="155" y="125" fill="${SKY}" font-size="12" font-weight="700" text-anchor="middle">Dockerfile</text>
    <text x="155" y="145" fill="${MUTED}" font-size="10" text-anchor="middle">Build recipe: base image,</text>
    <text x="155" y="162" fill="${MUTED}" font-size="10" text-anchor="middle">COPY code, RUN install,</text>
    <text x="155" y="179" fill="${MUTED}" font-size="10" text-anchor="middle">CMD startup command</text>
    ${card(290, 100, 230, 100)}
    <rect x="290" y="100" width="230" height="4" rx="2" fill="${TEAL}"/>
    <text x="405" y="125" fill="${TEAL}" font-size="12" font-weight="700" text-anchor="middle">Image</text>
    <text x="405" y="145" fill="${MUTED}" font-size="10" text-anchor="middle">Immutable template</text>
    <text x="405" y="162" fill="${MUTED}" font-size="10" text-anchor="middle">Versioned, stored in</text>
    <text x="405" y="179" fill="${MUTED}" font-size="10" text-anchor="middle">Docker Hub / ECR</text>
    ${card(540, 100, 230, 100)}
    <rect x="540" y="100" width="230" height="4" rx="2" fill="${GREEN}"/>
    <text x="655" y="125" fill="${GREEN}" font-size="12" font-weight="700" text-anchor="middle">Container</text>
    <text x="655" y="145" fill="${MUTED}" font-size="10" text-anchor="middle">Running instance of image</text>
    <text x="655" y="162" fill="${MUTED}" font-size="10" text-anchor="middle">Isolated filesystem,</text>
    <text x="655" y="179" fill="${MUTED}" font-size="10" text-anchor="middle">networking, processes</text>
    ${card(40, 220, 730, 95)}
    <text x="60" y="248" fill="${WHITE}" font-size="12" font-weight="600">docker-compose</text>
    <text x="60" y="268" fill="${MUTED}" font-size="10">Multi-container orchestration: app + DB + cache + proxy in one YAML file</text>
    <text x="60" y="290" fill="${SKY}" font-size="10" font-weight="600">docker-compose up → start entire stack with networking + volumes</text>
  `),

  // ── DSA ──────────────────────────
  'dsa_algorithms': svgWrap(`
    ${badge(40, 30, 'SECTION', AMBER)}
    ${title(40, 75, 'Data Structures & Algorithms')}
    ${subtitle(40, 100, 'Arrays · Trees · Graphs · Dynamic Programming')}
    <line x1="40" y1="115" x2="760" y2="115" stroke="${AMBER}" stroke-width="2" opacity="0.3"/>
    ${pillBox(40, 140, 170, 80, TEAL, 'Arrays/Strings', '📊')}
    ${pillBox(230, 140, 170, 80, GREEN, 'Trees/Graphs', '🌳')}
    ${pillBox(420, 140, 170, 80, AMBER, 'Dynamic Prog', '🧩')}
    ${pillBox(610, 140, 170, 80, BLUE, 'Sorting/Search', '🔍')}
    ${card(40, 245, 720, 70)}
    <text x="60" y="272" fill="${MUTED}" font-size="11">Core algorithmic patterns for coding interviews:</text>
    <text x="60" y="292" fill="${MUTED}" font-size="11">time-space trade-offs, optimal substructure, graph traversal.</text>
  `),

  'q_kadane': svgWrap(`
    ${badge(40, 25, 'ALGORITHM', TEAL)}
    ${title(40, 65, "Kadane's Algorithm")}
    <line x1="40" y1="82" x2="760" y2="82" stroke="${TEAL}" stroke-width="2" opacity="0.3"/>
    ${card(40, 100, 730, 100)}
    <text x="60" y="125" fill="${WHITE}" font-size="12" font-weight="700">Maximum Subarray Sum — O(n) time, O(1) space</text>
    <rect x="60" y="140" width="690" height="22" rx="6" fill="${SURFACE}"/>
    <text x="75" y="156" fill="${SKY}" font-size="10" font-family="monospace">maxEndingHere = max(arr[i], maxEndingHere + arr[i])</text>
    <rect x="60" y="168" width="690" height="22" rx="6" fill="${SURFACE}"/>
    <text x="75" y="184" fill="${SKY}" font-size="10" font-family="monospace">maxSoFar = max(maxSoFar, maxEndingHere)</text>
    ${card(40, 220, 730, 95)}
    ${colorDot(70, 248, TEAL)}
    <text x="85" y="252" fill="${MUTED}" font-size="11">If running sum goes negative → start fresh from next element</text>
    ${colorDot(70, 273, AMBER)}
    <text x="85" y="277" fill="${MUTED}" font-size="11">Greedy choice at every step guarantees global optimum</text>
    ${colorDot(70, 298, BLUE)}
    <text x="85" y="302" fill="${MUTED}" font-size="11">Variations: find actual subarray, all-negative arrays, 2D matrix version</text>
  `),

  'q_duplicates': svgWrap(`
    ${badge(40, 25, 'PATTERN', AMBER)}
    ${title(40, 65, 'Duplicate Detection')}
    <line x1="40" y1="82" x2="760" y2="82" stroke="${AMBER}" stroke-width="2" opacity="0.3"/>
    ${card(40, 100, 350, 120)}
    <rect x="40" y="100" width="350" height="5" rx="2" fill="${GREEN}"/>
    <text x="215" y="130" fill="${GREEN}" font-size="13" font-weight="700" text-anchor="middle">HashSet Approach</text>
    ${colorDot(70, 155, GREEN)}
    <text x="85" y="159" fill="${MUTED}" font-size="11">O(n) time, O(n) space</text>
    ${colorDot(70, 178, GREEN)}
    <text x="85" y="182" fill="${MUTED}" font-size="11">add() returns false if exists</text>
    <rect x="70" y="195" width="290" height="16" rx="4" fill="${GREEN}" opacity="0.1"/>
    <text x="215" y="208" fill="${GREEN}" font-size="9" font-weight="600" text-anchor="middle">Best when space is not constrained</text>

    ${card(420, 100, 350, 120)}
    <rect x="420" y="100" width="350" height="5" rx="2" fill="${BLUE}"/>
    <text x="595" y="130" fill="${BLUE}" font-size="13" font-weight="700" text-anchor="middle">Sort + Scan Approach</text>
    ${colorDot(450, 155, BLUE)}
    <text x="465" y="159" fill="${MUTED}" font-size="11">O(n log n) time, O(1) space</text>
    ${colorDot(450, 178, BLUE)}
    <text x="465" y="182" fill="${MUTED}" font-size="11">Check adjacent elements</text>
    <rect x="450" y="195" width="290" height="16" rx="4" fill="${BLUE}" opacity="0.1"/>
    <text x="595" y="208" fill="${BLUE}" font-size="9" font-weight="600" text-anchor="middle">Best when memory is limited</text>

    ${card(40, 240, 730, 75)}
    <text x="60" y="265" fill="${WHITE}" font-size="11" font-weight="600">Other approaches:</text>
    <text x="60" y="285" fill="${MUTED}" font-size="10">Boolean array (bounded range) · Bit manipulation · Floyd's cycle detection (values in [1,n])</text>
    <text x="60" y="302" fill="${MUTED}" font-size="10">Classic time-space trade-off — choose based on constraints</text>
  `),

  'q_two_pointer': svgWrap(`
    ${badge(40, 25, 'TECHNIQUE', ACCENT)}
    ${title(40, 65, 'Two Pointer Technique')}
    <line x1="40" y1="82" x2="760" y2="82" stroke="${ACCENT}" stroke-width="2" opacity="0.3"/>
    ${card(40, 100, 730, 75)}
    <text x="60" y="125" fill="${WHITE}" font-size="12" font-weight="700">Converging Pointers (sorted array)</text>
    <!-- Array visualization -->
    ${[1,2,4,6,7,9,11].map((v,i) => `<rect x="${80+i*90}" y="138" width="70" height="28" rx="6" fill="${SURFACE}" stroke="${i===0?GREEN:i===6?ROSE:BORDER}" stroke-width="${i===0||i===6?2:1}"/><text x="${115+i*90}" y="157" fill="${i===0?GREEN:i===6?ROSE:WHITE}" font-size="11" text-anchor="middle">${v}</text>`).join('\n    ')}
    <text x="115" y="180" fill="${GREEN}" font-size="9" font-weight="700" text-anchor="middle">L →</text>
    <text x="705" y="180" fill="${ROSE}" font-size="9" font-weight="700" text-anchor="middle">← R</text>

    ${card(40, 195, 350, 120)}
    <text x="60" y="220" fill="${BLUE}" font-size="11" font-weight="700">Fast-Slow Pointer</text>
    ${colorDot(70, 242, BLUE)}
    <text x="85" y="246" fill="${MUTED}" font-size="10">Cycle detection (Floyd's)</text>
    ${colorDot(70, 262, BLUE)}
    <text x="85" y="266" fill="${MUTED}" font-size="10">Find middle of linked list</text>
    ${colorDot(70, 282, BLUE)}
    <text x="85" y="286" fill="${MUTED}" font-size="10">Palindrome detection</text>

    ${card(420, 195, 350, 120)}
    <text x="440" y="220" fill="${AMBER}" font-size="11" font-weight="700">Sliding Window</text>
    ${colorDot(450, 242, AMBER)}
    <text x="465" y="246" fill="${MUTED}" font-size="10">Longest substring (no dups)</text>
    ${colorDot(450, 262, AMBER)}
    <text x="465" y="266" fill="${MUTED}" font-size="10">Min window substring</text>
    ${colorDot(450, 282, AMBER)}
    <text x="465" y="286" fill="${MUTED}" font-size="10">Max sum subarray of size k</text>
  `),

  'q_tree_traversal': svgWrap(`
    ${badge(40, 25, 'CONCEPT', GREEN)}
    ${title(40, 65, 'Tree Traversal Methods')}
    <line x1="40" y1="82" x2="760" y2="82" stroke="${GREEN}" stroke-width="2" opacity="0.3"/>
    ${card(40, 100, 175, 100)}
    <rect x="40" y="100" width="175" height="4" rx="2" fill="${TEAL}"/>
    <text x="127" y="125" fill="${TEAL}" font-size="12" font-weight="700" text-anchor="middle">Inorder (L,R,N)</text>
    <text x="127" y="148" fill="${MUTED}" font-size="10" text-anchor="middle">Left → Root → Right</text>
    <text x="127" y="168" fill="${MUTED}" font-size="9" text-anchor="middle">Sorted order for BST</text>
    <text x="127" y="185" fill="${TEAL}" font-size="9" font-weight="600" text-anchor="middle">BST validation</text>
    ${card(230, 100, 175, 100)}
    <rect x="230" y="100" width="175" height="4" rx="2" fill="${AMBER}"/>
    <text x="317" y="125" fill="${AMBER}" font-size="12" font-weight="700" text-anchor="middle">Preorder (N,L,R)</text>
    <text x="317" y="148" fill="${MUTED}" font-size="10" text-anchor="middle">Root → Left → Right</text>
    <text x="317" y="168" fill="${MUTED}" font-size="9" text-anchor="middle">Copy/serialize tree</text>
    <text x="317" y="185" fill="${AMBER}" font-size="9" font-weight="600" text-anchor="middle">Tree reconstruction</text>
    ${card(420, 100, 175, 100)}
    <rect x="420" y="100" width="175" height="4" rx="2" fill="${ROSE}"/>
    <text x="507" y="125" fill="${ROSE}" font-size="12" font-weight="700" text-anchor="middle">Postorder (L,R,N)</text>
    <text x="507" y="148" fill="${MUTED}" font-size="10" text-anchor="middle">Left → Right → Root</text>
    <text x="507" y="168" fill="${MUTED}" font-size="9" text-anchor="middle">Delete tree safely</text>
    <text x="507" y="185" fill="${ROSE}" font-size="9" font-weight="600" text-anchor="middle">Directory sizes</text>
    ${card(610, 100, 160, 100)}
    <rect x="610" y="100" width="160" height="4" rx="2" fill="${BLUE}"/>
    <text x="690" y="125" fill="${BLUE}" font-size="12" font-weight="700" text-anchor="middle">Level-order</text>
    <text x="690" y="148" fill="${MUTED}" font-size="10" text-anchor="middle">BFS with queue</text>
    <text x="690" y="168" fill="${MUTED}" font-size="9" text-anchor="middle">Level by level</text>
    <text x="690" y="185" fill="${BLUE}" font-size="9" font-weight="600" text-anchor="middle">Shortest path</text>
    ${card(40, 220, 730, 95)}
    <text x="60" y="245" fill="${WHITE}" font-size="11" font-weight="600">All DFS traversals: O(n) time, O(h) space — h = tree height</text>
    <text x="60" y="268" fill="${MUTED}" font-size="10">Recursive or iterative (explicit stack) implementation</text>
    <text x="60" y="290" fill="${MUTED}" font-size="10">BFS: O(n) time, O(w) space — w = max width (queue size)</text>
  `),

  'q_bst': svgWrap(`
    ${badge(40, 25, 'DATA STRUCTURE', GREEN)}
    ${title(40, 65, 'Binary Search Tree')}
    <line x1="40" y1="82" x2="760" y2="82" stroke="${GREEN}" stroke-width="2" opacity="0.3"/>
    ${card(40, 100, 730, 215)}
    <text x="60" y="125" fill="${WHITE}" font-size="13" font-weight="700">Property: left &lt; root &lt; right (for every node)</text>
    <text x="60" y="150" fill="${MUTED}" font-size="11">Operations are O(h) where h = height</text>
    ${colorDot(70, 178, GREEN)}
    <text x="85" y="182" fill="${MUTED}" font-size="11">Balanced BST: h = O(log n) → fast operations</text>
    ${colorDot(70, 203, ROSE)}
    <text x="85" y="207" fill="${MUTED}" font-size="11">Degenerate (skewed): h = O(n) → linked list performance</text>
    ${colorDot(70, 228, BLUE)}
    <text x="85" y="232" fill="${MUTED}" font-size="11">Self-balancing: AVL (strict), Red-Black (relaxed) — used in TreeMap</text>
    <text x="60" y="262" fill="${WHITE}" font-size="11" font-weight="600">Common operations:</text>
    <text x="60" y="282" fill="${MUTED}" font-size="10">Search · Insert · Delete (3 cases) · Validate · LCA · Kth smallest</text>
    <text x="60" y="302" fill="${MUTED}" font-size="10">Inorder traversal gives sorted sequence — foundation of BST algorithms</text>
  `),

  'q_bfs_dfs': svgWrap(`
    ${badge(40, 25, 'COMPARISON', BLUE)}
    ${title(40, 65, 'BFS vs DFS')}
    <line x1="40" y1="82" x2="760" y2="82" stroke="${BLUE}" stroke-width="2" opacity="0.3"/>
    ${card(40, 100, 350, 210)}
    <rect x="40" y="100" width="350" height="5" rx="2" fill="${BLUE}"/>
    <text x="215" y="130" fill="${BLUE}" font-size="14" font-weight="700" text-anchor="middle">BFS (Breadth-First)</text>
    ${colorDot(70, 155, BLUE)}
    <text x="85" y="159" fill="${MUTED}" font-size="11">Uses Queue (FIFO)</text>
    ${colorDot(70, 178, BLUE)}
    <text x="85" y="182" fill="${MUTED}" font-size="11">Level-by-level exploration</text>
    ${colorDot(70, 201, BLUE)}
    <text x="85" y="205" fill="${MUTED}" font-size="11">Shortest path (unweighted)</text>
    ${colorDot(70, 224, BLUE)}
    <text x="85" y="228" fill="${MUTED}" font-size="11">Space: O(V) for frontier</text>
    <rect x="70" y="260" width="290" height="30" rx="8" fill="${BLUE}" opacity="0.12"/>
    <text x="215" y="280" fill="${BLUE}" font-size="10" font-weight="600" text-anchor="middle">Min distance · Level views</text>

    <circle cx="400" cy="205" r="18" fill="${ACCENT}" opacity="0.3"/>
    <text x="400" y="210" fill="${WHITE}" font-size="11" font-weight="800" text-anchor="middle">VS</text>

    ${card(420, 100, 350, 210)}
    <rect x="420" y="100" width="350" height="5" rx="2" fill="${GREEN}"/>
    <text x="595" y="130" fill="${GREEN}" font-size="14" font-weight="700" text-anchor="middle">DFS (Depth-First)</text>
    ${colorDot(450, 155, GREEN)}
    <text x="465" y="159" fill="${MUTED}" font-size="11">Uses Stack / Recursion</text>
    ${colorDot(450, 178, GREEN)}
    <text x="465" y="182" fill="${MUTED}" font-size="11">Deep as possible, backtrack</text>
    ${colorDot(450, 201, GREEN)}
    <text x="465" y="205" fill="${MUTED}" font-size="11">Cycle detection, topo sort</text>
    ${colorDot(450, 224, GREEN)}
    <text x="465" y="228" fill="${MUTED}" font-size="11">Space: O(h) recursion depth</text>
    <rect x="450" y="260" width="290" height="30" rx="8" fill="${GREEN}" opacity="0.12"/>
    <text x="595" y="280" fill="${GREEN}" font-size="10" font-weight="600" text-anchor="middle">Exhaustive search · Backtracking</text>
  `),

  'q_dp_concept': svgWrap(`
    ${badge(40, 25, 'PARADIGM', ACCENT)}
    ${title(40, 65, 'Dynamic Programming')}
    <line x1="40" y1="82" x2="760" y2="82" stroke="${ACCENT}" stroke-width="2" opacity="0.3"/>
    <text x="40" y="107" fill="${MUTED}" font-size="11">Overlapping Subproblems + Optimal Substructure</text>
    ${card(40, 120, 350, 115)}
    <rect x="40" y="120" width="350" height="5" rx="2" fill="${TEAL}"/>
    <text x="215" y="150" fill="${TEAL}" font-size="13" font-weight="700" text-anchor="middle">Top-Down (Memoization)</text>
    ${colorDot(70, 175, TEAL)}
    <text x="85" y="179" fill="${MUTED}" font-size="11">Recursive + cache results</text>
    ${colorDot(70, 198, TEAL)}
    <text x="85" y="202" fill="${MUTED}" font-size="11">Natural recursive structure</text>
    ${colorDot(70, 221, TEAL)}
    <text x="85" y="225" fill="${MUTED}" font-size="11">Risk: stack overflow for deep n</text>

    ${card(420, 120, 350, 115)}
    <rect x="420" y="120" width="350" height="5" rx="2" fill="${AMBER}"/>
    <text x="595" y="150" fill="${AMBER}" font-size="13" font-weight="700" text-anchor="middle">Bottom-Up (Tabulation)</text>
    ${colorDot(450, 175, AMBER)}
    <text x="465" y="179" fill="${MUTED}" font-size="11">Iterative + fill DP table</text>
    ${colorDot(450, 198, AMBER)}
    <text x="465" y="202" fill="${MUTED}" font-size="11">No recursion overhead</text>
    ${colorDot(450, 221, AMBER)}
    <text x="465" y="225" fill="${MUTED}" font-size="11">Often allows space optimization</text>

    ${card(40, 255, 730, 60)}
    <text x="60" y="278" fill="${WHITE}" font-size="11" font-weight="600">Common patterns:</text>
    <text x="60" y="298" fill="${MUTED}" font-size="10">1D (Fibonacci, stairs) · 2D (LCS, edit distance, knapsack) · Interval · DP on trees</text>
  `),

  'q_fibonacci': svgWrap(`
    ${badge(40, 25, 'EXAMPLE', TEAL)}
    ${title(40, 65, 'Fibonacci with DP')}
    <line x1="40" y1="82" x2="760" y2="82" stroke="${TEAL}" stroke-width="2" opacity="0.3"/>
    ${card(40, 100, 230, 80)}
    <rect x="40" y="100" width="230" height="4" rx="2" fill="${ROSE}"/>
    <text x="155" y="125" fill="${ROSE}" font-size="12" font-weight="700" text-anchor="middle">Naive Recursive</text>
    <text x="155" y="148" fill="${MUTED}" font-size="10" text-anchor="middle">O(2^n) time</text>
    <text x="155" y="165" fill="${ROSE}" font-size="9" text-anchor="middle">Recomputes same values!</text>
    ${card(290, 100, 230, 80)}
    <rect x="290" y="100" width="230" height="4" rx="2" fill="${TEAL}"/>
    <text x="405" y="125" fill="${TEAL}" font-size="12" font-weight="700" text-anchor="middle">Memoization</text>
    <text x="405" y="148" fill="${MUTED}" font-size="10" text-anchor="middle">O(n) time, O(n) space</text>
    <text x="405" y="165" fill="${TEAL}" font-size="9" text-anchor="middle">Cache computed results</text>
    ${card(540, 100, 230, 80)}
    <rect x="540" y="100" width="230" height="4" rx="2" fill="${GREEN}"/>
    <text x="655" y="125" fill="${GREEN}" font-size="12" font-weight="700" text-anchor="middle">Space-Optimized</text>
    <text x="655" y="148" fill="${MUTED}" font-size="10" text-anchor="middle">O(n) time, O(1) space</text>
    <text x="655" y="165" fill="${GREEN}" font-size="9" text-anchor="middle">Keep only prev2 &amp; prev1</text>
    ${card(40, 200, 730, 115)}
    <rect x="60" y="220" width="690" height="28" rx="6" fill="${SURFACE}"/>
    <text x="75" y="240" fill="${SKY}" font-size="11" font-family="monospace">dp[i] = dp[i-1] + dp[i-2]  // base: dp[0]=0, dp[1]=1</text>
    ${colorDot(70, 275, GREEN)}
    <text x="85" y="279" fill="${MUTED}" font-size="11">fib(n) only needs last 2 values → O(1) space optimization</text>
    ${colorDot(70, 298, AMBER)}
    <text x="85" y="302" fill="${MUTED}" font-size="11">This space pattern applies to many 1D DP problems</text>
  `),

  'q_knapsack': svgWrap(`
    ${badge(40, 25, 'CLASSIC', AMBER)}
    ${title(40, 65, '0/1 Knapsack Problem')}
    <line x1="40" y1="82" x2="760" y2="82" stroke="${AMBER}" stroke-width="2" opacity="0.3"/>
    ${card(40, 100, 730, 120)}
    <text x="60" y="125" fill="${WHITE}" font-size="12" font-weight="700">Maximize value in knapsack of capacity W</text>
    <rect x="60" y="140" width="690" height="28" rx="6" fill="${SURFACE}"/>
    <text x="75" y="160" fill="${SKY}" font-size="11" font-family="monospace">dp[i][w] = max(dp[i-1][w], dp[i-1][w-wt[i]] + val[i])</text>
    <text x="60" y="190" fill="${MUTED}" font-size="10">For each item: skip it (dp[i-1][w]) OR take it if it fits</text>
    <text x="60" y="210" fill="${MUTED}" font-size="10">Time: O(n×W) · Space: O(W) optimized (1D array, reverse order)</text>
    ${card(40, 240, 730, 75)}
    <text x="60" y="265" fill="${WHITE}" font-size="11" font-weight="600">Variations (disguised knapsack):</text>
    <text x="60" y="285" fill="${MUTED}" font-size="10">Subset sum · Equal partition · Coin change (unbounded) · Bounded knapsack</text>
    <text x="60" y="302" fill="${AMBER}" font-size="10" font-weight="600">Recognizing the knapsack structure in disguised problems = key interview skill</text>
  `),

  // ── SQL & Database ──────────────────────────
  'sql_database': svgWrap(`
    ${badge(40, 30, 'SECTION', BLUE)}
    ${title(40, 75, 'SQL & Database Design')}
    ${subtitle(40, 100, 'Joins · Aggregation · Indexing · Query Optimization')}
    <line x1="40" y1="115" x2="760" y2="115" stroke="${BLUE}" stroke-width="2" opacity="0.3"/>
    ${pillBox(40, 140, 170, 80, TEAL, 'JOINs', '🔗')}
    ${pillBox(230, 140, 170, 80, AMBER, 'GROUP BY', '📊')}
    ${pillBox(420, 140, 170, 80, BLUE, 'Indexes', '⚡')}
    ${pillBox(610, 140, 170, 80, GREEN, 'EXPLAIN', '🔍')}
    ${card(40, 245, 720, 70)}
    <text x="60" y="272" fill="${MUTED}" font-size="11">Relational database fundamentals for backend development:</text>
    <text x="60" y="292" fill="${MUTED}" font-size="11">writing efficient queries and designing scalable schemas.</text>
  `),

  'q_sql_joins': svgWrap(`
    ${badge(40, 25, 'CONCEPT', TEAL)}
    ${title(40, 65, 'SQL JOINs')}
    <line x1="40" y1="82" x2="760" y2="82" stroke="${TEAL}" stroke-width="2" opacity="0.3"/>
    ${card(40, 100, 350, 75)}
    <rect x="40" y="100" width="350" height="4" rx="2" fill="${GREEN}"/>
    <text x="215" y="128" fill="${GREEN}" font-size="13" font-weight="700" text-anchor="middle">INNER JOIN</text>
    <text x="215" y="150" fill="${MUTED}" font-size="10" text-anchor="middle">Only matching rows from both tables</text>
    <text x="215" y="168" fill="${GREEN}" font-size="9" font-weight="600" text-anchor="middle">Most common — default JOIN</text>
    ${card(420, 100, 350, 75)}
    <rect x="420" y="100" width="350" height="4" rx="2" fill="${BLUE}"/>
    <text x="595" y="128" fill="${BLUE}" font-size="13" font-weight="700" text-anchor="middle">LEFT JOIN</text>
    <text x="595" y="150" fill="${MUTED}" font-size="10" text-anchor="middle">All left rows + matching right (NULLs if no match)</text>
    <text x="595" y="168" fill="${BLUE}" font-size="9" font-weight="600" text-anchor="middle">Find missing relationships</text>
    ${card(40, 195, 350, 60)}
    <rect x="40" y="195" width="350" height="4" rx="2" fill="${AMBER}"/>
    <text x="215" y="223" fill="${AMBER}" font-size="13" font-weight="700" text-anchor="middle">RIGHT JOIN</text>
    <text x="215" y="243" fill="${MUTED}" font-size="10" text-anchor="middle">All right rows + matching left</text>
    ${card(420, 195, 350, 60)}
    <rect x="420" y="195" width="350" height="4" rx="2" fill="${ACCENT}"/>
    <text x="595" y="223" fill="${ACCENT}" font-size="13" font-weight="700" text-anchor="middle">FULL OUTER JOIN</text>
    <text x="595" y="243" fill="${MUTED}" font-size="10" text-anchor="middle">All rows from both, NULLs where no match</text>
    ${card(40, 275, 730, 40)}
    <text x="60" y="300" fill="${MUTED}" font-size="10">In practice, INNER + LEFT JOIN cover 95% of use cases</text>
  `),

  'q_where_having': svgWrap(`
    ${badge(40, 25, 'COMPARISON', AMBER)}
    ${title(40, 65, 'WHERE vs HAVING')}
    <line x1="40" y1="82" x2="760" y2="82" stroke="${AMBER}" stroke-width="2" opacity="0.3"/>
    ${card(40, 100, 350, 130)}
    <rect x="40" y="100" width="350" height="5" rx="2" fill="${BLUE}"/>
    <text x="215" y="130" fill="${BLUE}" font-size="14" font-weight="700" text-anchor="middle">WHERE</text>
    ${colorDot(70, 155, BLUE)}
    <text x="85" y="159" fill="${MUTED}" font-size="11">Filters BEFORE grouping</text>
    ${colorDot(70, 178, BLUE)}
    <text x="85" y="182" fill="${MUTED}" font-size="11">Cannot use aggregate functions</text>
    ${colorDot(70, 201, BLUE)}
    <text x="85" y="205" fill="${MUTED}" font-size="11">Operates on individual rows</text>

    <circle cx="400" cy="170" r="18" fill="${ACCENT}" opacity="0.3"/>
    <text x="400" y="175" fill="${WHITE}" font-size="11" font-weight="800" text-anchor="middle">VS</text>

    ${card(420, 100, 350, 130)}
    <rect x="420" y="100" width="350" height="5" rx="2" fill="${AMBER}"/>
    <text x="595" y="130" fill="${AMBER}" font-size="14" font-weight="700" text-anchor="middle">HAVING</text>
    ${colorDot(450, 155, AMBER)}
    <text x="465" y="159" fill="${MUTED}" font-size="11">Filters AFTER grouping</text>
    ${colorDot(450, 178, AMBER)}
    <text x="465" y="182" fill="${MUTED}" font-size="11">CAN use COUNT, SUM, AVG</text>
    ${colorDot(450, 201, AMBER)}
    <text x="465" y="205" fill="${MUTED}" font-size="11">Operates on groups</text>

    ${card(40, 250, 730, 65)}
    <text x="60" y="272" fill="${WHITE}" font-size="11" font-weight="600">SQL pipeline:</text>
    <text x="60" y="292" fill="${MUTED}" font-size="10">FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT</text>
    <text x="60" y="308" fill="${AMBER}" font-size="9" font-weight="600">WHERE salary &gt; 50000 → GROUP BY dept → HAVING COUNT(*) &gt; 10</text>
  `),

  'q_group_by': svgWrap(`
    ${badge(40, 25, 'CONCEPT', GREEN)}
    ${title(40, 65, 'GROUP BY & Aggregation')}
    <line x1="40" y1="82" x2="760" y2="82" stroke="${GREEN}" stroke-width="2" opacity="0.3"/>
    ${card(40, 100, 140, 70)}
    <rect x="40" y="100" width="140" height="4" rx="2" fill="${TEAL}"/>
    <text x="110" y="125" fill="${TEAL}" font-size="12" font-weight="700" text-anchor="middle">COUNT()</text>
    <text x="110" y="148" fill="${MUTED}" font-size="9" text-anchor="middle">Row counting</text>
    ${card(195, 100, 140, 70)}
    <rect x="195" y="100" width="140" height="4" rx="2" fill="${BLUE}"/>
    <text x="265" y="125" fill="${BLUE}" font-size="12" font-weight="700" text-anchor="middle">SUM()</text>
    <text x="265" y="148" fill="${MUTED}" font-size="9" text-anchor="middle">Total values</text>
    ${card(350, 100, 140, 70)}
    <rect x="350" y="100" width="140" height="4" rx="2" fill="${AMBER}"/>
    <text x="420" y="125" fill="${AMBER}" font-size="12" font-weight="700" text-anchor="middle">AVG()</text>
    <text x="420" y="148" fill="${MUTED}" font-size="9" text-anchor="middle">Average value</text>
    ${card(505, 100, 130, 70)}
    <rect x="505" y="100" width="130" height="4" rx="2" fill="${GREEN}"/>
    <text x="570" y="125" fill="${GREEN}" font-size="12" font-weight="700" text-anchor="middle">MIN()</text>
    <text x="570" y="148" fill="${MUTED}" font-size="9" text-anchor="middle">Smallest</text>
    ${card(650, 100, 120, 70)}
    <rect x="650" y="100" width="120" height="4" rx="2" fill="${ROSE}"/>
    <text x="710" y="125" fill="${ROSE}" font-size="12" font-weight="700" text-anchor="middle">MAX()</text>
    <text x="710" y="148" fill="${MUTED}" font-size="9" text-anchor="middle">Largest</text>
    ${card(40, 190, 730, 125)}
    <text x="60" y="215" fill="${WHITE}" font-size="12" font-weight="700">Golden Rule</text>
    <text x="60" y="238" fill="${MUTED}" font-size="11">Every column in SELECT must be in GROUP BY or inside an aggregate</text>
    <text x="60" y="265" fill="${WHITE}" font-size="11" font-weight="600">Advanced grouping:</text>
    ${colorDot(70, 288, TEAL)}
    <text x="85" y="292" fill="${MUTED}" font-size="10">ROLLUP (subtotals) · CUBE (all combos) · Window functions (PARTITION BY)</text>
    ${colorDot(70, 308, AMBER)}
    <text x="85" y="312" fill="${MUTED}" font-size="10">Window functions provide group-level aggregates WITHOUT collapsing rows</text>
  `),

  'q_db_index': svgWrap(`
    ${badge(40, 25, 'CONCEPT', BLUE)}
    ${title(40, 65, 'Database Indexes')}
    <line x1="40" y1="82" x2="760" y2="82" stroke="${BLUE}" stroke-width="2" opacity="0.3"/>
    ${card(40, 100, 350, 110)}
    <rect x="40" y="100" width="350" height="5" rx="2" fill="${GREEN}"/>
    <text x="215" y="130" fill="${GREEN}" font-size="13" font-weight="700" text-anchor="middle">B-Tree Index</text>
    ${colorDot(70, 155, GREEN)}
    <text x="85" y="159" fill="${MUTED}" font-size="11">O(log n) search/insert/delete</text>
    ${colorDot(70, 178, GREEN)}
    <text x="85" y="182" fill="${MUTED}" font-size="11">Supports range queries + ordering</text>
    ${colorDot(70, 201, GREEN)}
    <text x="85" y="205" fill="${MUTED}" font-size="11">Most common index type</text>
    ${card(420, 100, 350, 110)}
    <rect x="420" y="100" width="350" height="5" rx="2" fill="${AMBER}"/>
    <text x="595" y="130" fill="${AMBER}" font-size="13" font-weight="700" text-anchor="middle">Hash Index</text>
    ${colorDot(450, 155, AMBER)}
    <text x="465" y="159" fill="${MUTED}" font-size="11">O(1) exact-match lookups</text>
    ${colorDot(450, 178, AMBER)}
    <text x="465" y="182" fill="${MUTED}" font-size="11">Cannot do range or ordering</text>
    ${colorDot(450, 201, AMBER)}
    <text x="465" y="205" fill="${MUTED}" font-size="11">MEMORY engine specific</text>
    ${card(40, 230, 730, 85)}
    <text x="60" y="255" fill="${WHITE}" font-size="11" font-weight="600">Trade-off: Faster reads ↔ Slower writes</text>
    <text x="60" y="278" fill="${MUTED}" font-size="10">Every INSERT/UPDATE/DELETE must also update all relevant indexes</text>
    <text x="60" y="298" fill="${BLUE}" font-size="10" font-weight="600">Index WHERE, JOIN, ORDER BY columns — avoid over-indexing write-heavy tables</text>
  `),

  'q_index_types': svgWrap(`
    ${badge(40, 25, 'TYPES', ACCENT)}
    ${title(40, 65, 'Index Types')}
    <line x1="40" y1="82" x2="760" y2="82" stroke="${ACCENT}" stroke-width="2" opacity="0.3"/>
    ${card(40, 100, 350, 100)}
    <rect x="40" y="100" width="350" height="5" rx="2" fill="${TEAL}"/>
    <text x="215" y="130" fill="${TEAL}" font-size="13" font-weight="700" text-anchor="middle">Clustered Index</text>
    ${colorDot(70, 155, TEAL)}
    <text x="85" y="159" fill="${MUTED}" font-size="11">Determines physical row order</text>
    ${colorDot(70, 178, TEAL)}
    <text x="85" y="182" fill="${MUTED}" font-size="11">Max 1 per table (usually PK)</text>
    ${card(420, 100, 350, 100)}
    <rect x="420" y="100" width="350" height="5" rx="2" fill="${AMBER}"/>
    <text x="595" y="130" fill="${AMBER}" font-size="13" font-weight="700" text-anchor="middle">Non-Clustered</text>
    ${colorDot(450, 155, AMBER)}
    <text x="465" y="159" fill="${MUTED}" font-size="11">Separate structure + row pointer</text>
    ${colorDot(450, 178, AMBER)}
    <text x="465" y="182" fill="${MUTED}" font-size="11">Many per table, bookmark lookup</text>
    ${card(40, 220, 350, 70)}
    <rect x="40" y="220" width="350" height="4" rx="2" fill="${BLUE}"/>
    <text x="215" y="248" fill="${BLUE}" font-size="12" font-weight="700" text-anchor="middle">Composite Index</text>
    <text x="215" y="268" fill="${MUTED}" font-size="10" text-anchor="middle">Multi-column · Leftmost prefix rule</text>
    ${card(420, 220, 350, 70)}
    <rect x="420" y="220" width="350" height="4" rx="2" fill="${GREEN}"/>
    <text x="595" y="248" fill="${GREEN}" font-size="12" font-weight="700" text-anchor="middle">Covering Index</text>
    <text x="595" y="268" fill="${MUTED}" font-size="10" text-anchor="middle">All query columns in index → no table access</text>
  `),

  'q_query_opt': svgWrap(`
    ${badge(40, 25, 'OPTIMIZATION', GREEN)}
    ${title(40, 65, 'Query Optimization')}
    <line x1="40" y1="82" x2="760" y2="82" stroke="${GREEN}" stroke-width="2" opacity="0.3"/>
    ${card(40, 100, 730, 215)}
    <text x="60" y="125" fill="${WHITE}" font-size="12" font-weight="700">Step 1: EXPLAIN/EXPLAIN ANALYZE</text>
    <text x="60" y="148" fill="${MUTED}" font-size="10">Check: Index Scan vs Seq Scan · Join strategies · Row estimates</text>
    <text x="60" y="175" fill="${WHITE}" font-size="12" font-weight="700">Optimization techniques:</text>
    ${colorDot(70, 200, GREEN)}
    <text x="85" y="204" fill="${MUTED}" font-size="11">Add indexes on WHERE, JOIN, ORDER BY columns</text>
    ${colorDot(70, 225, BLUE)}
    <text x="85" y="229" fill="${MUTED}" font-size="11">Replace SELECT * with specific columns</text>
    ${colorDot(70, 250, AMBER)}
    <text x="85" y="254" fill="${MUTED}" font-size="11">Move filters from HAVING to WHERE when possible</text>
    ${colorDot(70, 275, ACCENT)}
    <text x="85" y="279" fill="${MUTED}" font-size="11">Replace correlated subqueries with JOINs</text>
    ${colorDot(70, 300, ROSE)}
    <text x="85" y="304" fill="${MUTED}" font-size="11">Schema: denormalization, partitioning, materialized views, caching</text>
  `),

  // ── Interview Prep ──────────────────────────
  'interview_prep': svgWrap(`
    ${badge(40, 30, 'SECTION', ACCENT)}
    ${title(40, 75, 'Mock Interview Preparation')}
    ${subtitle(40, 100, 'Behavioral · Technical · HR — Complete interview readiness')}
    <line x1="40" y1="115" x2="760" y2="115" stroke="${ACCENT}" stroke-width="2" opacity="0.3"/>
    ${pillBox(40, 140, 170, 80, GREEN, 'Behavioral', '🎯')}
    ${pillBox(230, 140, 170, 80, BLUE, 'Technical', '💻')}
    ${pillBox(420, 140, 170, 80, AMBER, 'HR Round', '🤝')}
    ${pillBox(610, 140, 170, 80, ACCENT, 'STAR Method', '⭐')}
    ${card(40, 245, 720, 70)}
    <text x="60" y="272" fill="${MUTED}" font-size="11">Structured preparation for every stage of the interview process:</text>
    <text x="60" y="292" fill="${MUTED}" font-size="11">from self-introduction to salary negotiation.</text>
  `),

  'q_tell_about': svgWrap(`
    ${badge(40, 25, 'BEHAVIORAL', GREEN)}
    ${title(40, 65, 'Tell Me About Yourself')}
    <line x1="40" y1="82" x2="760" y2="82" stroke="${GREEN}" stroke-width="2" opacity="0.3"/>
    ${card(40, 100, 230, 90)}
    <rect x="40" y="100" width="230" height="4" rx="2" fill="${BLUE}"/>
    <text x="155" y="125" fill="${BLUE}" font-size="12" font-weight="700" text-anchor="middle">1. Present</text>
    <text x="155" y="148" fill="${MUTED}" font-size="10" text-anchor="middle">Current role/education</text>
    <text x="155" y="165" fill="${MUTED}" font-size="10" text-anchor="middle">Main technical focus</text>
    ${card(290, 100, 230, 90)}
    <rect x="290" y="100" width="230" height="4" rx="2" fill="${AMBER}"/>
    <text x="405" y="125" fill="${AMBER}" font-size="12" font-weight="700" text-anchor="middle">2. Past</text>
    <text x="405" y="148" fill="${MUTED}" font-size="10" text-anchor="middle">Key projects/internships</text>
    <text x="405" y="165" fill="${MUTED}" font-size="10" text-anchor="middle">Relevant achievements</text>
    ${card(540, 100, 230, 90)}
    <rect x="540" y="100" width="230" height="4" rx="2" fill="${GREEN}"/>
    <text x="655" y="125" fill="${GREEN}" font-size="12" font-weight="700" text-anchor="middle">3. Future</text>
    <text x="655" y="148" fill="${MUTED}" font-size="10" text-anchor="middle">Career goals alignment</text>
    <text x="655" y="165" fill="${MUTED}" font-size="10" text-anchor="middle">Why this role/company</text>
    ${card(40, 210, 730, 105)}
    ${colorDot(70, 238, GREEN)}
    <text x="85" y="242" fill="${MUTED}" font-size="11">Keep it 60-90 seconds — every sentence should be intentional</text>
    ${colorDot(70, 263, AMBER)}
    <text x="85" y="267" fill="${MUTED}" font-size="11">Tailor to the company's tech stack and role requirements</text>
    ${colorDot(70, 288, ACCENT)}
    <text x="85" y="292" fill="${MUTED}" font-size="11">End with a bridge: "...that's why I'm excited about this role"</text>
  `),

  'q_star_method': svgWrap(`
    ${badge(40, 25, 'FRAMEWORK', AMBER)}
    ${title(40, 65, 'STAR Method')}
    <line x1="40" y1="82" x2="760" y2="82" stroke="${AMBER}" stroke-width="2" opacity="0.3"/>
    ${card(40, 100, 175, 110)}
    <rect x="40" y="100" width="175" height="5" rx="2" fill="${BLUE}"/>
    <text x="127" y="130" fill="${BLUE}" font-size="15" font-weight="800" text-anchor="middle">S</text>
    <text x="127" y="148" fill="${WHITE}" font-size="11" font-weight="700" text-anchor="middle">Situation</text>
    <text x="127" y="168" fill="${MUTED}" font-size="9" text-anchor="middle">Set the scene</text>
    <text x="127" y="183" fill="${MUTED}" font-size="9" text-anchor="middle">2-3 sentences</text>
    ${card(230, 100, 175, 110)}
    <rect x="230" y="100" width="175" height="5" rx="2" fill="${TEAL}"/>
    <text x="317" y="130" fill="${TEAL}" font-size="15" font-weight="800" text-anchor="middle">T</text>
    <text x="317" y="148" fill="${WHITE}" font-size="11" font-weight="700" text-anchor="middle">Task</text>
    <text x="317" y="168" fill="${MUTED}" font-size="9" text-anchor="middle">YOUR responsibility</text>
    <text x="317" y="183" fill="${MUTED}" font-size="9" text-anchor="middle">What was expected</text>
    ${card(420, 100, 175, 110)}
    <rect x="420" y="100" width="175" height="5" rx="2" fill="${AMBER}"/>
    <text x="507" y="130" fill="${AMBER}" font-size="15" font-weight="800" text-anchor="middle">A</text>
    <text x="507" y="148" fill="${WHITE}" font-size="11" font-weight="700" text-anchor="middle">Action</text>
    <text x="507" y="168" fill="${MUTED}" font-size="9" text-anchor="middle">Steps YOU took</text>
    <text x="507" y="183" fill="${MUTED}" font-size="9" text-anchor="middle">Use "I" not "we"</text>
    ${card(610, 100, 160, 110)}
    <rect x="610" y="100" width="160" height="5" rx="2" fill="${GREEN}"/>
    <text x="690" y="130" fill="${GREEN}" font-size="15" font-weight="800" text-anchor="middle">R</text>
    <text x="690" y="148" fill="${WHITE}" font-size="11" font-weight="700" text-anchor="middle">Result</text>
    <text x="690" y="168" fill="${MUTED}" font-size="9" text-anchor="middle">Quantified outcome</text>
    <text x="690" y="183" fill="${MUTED}" font-size="9" text-anchor="middle">Numbers = credibility</text>
    ${card(40, 230, 730, 85)}
    <text x="60" y="258" fill="${WHITE}" font-size="11" font-weight="600">Example Result:</text>
    <text x="60" y="278" fill="${MUTED}" font-size="10">"Response time dropped from 2.3s to 180ms. Handled 500 concurrent users.</text>
    <text x="60" y="298" fill="${MUTED}" font-size="10">Project received highest grade in the batch."</text>
  `),

  'q_why_here': svgWrap(`
    ${badge(40, 25, 'BEHAVIORAL', ACCENT)}
    ${title(40, 65, 'Why Do You Want to Work Here?')}
    <line x1="40" y1="82" x2="760" y2="82" stroke="${ACCENT}" stroke-width="2" opacity="0.3"/>
    ${card(40, 100, 230, 100)}
    <rect x="40" y="100" width="230" height="4" rx="2" fill="${TEAL}"/>
    <text x="155" y="128" fill="${TEAL}" font-size="12" font-weight="700" text-anchor="middle">1. Company</text>
    <text x="155" y="150" fill="${MUTED}" font-size="10" text-anchor="middle">Specific product/tech/culture</text>
    <text x="155" y="168" fill="${MUTED}" font-size="10" text-anchor="middle">Recent achievements</text>
    <text x="155" y="186" fill="${TEAL}" font-size="9" font-weight="600" text-anchor="middle">Show you researched them</text>
    ${card(290, 100, 230, 100)}
    <rect x="290" y="100" width="230" height="4" rx="2" fill="${AMBER}"/>
    <text x="405" y="128" fill="${AMBER}" font-size="12" font-weight="700" text-anchor="middle">2. Skills Fit</text>
    <text x="405" y="150" fill="${MUTED}" font-size="10" text-anchor="middle">Your expertise aligns</text>
    <text x="405" y="168" fill="${MUTED}" font-size="10" text-anchor="middle">with their tech stack</text>
    <text x="405" y="186" fill="${AMBER}" font-size="9" font-weight="600" text-anchor="middle">Connect your experience</text>
    ${card(540, 100, 230, 100)}
    <rect x="540" y="100" width="230" height="4" rx="2" fill="${GREEN}"/>
    <text x="655" y="128" fill="${GREEN}" font-size="12" font-weight="700" text-anchor="middle">3. Growth</text>
    <text x="655" y="150" fill="${MUTED}" font-size="10" text-anchor="middle">Long-term thinking</text>
    <text x="655" y="168" fill="${MUTED}" font-size="10" text-anchor="middle">Career trajectory here</text>
    <text x="655" y="186" fill="${GREEN}" font-size="9" font-weight="600" text-anchor="middle">Show commitment</text>
    ${card(40, 220, 730, 55)}
    <text x="60" y="245" fill="${ROSE}" font-size="11" font-weight="600">Avoid: salary, brand name, location convenience</text>
    <text x="60" y="265" fill="${MUTED}" font-size="10">Reference specifics: "I read about your monolith-to-microservices migration..."</text>
  `),

  'q_project': svgWrap(`
    ${badge(40, 25, 'TECHNICAL', BLUE)}
    ${title(40, 65, 'Explain Your Project')}
    <line x1="40" y1="82" x2="760" y2="82" stroke="${BLUE}" stroke-width="2" opacity="0.3"/>
    ${card(40, 100, 730, 215)}
    ${colorDot(70, 130, TEAL)}
    <text x="85" y="134" fill="${WHITE}" font-size="12" font-weight="600">1. Big Picture — What problem does it solve?</text>
    ${colorDot(70, 158, BLUE)}
    <text x="85" y="162" fill="${WHITE}" font-size="12" font-weight="600">2. Your Role — What components did YOU build?</text>
    ${colorDot(70, 186, AMBER)}
    <text x="85" y="190" fill="${WHITE}" font-size="12" font-weight="600">3. Technologies — Be specific, not generic</text>
    <text x="105" y="210" fill="${MUTED}" font-size="10">"Built REST APIs using Spring Boot with JPA + Redis caching"</text>
    ${colorDot(70, 232, ACCENT)}
    <text x="85" y="236" fill="${WHITE}" font-size="12" font-weight="600">4. Challenges & Trade-offs — Design decisions</text>
    <text x="105" y="256" fill="${MUTED}" font-size="10">"Chose WebSockets over SSE — reduced latency from 3s to 50ms"</text>
    ${colorDot(70, 278, GREEN)}
    <text x="85" y="282" fill="${WHITE}" font-size="12" font-weight="600">5. Measurable Results — Numbers make it credible</text>
    <text x="105" y="302" fill="${MUTED}" font-size="10">"Handled 500 concurrent users, 99.5% uptime during placement season"</text>
  `),

  'q_debugging': svgWrap(`
    ${badge(40, 25, 'TECHNICAL', ROSE)}
    ${title(40, 65, 'Debugging Production Issues')}
    <line x1="40" y1="82" x2="760" y2="82" stroke="${ROSE}" stroke-width="2" opacity="0.3"/>
    ${card(40, 100, 730, 215)}
    ${colorDot(70, 130, ROSE)}
    <text x="85" y="134" fill="${WHITE}" font-size="12" font-weight="600">1. Acknowledge & Assess severity</text>
    <text x="105" y="152" fill="${MUTED}" font-size="10">How many users affected? Is data at risk? Escalate if needed</text>
    ${colorDot(70, 175, AMBER)}
    <text x="85" y="179" fill="${WHITE}" font-size="12" font-weight="600">2. Gather Information — "What changed?"</text>
    <text x="105" y="197" fill="${MUTED}" font-size="10">Check logs, dashboards, recent deployments, config changes</text>
    ${colorDot(70, 220, BLUE)}
    <text x="85" y="224" fill="${WHITE}" font-size="12" font-weight="600">3. Isolate Root Cause</text>
    <text x="105" y="242" fill="${MUTED}" font-size="10">Hypothesize → test → structured logging, distributed tracing</text>
    ${colorDot(70, 265, GREEN)}
    <text x="85" y="269" fill="${WHITE}" font-size="12" font-weight="600">4. Mitigate (rollback/scale) + Fix + Post-mortem</text>
    <text x="105" y="287" fill="${MUTED}" font-size="10">Blameless post-mortems + monitoring improvements = senior engineering</text>
  `),

  'q_salary': svgWrap(`
    ${badge(40, 25, 'HR', AMBER)}
    ${title(40, 65, 'Salary Negotiation')}
    <line x1="40" y1="82" x2="760" y2="82" stroke="${AMBER}" stroke-width="2" opacity="0.3"/>
    ${card(40, 100, 730, 215)}
    ${colorDot(70, 130, GREEN)}
    <text x="85" y="134" fill="${WHITE}" font-size="12" font-weight="600">Research market rates first</text>
    <text x="105" y="152" fill="${MUTED}" font-size="10">Glassdoor, Levels.fyi, AmbitionBox, LinkedIn Salary Insights</text>
    ${colorDot(70, 175, BLUE)}
    <text x="85" y="179" fill="${WHITE}" font-size="12" font-weight="600">Provide a researched range (not a single number)</text>
    <text x="105" y="197" fill="${MUTED}" font-size="10">"Based on my research, I'm looking at X-Y LPA, open to discussion"</text>
    ${colorDot(70, 220, AMBER)}
    <text x="85" y="224" fill="${WHITE}" font-size="12" font-weight="600">Let employer share their budget first if possible</text>
    <text x="105" y="242" fill="${MUTED}" font-size="10">"I'd prefer to understand the full role first. What's your range?"</text>
    ${colorDot(70, 265, ACCENT)}
    <text x="85" y="269" fill="${WHITE}" font-size="12" font-weight="600">Consider total compensation</text>
    <text x="105" y="287" fill="${MUTED}" font-size="10">Bonuses, RSUs, health insurance, learning budgets, growth trajectory</text>
  `),

  'q_career': svgWrap(`
    ${badge(40, 25, 'HR', GREEN)}
    ${title(40, 65, '5-Year Career Vision')}
    <line x1="40" y1="82" x2="760" y2="82" stroke="${GREEN}" stroke-width="2" opacity="0.3"/>
    ${card(40, 100, 230, 120)}
    <rect x="40" y="100" width="230" height="4" rx="2" fill="${TEAL}"/>
    <text x="155" y="128" fill="${TEAL}" font-size="12" font-weight="700" text-anchor="middle">Technical Depth</text>
    <text x="155" y="150" fill="${MUTED}" font-size="10" text-anchor="middle">Expert in distributed</text>
    <text x="155" y="168" fill="${MUTED}" font-size="10" text-anchor="middle">systems architecture</text>
    <text x="155" y="186" fill="${MUTED}" font-size="10" text-anchor="middle">Cloud + microservices</text>
    ${card(290, 100, 230, 120)}
    <rect x="290" y="100" width="230" height="4" rx="2" fill="${AMBER}"/>
    <text x="405" y="128" fill="${AMBER}" font-size="12" font-weight="700" text-anchor="middle">Impact</text>
    <text x="405" y="150" fill="${MUTED}" font-size="10" text-anchor="middle">Leading design of</text>
    <text x="405" y="168" fill="${MUTED}" font-size="10" text-anchor="middle">critical platform</text>
    <text x="405" y="186" fill="${MUTED}" font-size="10" text-anchor="middle">components</text>
    ${card(540, 100, 230, 120)}
    <rect x="540" y="100" width="230" height="4" rx="2" fill="${GREEN}"/>
    <text x="655" y="128" fill="${GREEN}" font-size="12" font-weight="700" text-anchor="middle">Leadership</text>
    <text x="655" y="150" fill="${MUTED}" font-size="10" text-anchor="middle">Mentoring juniors</text>
    <text x="655" y="168" fill="${MUTED}" font-size="10" text-anchor="middle">Tech talks, open source</text>
    <text x="655" y="186" fill="${MUTED}" font-size="10" text-anchor="middle">Cross-team collab</text>
    ${card(40, 240, 730, 75)}
    ${colorDot(70, 265, ACCENT)}
    <text x="85" y="269" fill="${MUTED}" font-size="11">Connect your growth to the company's direction</text>
    ${colorDot(70, 290, ROSE)}
    <text x="85" y="294" fill="${MUTED}" font-size="11">Avoid: vague ("good position"), too specific ("VP"), startup dreams</text>
  `),
};

// ═══════════════ WRITE FILES ═══════════════
let count = 0;
for (const [name, svg] of Object.entries(images)) {
  const filePath = path.join(OUT_DIR, `${name}.svg`);
  fs.writeFileSync(filePath, svg, 'utf-8');
  count++;
}

console.log(`✅ Generated ${count} SVG images in ${OUT_DIR}`);
