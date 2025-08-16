import { ClipboardCheck, FileText, Briefcase, BarChart } from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="bg-gray-900 min-h-screen text-white flex flex-col items-center justify-center p-4 font-sans">
      <div className="text-center max-w-4xl">
        <ClipboardCheck className="mx-auto h-16 w-16 text-blue-400 mb-4" />
        <h1 className="text-5xl md:text-6xl font-extrabold mb-4">
          Intervieo: Your Personalized AI Career Coach
        </h1>
        <p className="text-lg md:text-xl text-gray-300 mb-8">
          Stop practicing with generic questions. Intervieo analyzes your resume and your target job description to conduct a hyper-realistic mock interview tailored specifically to you.
        </p>
        <Link href="/setup">
          <button className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-8 rounded-lg text-xl transition-transform transform hover:scale-105 shadow-lg">
            Get Started
          </button>
        </Link>
      </div>

      <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl w-full">
        <FeatureCard
          icon={<FileText />}
          title="Upload Your Resume"
          description="Provide your resume as a PDF. Intervieo will parse your experience, skills, and projects."
        />
        <FeatureCard
          icon={<Briefcase />}
          title="Target a Job"
          description="Paste the URL of a job description you're interested in. Intervieo identifies the key requirements."
        />
        <FeatureCard
          icon={<BarChart />}
          title="Get In-depth Analysis"
          description="Receive a detailed report on your performance, including pace, clarity, and qualitative feedback."
        />
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }) {
  return (
    <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 text-center">
      <div className="text-blue-400 mb-4 inline-block">{icon}</div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-gray-400">{description}</p>
    </div>
  );
}
