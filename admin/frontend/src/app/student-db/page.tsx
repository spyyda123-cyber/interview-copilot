"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import PageHeader from "@/components/ui/PageHeader";
import { 
  getStudentDatabase, 
  uploadStudentDatabase, 
  type StudentDatabaseRecord 
} from "@/lib/api";

export default function StudentDBPage() {
  const [records, setRecords] = useState<StudentDatabaseRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getStudentDatabase({ per_page: 50 }); // fetch up to 50 for now
      setRecords(data.records);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load student database");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const result = await uploadStudentDatabase(file);
      if (result.error) {
        throw new Error(result.error);
      }
      alert(`Upload successful!\nImported: ${result.imported}\nSkipped: ${result.skipped}`);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload file");
    } finally {
      setUploading(false);
      // Reset input so the same file can be uploaded again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const latestUploadDate = records.length > 0 
    ? new Date(Math.max(...records.map(r => new Date(r.updated_at).getTime()))).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">Student database</h1>
          <p className="mt-1 text-sm text-[#4b5563]">
            Upload and manage student CGPA, backlogs, and eligibility data.
          </p>
        </div>
        <div>
          <input 
            type="file" 
            accept=".csv, .xlsx, .xls"
            className="hidden" 
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          <button
            onClick={handleUploadClick}
            disabled={uploading}
            className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Upload Excel"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {records.length > 0 && latestUploadDate && (
        <div className="rounded-md bg-[#eef4fd] px-4 py-3 text-sm text-[#2563eb] font-medium border border-[#dbeafe]">
          Last upload: Data synced ({total} students) — {latestUploadDate}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="border-b border-gray-200 bg-white text-xs text-gray-900">
              <tr>
                <th className="px-6 py-4 font-semibold">Roll no</th>
                <th className="px-6 py-4 font-semibold">Name</th>
                <th className="px-6 py-4 font-semibold">Dept</th>
                <th className="px-6 py-4 font-semibold">CGPA</th>
                <th className="px-6 py-4 font-semibold">Backlogs</th>
                <th className="px-6 py-4 font-semibold">Email</th>
                <th className="px-6 py-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    No student database records uploaded yet. Click "Upload Excel" to begin.
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50/50">
                    <td className="px-6 py-4 text-gray-900 font-medium">{record.roll_no}</td>
                    <td className="px-6 py-4 text-gray-900 font-bold">{record.name}</td>
                    <td className="px-6 py-4">{record.department}</td>
                    <td className="px-6 py-4 text-gray-900 font-medium">{record.cgpa}</td>
                    <td className="px-6 py-4">{record.backlogs}</td>
                    <td className="px-6 py-4">{record.email}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex rounded-full bg-[#ecfdf5] px-2.5 py-0.5 text-xs font-semibold text-[#059669]">
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

      <div className="rounded-lg bg-[#faf9f6] p-4 text-sm text-[#525252] border border-[#f0eee4]">
        <span className="font-bold text-gray-800">Key change:</span> CGPA and backlogs are NOT entered by students. Admin uploads this data via Excel. During approval, the system pulls each student's CGPA and backlogs from this database automatically.
      </div>
    </div>
  );
}
