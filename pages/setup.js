import { useState } from 'react';
import { useRouter } from 'next/router';
import { Upload, Link2, Loader, AlertCircle } from 'lucide-react';

export default function SetupPage() {
  const [resumeFile, setResumeFile] = useState(null);
  const [jobUrl, setJobUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setResumeFile(file);
      setError('');
    } else {
      setError('Please upload a PDF file.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!resumeFile || !jobUrl) {
      setError('Please provide both your resume and a job URL.');
      return;
    }
    setIsLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('resume', resumeFile);
    formData.append('jobUrl', jobUrl);

    try {
      const response = await fetch('/api/session/create', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Something went wrong.');
      }

      const data = await response.json();
      // In a real app, we'd redirect to /interview/[sessionId]
      // For now, we'll just log it and show a success state.
      console.log('Created session:', data.sessionId);
      router.push(`/interview/${data.sessionId}`); // Redirect to the interview page

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-900 min-h-screen text-white flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 shadow-2xl">
          <h2 className="text-3xl font-bold text-center mb-2">Prepare for Your Interview</h2>
          <p className="text-center text-gray-400 mb-8">Upload your resume and the job description to start.</p>

          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-300 p-3 rounded-lg mb-6 flex items-center">
              <AlertCircle className="mr-3" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="block text-gray-300 text-sm font-bold mb-2" htmlFor="resume">
                1. Upload Your Resume (PDF)
              </label>
              <div className="relative border-2 border-dashed border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition-colors">
                <Upload className="mx-auto h-12 w-12 text-gray-500" />
                <p className="mt-2 text-gray-400">
                  {resumeFile ? resumeFile.name : 'Drag & drop or click to upload'}
                </p>
                <input
                  id="resume"
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
            </div>

            <div className="mb-8">
              <label className="block text-gray-300 text-sm font-bold mb-2" htmlFor="jobUrl">
                2. Paste Job Description URL
              </label>
              <div className="relative">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="jobUrl"
                  type="url"
                  value={jobUrl}
                  onChange={(e) => setJobUrl(e.target.value)}
                  placeholder="https://www.linkedin.com/jobs/view/..."
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 pl-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-lg text-lg transition-all flex items-center justify-center disabled:bg-gray-600"
            >
              {isLoading ? <Loader className="animate-spin" /> : 'Start Tailored Interview'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}