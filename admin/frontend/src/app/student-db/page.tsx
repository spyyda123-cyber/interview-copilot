"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import {
  getStudentDatabase,
  uploadStudentDatabase,
  addSingleStudent,
  type StudentDatabaseRecord,
} from "@/lib/api";

const DEPARTMENTS = ["CSE", "IT", "ECE", "EEE", "MECH", "CIVIL", "MBA", "MCA", "Other"];

const emptyForm = {
  roll_no: "",
  name: "",
  department: "CSE",
  cgpa: "",
  backlogs: "",
  email: "",
};

export default function StudentDBPage() {
  const [records, setRecords] = useState<StudentDatabaseRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Add single student modal
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getStudentDatabase({ per_page: 100 });
      setRecords(data.records);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load student database");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const result = await uploadStudentDatabase(file);
      if (result.error) throw new Error(result.error);
      alert(`Upload successful!\nImported: ${result.imported}\nSkipped: ${result.skipped}`);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload file");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFormChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaveError(null);
    setSaveSuccess(null);
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(null);

    const cgpa = parseFloat(form.cgpa);
    const backlogs = parseInt(form.backlogs, 10);

    if (!form.roll_no.trim() || !form.name.trim() || !form.email.trim()) {
      setSaveError("Roll No, Name, and Email are required.");
      return;
    }
    if (isNaN(cgpa) || cgpa < 0 || cgpa > 10) {
      setSaveError("CGPA must be a number between 0 and 10.");
      return;
    }
    if (isNaN(backlogs) || backlogs < 0) {
      setSaveError("Backlogs must be 0 or more.");
      return;
    }

    setSaving(true);
    try {
      await addSingleStudent({
        roll_no: form.roll_no.trim(),
        name: form.name.trim(),
        department: form.department,
        cgpa,
        backlogs,
        email: form.email.trim().toLowerCase(),
      });
      setSaveSuccess(`${form.name.trim()} added successfully.`);
      setForm(emptyForm);
      loadData();
      // Auto-close after 1.5s
      setTimeout(() => { setShowModal(false); setSaveSuccess(null); }, 1500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to add student.");
    } finally {
      setSaving(false);
    }
  };

  const latestUploadDate = records.length > 0
    ? new Date(Math.max(...records.map((r) => new Date(r.updated_at).getTime()))).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#222222]">Student database</h1>
          <p className="mt-1 text-sm text-[#555555]">Upload and manage student CGPA, backlogs, and eligibility data.</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Add Single Student */}
          <button
            onClick={() => { setShowModal(true); setSaveError(null); setSaveSuccess(null); setForm(emptyForm); }}
            className="inline-flex items-center gap-2 rounded-xl border border-[#d9f36e] bg-[#d9f36e] px-4 py-2.5 text-sm font-bold text-[#222222] hover:bg-[#c8e055] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Student
          </button>
          {/* Upload Excel */}
          <input type="file" accept=".csv,.xlsx,.xls" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
          <button
            onClick={handleUploadClick}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-xl border border-[#e8e8e8] bg-white px-4 py-2.5 text-sm font-semibold text-[#222222] hover:bg-[#f3f3f3] transition-colors disabled:opacity-50"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            {uploading ? "Uploading..." : "Upload Excel"}
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>}

      {records.length > 0 && latestUploadDate && (
        <div className="rounded-lg bg-[#f7ffe0] border border-[#d9f36e] px-4 py-2.5 text-sm text-[#222222] font-medium">
          Last upload: Data synced ({total} students) — {latestUploadDate}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-[#e8e8e8] bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#e8e8e8] bg-[#f3f3f3]">
              <tr>
                {["Roll No", "Name", "Dept", "CGPA", "Backlogs", "Email", "Status"].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-[10px] font-bold tracking-[0.1em] text-[#888888] uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e8e8e8]">
              {loading ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-[#aaaaaa] text-sm">Loading...</td></tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#cccccc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                      </svg>
                      <p className="text-sm text-[#aaaaaa]">No students yet. Add one manually or upload an Excel file.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record.id} className="hover:bg-[#f7ffe0] transition-colors">
                    <td className="px-5 py-3.5 text-[#555555] font-medium">{record.roll_no}</td>
                    <td className="px-5 py-3.5 text-[#222222] font-bold">{record.name}</td>
                    <td className="px-5 py-3.5 text-[#555555]">{record.department}</td>
                    <td className="px-5 py-3.5 text-[#222222] font-semibold">{record.cgpa}</td>
                    <td className="px-5 py-3.5 text-[#555555]">{record.backlogs}</td>
                    <td className="px-5 py-3.5 text-[#555555]">{record.email}</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex rounded-full bg-[#f7ffe0] border border-[#d9f36e] px-2.5 py-0.5 text-[11px] font-bold text-[#222222]">
                        {record.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl bg-[#f7ffe0] border border-[#d9f36e] p-4 text-xs text-[#222222] leading-relaxed">
        <span className="font-bold">Key change:</span> CGPA and backlogs are NOT entered by students. Admin uploads this data via Excel or adds students manually. During approval, the system pulls each student's CGPA and backlogs from this database automatically.
      </div>

      {/* ── Add Student Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#e8e8e8] bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#e8e8e8] px-6 py-4">
              <div>
                <h2 className="text-base font-bold text-[#222222]">Add Student</h2>
                <p className="text-xs text-[#888888] mt-0.5">Add a single student to the database. Existing email will be updated.</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg hover:bg-[#f3f3f3] transition-colors text-[#888888]"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleAddStudent} className="px-6 py-5 space-y-4">
              {/* Row 1: Roll No + Name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#555555] uppercase tracking-wide mb-1.5">Roll No *</label>
                  <input
                    type="text"
                    value={form.roll_no}
                    onChange={(e) => handleFormChange("roll_no", e.target.value)}
                    placeholder="e.g. CLG001"
                    required
                    suppressHydrationWarning
                    className="w-full rounded-lg border border-[#e8e8e8] bg-[#f3f3f3] px-3 py-2 text-sm text-[#222222] placeholder-[#aaaaaa] focus:outline-none focus:border-[#d9f36e] focus:ring-2 focus:ring-[#d9f36e]/20 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#555555] uppercase tracking-wide mb-1.5">Full Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => handleFormChange("name", e.target.value)}
                    placeholder="e.g. Arun Kumar"
                    required
                    suppressHydrationWarning
                    className="w-full rounded-lg border border-[#e8e8e8] bg-[#f3f3f3] px-3 py-2 text-sm text-[#222222] placeholder-[#aaaaaa] focus:outline-none focus:border-[#d9f36e] focus:ring-2 focus:ring-[#d9f36e]/20 transition-colors"
                  />
                </div>
              </div>

              {/* Row 2: Email */}
              <div>
                <label className="block text-[11px] font-bold text-[#555555] uppercase tracking-wide mb-1.5">Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => handleFormChange("email", e.target.value)}
                  placeholder="student@college.edu"
                  required
                  suppressHydrationWarning
                  className="w-full rounded-lg border border-[#e8e8e8] bg-[#f3f3f3] px-3 py-2 text-sm text-[#222222] placeholder-[#aaaaaa] focus:outline-none focus:border-[#d9f36e] focus:ring-2 focus:ring-[#d9f36e]/20 transition-colors"
                />
              </div>

              {/* Row 3: Dept + CGPA + Backlogs */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#555555] uppercase tracking-wide mb-1.5">Department</label>
                  <select
                    value={form.department}
                    onChange={(e) => handleFormChange("department", e.target.value)}
                    className="w-full rounded-lg border border-[#e8e8e8] bg-[#f3f3f3] px-3 py-2 text-sm text-[#222222] focus:outline-none focus:border-[#d9f36e] focus:ring-2 focus:ring-[#d9f36e]/20 transition-colors"
                  >
                    {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#555555] uppercase tracking-wide mb-1.5">CGPA</label>
                  <input
                    type="number"
                    value={form.cgpa}
                    onChange={(e) => handleFormChange("cgpa", e.target.value)}
                    placeholder="8.5"
                    min="0"
                    max="10"
                    step="0.01"
                    required
                    suppressHydrationWarning
                    className="w-full rounded-lg border border-[#e8e8e8] bg-[#f3f3f3] px-3 py-2 text-sm text-[#222222] placeholder-[#aaaaaa] focus:outline-none focus:border-[#d9f36e] focus:ring-2 focus:ring-[#d9f36e]/20 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#555555] uppercase tracking-wide mb-1.5">Backlogs</label>
                  <input
                    type="number"
                    value={form.backlogs}
                    onChange={(e) => handleFormChange("backlogs", e.target.value)}
                    placeholder="0"
                    min="0"
                    required
                    suppressHydrationWarning
                    className="w-full rounded-lg border border-[#e8e8e8] bg-[#f3f3f3] px-3 py-2 text-sm text-[#222222] placeholder-[#aaaaaa] focus:outline-none focus:border-[#d9f36e] focus:ring-2 focus:ring-[#d9f36e]/20 transition-colors"
                  />
                </div>
              </div>

              {/* Feedback */}
              {saveError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">{saveError}</div>
              )}
              {saveSuccess && (
                <div className="rounded-lg border border-[#d9f36e] bg-[#f7ffe0] px-3 py-2.5 text-sm text-[#222222] font-semibold">
                  ✓ {saveSuccess}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-[#e8e8e8] bg-[#f3f3f3] px-4 py-2 text-sm font-semibold text-[#555555] hover:bg-[#e8e8e8] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-[#222222] px-5 py-2 text-sm font-bold text-[#d9f36e] hover:bg-[#d9f36e] hover:text-[#222222] disabled:opacity-60 transition-colors"
                >
                  {saving ? "Saving..." : "Add Student"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
