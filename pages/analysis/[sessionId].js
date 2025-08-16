import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Award, Clock, Filter, Smile, ClipboardCheck, AlertCircle, Loader } from 'lucide-react';

// This is a custom hook to handle polling for the report data.
const useReportPoller = (sessionId) => {
    const [report, setReport] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!sessionId) return;

        let isMounted = true;
        let intervalId;

        const poll = () => {
            // NOTE: The API route is /api/report/
            fetch(`/api/report/${sessionId}`)
                .then(res => {
                    if (!isMounted) return;
                    if (res.status === 202) {
                        return; // Still processing, continue polling.
                    }
                    if (res.ok) {
                        return res.json().then(data => {
                            setReport(data);
                            clearInterval(intervalId); // Stop polling on success
                        });
                    }
                    return res.json().then(errorData => {
                        throw new Error(errorData.message || 'Failed to fetch report.');
                    });
                })
                .catch(err => {
                    if (!isMounted) return;
                    setError(err.message);
                    clearInterval(intervalId); // Stop polling on error
                });
        };

        poll();
        intervalId = setInterval(poll, 3000);

        return () => {
            isMounted = false;
            clearInterval(intervalId);
        };
    }, [sessionId]);

    return { report, error };
};

export default function AnalysisPage() {
    const router = useRouter();
    const { sessionId } = router.query;
    const { report, error } = useReportPoller(sessionId);

    if (error) return <div className="bg-gray-900 min-h-screen flex items-center justify-center text-red-400"><AlertCircle className="mr-4" />Error: {error}</div>;

    if (!report) {
        return (
            <div className="bg-gray-900 min-h-screen flex flex-col items-center justify-center text-white">
                <Loader className="animate-spin h-16 w-16 mb-4" />
                <h1 className="text-3xl font-bold">Analyzing your performance...</h1>
                <p className="text-gray-400 mt-2">This may take a moment. Please don't refresh the page.</p>
            </div>
        );
    }
    
    const SENTIMENT_COLOR = {
        'Positive': '#22c55e',
        'Confident': '#22c55e',
        'Neutral': '#f59e0b',
        'Hesitant': '#f59e0b',
        'Nervous': '#f59e0b',
        'Negative': '#ef4444'
    };

    return (
        <div className="bg-gray-900 min-h-screen text-white p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
                <header className="mb-8">
                    <div className="flex items-center mb-2">
                        <ClipboardCheck className="w-10 h-10 mr-4 text-blue-400" />
                        <h1 className="text-4xl md:text-5xl font-extrabold">Your Interview Report</h1>
                    </div>
                    <p className="text-gray-400">Session ID: {sessionId}</p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <MetricCard icon={<Clock />} title="Pace" value={`${Math.round(report.pace)} WPM`} description="Ideal: 140-160 WPM" />
                    <MetricCard icon={<Filter />} title="Clarity Score" value={`${Math.round(report.clarityScore)} / 100`} description="Based on filler words" />
                    <MetricCard icon={<Smile />} title="Inferred Tone" value={report.sentiment} color={SENTIMENT_COLOR[report.sentiment] || '#ffffff'} />
                    
                    <div className="lg:col-span-3 bg-gray-800 rounded-lg p-6 border border-gray-700">
                         <h2 className="text-2xl font-bold mb-4 flex items-center"><Award className="mr-3 text-yellow-400"/>Qualitative Feedback</h2>
                         <div className="text-gray-300 whitespace-pre-wrap prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: report.qualitativeFeedback.replace(/\n/g, '<br />') }} />
                    </div>
                </div>
            </div>
        </div>
    );
}

const MetricCard = ({ icon, title, value, description, color }) => (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="flex items-center text-gray-400 mb-2">
            {icon}
            <h3 className="ml-2 font-semibold">{title}</h3>
        </div>
        <p className="text-4xl font-bold" style={{ color: color || '#fff' }}>{value}</p>
        {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
    </div>
);