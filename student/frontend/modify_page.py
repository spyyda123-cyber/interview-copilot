import re

with open('d:/17.3interview copilot/interview copilot/interview-copilot/student/frontend/app/study-plan/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add Google Fonts and CSS styles
fonts_and_styles = """
const themeStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Quicksand:wght@400;500;600;700&family=JetBrains+Mono:wght@400;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');

  .theme-friendly {
    background-color: #fce7f3;
  }
  .theme-friendly * {
    font-family: 'Quicksand', sans-serif;
  }
  .theme-friendly h1, .theme-friendly h2, .theme-friendly h3, .theme-friendly .font-bold {
    font-family: 'Fredoka', sans-serif !important;
  }
  .theme-friendly .bg-white { background-color: #ffffff !important; }
  .theme-friendly .rounded-xl { border-radius: 1.5rem !important; }
  .theme-friendly .text-slate-800 { color: #5c4b51 !important; }
  .theme-friendly .text-slate-500 { color: #8c737c !important; }
  .theme-friendly .text-slate-400 { color: #b39da4 !important; }
  .theme-friendly .border-slate-200 { border-color: #fbcfe8 !important; }
  .theme-friendly .bg-slate-100 { background-color: #fbcfe8 !important; }

  .theme-professional {
    background-color: #0f172a;
    color: #e2e8f0;
  }
  .theme-professional * {
    font-family: 'JetBrains Mono', monospace;
  }
  .theme-professional h1, .theme-professional h2, .theme-professional h3, .theme-professional .font-bold {
    font-family: 'Space Grotesk', sans-serif !important;
  }
  .theme-professional .bg-white { background-color: #1e293b !important; }
  .theme-professional .rounded-xl { border-radius: 0.25rem !important; }
  .theme-professional .text-slate-800 { color: #f8fafc !important; }
  .theme-professional .text-slate-700 { color: #e2e8f0 !important; }
  .theme-professional .text-slate-600 { color: #cbd5e1 !important; }
  .theme-professional .text-slate-500 { color: #94a3b8 !important; }
  .theme-professional .text-slate-400 { color: #64748b !important; }
  .theme-professional .border-slate-200 { border-color: #334155 !important; }
  .theme-professional .bg-slate-100 { background-color: #1e293b !important; border: 1px solid #334155; }
  .theme-professional .border-indigo-400 { border-color: #3b82f6 !important; }
  .theme-professional .text-indigo-700 { color: #60a5fa !important; }
  .theme-professional .bg-indigo-50 { background-color: #1e3a8a !important; color: #bfdbfe !important; }
  .theme-professional .bg-slate-50 { background-color: #0f172a !important; }
  .theme-professional .text-indigo-600 { color: #60a5fa !important; }
`;
"""

if "const themeStyles =" not in content:
    content = content.replace('import { useEffect, useRef, useState } from "react";', 'import { useEffect, useRef, useState } from "react";\n' + fonts_and_styles)

# 2. Add SlideComponent definition
slide_cmp = """
function SlideComponent({ question, theme, onClose }: { question: string, theme: string, onClose: () => void }) {
  const [slideIdx, setSlideIdx] = useState(0);
  
  let slides = [];
  const qStr = question.toLowerCase();
  if (qStr.includes("four pillars")) {
    slides = [
      { title: "Encapsulation", desc: "Bundling data & methods. Restricts direct access.", icon: "📦", color: "#3b82f6" },
      { title: "Abstraction", desc: "Hiding complexity, showing only essential features.", icon: "🌫️", color: "#8b5cf6" },
      { title: "Inheritance", desc: "Acquiring properties & behaviors from a parent.", icon: "🧬", color: "#10b981" },
      { title: "Polymorphism", desc: "Many forms. Overloading and overriding.", icon: "🎭", color: "#f59e0b" }
    ];
  } else if (qStr.includes("abstract class and an interface")) {
     slides = [
       { title: "Abstract Class", desc: "State (fields), constructors, mix of abstract & concrete methods. Single inheritance.", icon: "📄", color: "#6366f1" },
       { title: "Interface", desc: "Pure contract (traditionally). Multiple inheritance allowed. Default methods in Java 8+.", icon: "🔌", color: "#14b8a6" }
     ];
  } else if (qStr.includes("overloading vs method overriding")) {
      slides = [
        { title: "Overloading", desc: "Compile-time (Static). Same method name, different parameters.", icon: "🔄", color: "#ec4899" },
        { title: "Overriding", desc: "Runtime (Dynamic). Subclass replaces superclass method signature.", icon: "⚡", color: "#3b82f6" },
      ];
  } else if (qStr.includes("'final' keyword")) {
     slides = [
        { title: "Final Variable", desc: "Value cannot be changed once assigned (Constant).", icon: "🔒", color: "#ef4444" },
        { title: "Final Method", desc: "Cannot be overridden by subclasses.", icon: "🛑", color: "#f97316" },
        { title: "Final Class", desc: "Cannot be extended/inherited.", icon: "🧱", color: "#64748b" },
     ];
  } else if (qStr.includes("'==' and '.equals()'")) {
     slides = [
       { title: "== Operator", desc: "Compares memory references. Do both point to the same object?", icon: "🔗", color: "#8b5cf6" },
       { title: ".equals() Method", desc: "Compares logical values. Are the contents structurally equal?", icon: "⚖️", color: "#10b981" },
     ];
  } else {
     slides = [
        { title: "Concept Visual", desc: "Graphical representation coming soon.", icon: "💡", color: "#94a3b8" }
     ];
  }

  const current = slides[slideIdx];
  const isFriendly = theme === 'friendly';

  return (
    <div className={`p-6 mt-3 rounded-xl border relative overflow-hidden transition-all ${isFriendly ? 'bg-[#fffafb] border-pink-200' : 'bg-[#1e293b] border-slate-700'}`}>
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors">
            ✖
        </button>
        <div className="flex flex-col items-center justify-center min-h-[200px] text-center">
             <div className="text-6xl mb-4" style={{ filter: isFriendly ? 'drop-shadow(0 4px 6px rgba(255,192,203,0.5))' : 'drop-shadow(0 4px 6px rgba(59,130,246,0.3))' }}>
                {current.icon}
             </div>
             <h3 className={`text-2xl font-bold mb-2 ${isFriendly ? 'text-[#d6336c]' : 'text-blue-400'}`}>
                {current.title}
             </h3>
             <p className={`max-w-md ${isFriendly ? 'text-[#a38f95]' : 'text-slate-300'}`}>
                {current.desc}
             </p>
        </div>
        
        {/* Navigation */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200/20">
            <button 
                onClick={() => setSlideIdx(Math.max(0, slideIdx - 1))}
                disabled={slideIdx === 0}
                className={`px-4 py-2 rounded-lg font-bold text-sm ${slideIdx === 0 ? 'opacity-50 cursor-not-allowed' : (isFriendly ? 'bg-pink-100 text-pink-700 hover:bg-pink-200' : 'bg-slate-700 text-slate-200 hover:bg-slate-600')}`}>
                ← Prev
            </button>
            <div className="flex gap-2">
                {slides.map((_, i) => (
                    <div key={i} onClick={() => setSlideIdx(i)} className={`w-2.5 h-2.5 rounded-full cursor-pointer transition-all ${i === slideIdx ? (isFriendly ? 'bg-[#d6336c] scale-125' : 'bg-blue-500 scale-125') : (isFriendly ? 'bg-pink-200' : 'bg-slate-600')}`} />
                ))}
            </div>
            <button 
                onClick={() => setSlideIdx(Math.min(slides.length - 1, slideIdx + 1))}
                disabled={slideIdx === slides.length - 1}
                className={`px-4 py-2 rounded-lg font-bold text-sm ${slideIdx === slides.length - 1 ? 'opacity-50 cursor-not-allowed' : (isFriendly ? 'bg-pink-100 text-pink-700 hover:bg-pink-200' : 'bg-slate-700 text-slate-200 hover:bg-slate-600')}`}>
                Next →
            </button>
        </div>
    </div>
  );
}
"""

if "function SlideComponent" not in content:
    content = content.replace('export default function StudyPlanPage() {', slide_cmp + '\nexport default function StudyPlanPage() {')

# 3. Add state variables
state_vars = """
  const [theme, setTheme] = useState<'friendly' | 'professional'>('professional');
  const [slideViewModeIdx, setSlideViewModeIdx] = useState<number | null>(null);
  const [expandedModules, setExpandedModules] = useState<Record<number, boolean>>({ 0: true });
"""
if "const [theme, setTheme]" not in content:
    content = re.sub(r'const \[expandedModules,\s*setExpandedModules\]\s*=\s*useState<Record<number, boolean>>\(\{ 0: true \}\);', state_vars.strip(), content)

# 4. Integrate Theme classes into outer wrap
if 'className={`min-h-screen' not in content:
    content = content.replace('<div className="animate-fade-in w-full max-w-[1200px] mx-auto py-4">', 
    """<div className={`min-h-screen transition-colors duration-500 ${theme === 'friendly' ? 'theme-friendly' : 'theme-professional'}`}>
      <style>{themeStyles}</style>
      <div className="animate-fade-in w-full max-w-[1200px] mx-auto py-6 px-4">""")
    content = re.sub(r'    </div>\n  \);\n}', '    </div>\n    </div>\n  );\n}', content)

# 5. Add Theme Buttons to sidebar
sidebar_start = '<div className="w-72 shrink-0">'
theme_buttons = """<div className="w-72 shrink-0 flex flex-col gap-5">
          {/* Theme switcher */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
             <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-3">Theme Preference</p>
             <div className="flex flex-col gap-2">
               <button onClick={() => setTheme('friendly')} 
                 className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold transition-all ${theme === 'friendly' ? 'bg-[#ffd6e0] text-[#d6336c] border border-pink-200' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
                 <span className="text-lg">🌸</span> Friendly View
               </button>
               <button onClick={() => setTheme('professional')} 
                 className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold transition-all ${theme === 'professional' ? 'bg-indigo-500 text-white border border-indigo-600' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
                 <span className="text-lg">⚡</span> Professional View
               </button>
             </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">"""
if "Theme Preference" not in content and sidebar_start in content:
    content = content.replace(sidebar_start, theme_buttons)
    content = content.replace('{/* RIGHT: Content area */}', '</div>\n        {/* RIGHT: Content area */}')

# 6. Add "Slide View" button next to "Hide/Reveal"
if "📊 Slide View" not in content:
    reveal_button_regex = r'(<button onClick=\{\(\) => toggleAnswer\(idx\)\}.*?\{isRevealed \? "Hide" : "Reveal"\}\n\s*<\/button>)'
    
    def repl_btn(match):
        return match.group(1) + """\n                            {isRevealed && (
                              <button onClick={() => setSlideViewModeIdx(slideViewModeIdx === idx ? null : idx)}
                                className={`shrink-0 px-3 py-1 rounded-lg text-[11px] font-bold transition-all border ${slideViewModeIdx === idx ? "bg-purple-100 text-purple-700 border-purple-300" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
                                📊 Slide View
                              </button>
                            )}"""
    
    content = re.sub(reveal_button_regex, repl_btn, content, flags=re.DOTALL)

# 7. Render SlideComponent under Q&A blocks
# Replace:
# {isRevealed && (
#   <div className="px-4 pb-3 ml-9">
# ...
#   </div>
# )}
if "<SlideComponent" not in content:
    old_block_regex = r'(\{isRevealed && \(\n\s*<div className="px-4 pb-3 ml-9">.*?<\/div>\n\s*\)\})'
    
    def repl_isrevealed(match):
        inner = match.group(0)
        inner = re.sub(r'^\{isRevealed && \(\n\s*<div className="px-4 pb-3 ml-9">', '', inner)
        inner = re.sub(r'<\/div>\n\s*\)\}$', '', inner)
        
        replacement = """{isRevealed && slideViewModeIdx === idx ? (
                            <div className="px-4 pb-3 ml-9">
                               <SlideComponent question={item.q} theme={theme} onClose={() => setSlideViewModeIdx(null)} />
                            </div>
                          ) : isRevealed ? (
                            <div className="px-4 pb-3 ml-9">
                                """ + inner + """
                            </div>
                          ) : null}"""
        return replacement

    content = re.sub(r'\{isRevealed && \(\s*<div className="px-4 pb-3 ml-9">.*?(?=<\/div>\n\s*\)\})\s*<\/div>\n\s*\)\}', repl_isrevealed, content, flags=re.DOTALL)

with open('d:/17.3interview copilot/interview copilot/interview-copilot/student/frontend/app/study-plan/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
