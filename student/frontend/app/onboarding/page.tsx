"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, type FormEvent } from "react";
import LoadingSpinner from "../components/LoadingSpinner";
import { createStudent, uploadMarksheet, uploadResume } from "@/src/lib/api";

const SUPPORT_OPTIONS = [
  { value: "guided", label: "Guided coaching" },
  { value: "self", label: "Self-driven" },
  { value: "adaptive", label: "Adaptive" },
];

const TONE_OPTIONS = [
  { value: "supportive", label: "Supportive" },
  { value: "direct", label: "Direct" },
  { value: "neutral", label: "Neutral" },
];

const PROFICIENCY_OPTIONS = ["Beginner", "Intermediate", "Advanced"];
const COMMON_SKILLS = ["Java", "Python", "SQL", "REST APIs", "React", "Node.js", "C++", "AWS"];

interface MarksheetFile {
  id: string;
  name: string;
  size: number;
  status: "pending" | "uploading" | "uploaded" | "error";
  fileObj?: File;
  path?: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("");
  const [email, setEmail] = useState("");
  
  const [studentId, setStudentId] = useState<number | null>(null);

  const [skills, setSkills] = useState<{skill: string, proficiency: string}[]>([]);
  const [currentSkill, setCurrentSkill] = useState("");
  const [currentProficiency, setCurrentProficiency] = useState(PROFICIENCY_OPTIONS[0]);

  const [supportMode, setSupportMode] = useState(SUPPORT_OPTIONS[0].value);
  const [tone, setTone] = useState(TONE_OPTIONS[0].value);

  const [marksheets, setMarksheets] = useState<MarksheetFile[]>([]);
  const [resumeFileObj, setResumeFileObj] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const marksheetInputRef = useRef<HTMLInputElement>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const storedStudentId = sessionStorage.getItem("student_id");
    const storedEmail = sessionStorage.getItem("student_email") || sessionStorage.getItem("email") || "";
    
    if (storedStudentId) setStudentId(Number(storedStudentId));
    if (storedEmail) setEmail(storedEmail);

    const storedSkills = sessionStorage.getItem("known_skills_detailed");
    if (storedSkills) {
      try {
        setSkills(JSON.parse(storedSkills));
      } catch (e) {}
    }
  }, []);

  const handleAddSkill = () => {
    if (currentSkill.trim() && !skills.some(s => s.skill.toLowerCase() === currentSkill.trim().toLowerCase())) {
      setSkills([...skills, { skill: currentSkill.trim(), proficiency: currentProficiency }]);
      setCurrentSkill("");
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter(s => s.skill !== skillToRemove));
  };

  const handleMarksheetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const newFiles = Array.from(e.target.files).map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: file.size,
      status: "pending" as const,
      fileObj: file
    }));
    
    setMarksheets(prev => [...prev, ...newFiles]);
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setResumeFileObj(file);
    // Mark as selected (will be uploaded in handleSubmit)
  };

  const handleRemoveMarksheet = (id: string) => {
    setMarksheets(prev => prev.filter(m => m.id !== id));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    setLoading(true);
    try {
      // Step 1: Create student record
      const response = await createStudent({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
        department: department.trim(),
        email: email.trim() || 'student@example.com',
        primary_skill: skills.length > 0 ? skills[0].skill : "General",
        known_skills: skills,
        support_mode: supportMode,
        tone: tone,
        coding_required: true,
        marksheets: [],  // Don't send marksheets here - upload them separately below
      });

      const newStudentId = response.student_id;
      setStudentId(newStudentId);
      sessionStorage.setItem("student_id", String(newStudentId));

      // Step 2: Upload pending marksheets using the new student_id
      const pendingMarksheets = marksheets.filter(m => m.status === 'pending' && m.fileObj);
      if (pendingMarksheets.length > 0) {
        for (const marksheet of pendingMarksheets) {
          try {
            console.log(`Uploading marksheet: ${marksheet.name} for student ${newStudentId}`);
            setMarksheets(prev => prev.map(m => m.id === marksheet.id ? { ...m, status: 'uploading' } : m));
            const res = await uploadMarksheet(marksheet.fileObj!, { studentId: newStudentId });
            console.log(`Marksheet uploaded successfully:`, res);
            setMarksheets(prev => prev.map(m => m.id === marksheet.id ? { ...m, status: 'uploaded', path: res.file_path } : m));
          } catch (uploadErr) {
            console.error(`Failed to upload marksheet ${marksheet.name}:`, uploadErr);
            setError(`Marksheet upload failed: ${uploadErr instanceof Error ? uploadErr.message : 'Unknown error'}`);
            setMarksheets(prev => prev.map(m => m.id === marksheet.id ? { ...m, status: 'error' } : m));
          }
        }
      }

      // Step 3: Upload resume if one was selected
      if (resumeFileObj) {
        try {
          await uploadResume(resumeFileObj, { studentId: newStudentId });
          sessionStorage.setItem("resume_id", "uploaded");
        } catch (uploadErr) {
          console.error("Failed to upload resume:", uploadErr);
          setError("Resume upload failed, but student was created successfully.");
        }
      }

      sessionStorage.setItem("student_name", `${firstName} ${lastName}`);
      sessionStorage.setItem("known_skills_detailed", JSON.stringify(skills));

      // After onboarding, standard flow goes to /target
      router.push("/target");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Onboarding failed. Try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(0) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };

  return (
    <div className="animate-fade-in w-full max-w-4xl mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-slate-800" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>Personal information</h1>
        <div className="flex items-center gap-2 text-emerald-500 text-sm font-medium">
          <div className="w-2 h-2 rounded-full bg-emerald-500"></div> Connected
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Profile Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-1" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>Student profile</h2>
          <p className="text-sm text-slate-500 mb-6">Your CGPA and backlogs are managed by your college admin.</p>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">First name</label>
              <input value={firstName} onChange={e => setFirstName(e.target.value)} required className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800" placeholder="enter first name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Last name</label>
              <input value={lastName} onChange={e => setLastName(e.target.value)} required className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800" placeholder="enter last name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} required className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800" placeholder="enter phone number" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
              <input value={department} onChange={e => setDepartment(e.target.value)} required className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800" placeholder="CSE" />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">Add skills with proficiency</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input 
                  value={currentSkill} 
                  onChange={e => setCurrentSkill(e.target.value)} 
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800" 
                  placeholder="Select skill..." 
                  list="skills-list"
                />
                <datalist id="skills-list">
                  {COMMON_SKILLS.map(s => <option key={s} value={s} />)}
                </datalist>
                <div className="absolute right-3 top-3 text-slate-400 cursor-pointer pointer-events-none">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>
              </div>
              <div className="relative w-48">
                <select 
                  value={currentProficiency} 
                  onChange={e => setCurrentProficiency(e.target.value)} 
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800 appearance-none bg-white"
                >
                  {PROFICIENCY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <div className="absolute right-3 top-3 text-slate-400 pointer-events-none">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>
              </div>
              <button 
                type="button" 
                onClick={handleAddSkill}
                className="flex items-center justify-center w-12 h-11 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 transition"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </button>
            </div>
          </div>

          {skills.length > 0 && (
            <div className="space-y-2 mb-6">
              {skills.map(s => (
                <div key={s.skill} className="flex items-center justify-between border border-slate-200 rounded-lg px-4 py-3 bg-white">
                  <span className="font-semibold text-slate-800 text-sm">{s.skill}</span>
                  <div className="flex items-center gap-3">
                    <span className={`text-[11px] font-bold px-2 py-1 rounded-md ${
                      s.proficiency === 'Advanced' ? 'bg-emerald-50 text-emerald-600' :
                      s.proficiency === 'Intermediate' ? 'bg-blue-50 text-blue-600' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {s.proficiency}
                    </span>
                    <button type="button" onClick={() => handleRemoveSkill(s.skill)} className="text-slate-400 hover:text-red-500">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Learning style</label>
              <div className="relative">
                <select value={supportMode} onChange={e => setSupportMode(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800 appearance-none bg-white">
                  {SUPPORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <div className="absolute right-3 top-3 text-slate-400 pointer-events-none">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tone</label>
              <div className="relative">
                <select value={tone} onChange={e => setTone(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800 appearance-none bg-white">
                  {TONE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <div className="absolute right-3 top-3 text-slate-400 pointer-events-none">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Marksheets Upload */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-1" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>Upload marksheets</h2>
          <p className="text-sm text-slate-500 mb-4">Upload semester marksheets for CGPA and backlogs verification by your college admin.</p>
          
          <div 
            onClick={() => marksheetInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50 hover:border-indigo-400 transition"
          >
            <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg" className="hidden" ref={marksheetInputRef} onChange={handleMarksheetUpload} />
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 mb-2"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
            <p className="text-sm font-medium text-slate-700">Drop marksheet files or <span className="text-indigo-600">browse</span></p>
            <p className="text-xs text-slate-400 mt-1">PDF, JPG, PNG up to 5MB each</p>
          </div>

          {marksheets.length > 0 && (
            <div className="mt-4 space-y-2">
              {marksheets.map(m => (
                <div key={m.id} className="flex items-center justify-between border border-slate-100 rounded-lg px-4 py-3 bg-red-50/20">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded uppercase">PDF</span> {/* Hardcoded for UI mock match, can be dynamic */}
                    <span className="font-semibold text-slate-800 text-sm">{m.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-medium text-slate-400">{formatSize(m.size)}</span>
                    {m.status === 'uploading' ? (
                      <span className="text-[11px] font-bold px-2 py-1 rounded-md bg-amber-50 text-amber-600">Uploading...</span>
                    ) : (
                      <span className="text-[11px] font-bold px-2 py-1 rounded-md bg-emerald-50 text-emerald-600">Uploaded</span>
                    )}
                    <button type="button" onClick={() => handleRemoveMarksheet(m.id)} className="text-slate-400 hover:text-red-500">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                  </div>
                </div>
              ))}
              <p className="text-xs font-medium text-slate-500 mt-3">{marksheets.filter(m => m.status === 'uploaded').length} files uploaded. Admin will verify these against their records.</p>
            </div>
          )}
        </div>

        {/* Resume Upload */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-4" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>Resume upload</h2>
          
          <div 
            onClick={() => resumeInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50 hover:border-indigo-400 transition"
          >
            <input type="file" accept=".pdf" className="hidden" ref={resumeInputRef} onChange={handleResumeUpload} />
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 mb-2"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
            <p className="text-sm font-medium text-slate-700">Drop resume or <span className="text-indigo-600">browse</span></p>
          </div>

          {loading && <p className="text-sm text-indigo-600 mt-3 font-medium">Uploading...</p>}
          {resumeFileObj && !loading && <p className="text-sm text-emerald-600 mt-3 font-medium">Resume selected - will upload on submit</p>}
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-4 pt-4 pb-10">
          <button type="button" className="px-6 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition">
            Skip
          </button>
          <button type="submit" disabled={loading} className="px-6 py-2.5 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 transition shadow-sm disabled:opacity-50 flex items-center gap-2">
            {loading ? <LoadingSpinner /> : null}
            Save and continue
          </button>
        </div>
      </form>
    </div>
  );
}
