import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { Bot, User, Send, Loader, ClipboardCheck, AlertCircle, Flag, Mic, MicOff } from 'lucide-react';

export default function InterviewPage() {
    const router = useRouter();
    const { sessionId } = router.query;
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [sessionData, setSessionData] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const recognitionRef = useRef(null);
    const messagesEndRef = useRef(null);

    // --- Voice & Speech Recognition Logic ---

    useEffect(() => {
        if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
            const recognition = new window.webkitSpeechRecognition();
            recognition.continuous = false; // Listen for a single utterance
            recognition.interimResults = false;
            recognition.lang = 'en-US';

            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                setIsRecording(false); // Turn off recording indicator immediately
                handleSendMessage(transcript); // Automatically send the transcribed text
            };
            
            recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                    setError('Microphone access was denied. Please allow microphone access in your browser settings and refresh the page.');
                }
                setIsRecording(false);
            };

            recognition.onend = () => {
                // This event fires when recognition ends.
                // We set isRecording to false here to ensure the UI updates.
                setIsRecording(false);
            };

            recognitionRef.current = recognition;
        }
    }, []);

    const speak = (text) => {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            // If the microphone is trying to listen, don't speak over it.
            if (isRecording) {
                recognitionRef.current?.stop();
            }
            speechSynthesis.cancel(); // Stop any previous speech
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.95;
            utterance.pitch = 1.0;
            speechSynthesis.speak(utterance);
        }
    };

    const toggleRecording = () => {
        if (isRecording) {
            recognitionRef.current?.stop();
            setIsRecording(false);
        } else {
            // Crucially, stop any AI speech before we start listening.
            if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                speechSynthesis.cancel();
            }
            recognitionRef.current?.start();
            setIsRecording(true);
        }
    };


    // --- Data Fetching and Message Handling Logic ---

    useEffect(() => {
        if (sessionId) {
            const fetchSessionData = async () => {
                try {
                    const res = await fetch(`/api/session/${sessionId}`);
                    if (!res.ok) throw new Error('Could not fetch session data.');
                    const data = await res.json();
                    setSessionData(data);
                    const initialMessages = data.messages.length > 0 ? data.messages : [{
                        id: 'initial',
                        text: "Welcome to your personalized interview. I have reviewed your resume and the job description. When you're ready, type 'start' or click the mic to begin.",
                        isUser: false
                    }];
                    setMessages(initialMessages);
                    // Only speak the welcome message if it's a brand new session
                    if (initialMessages.length === 1 && initialMessages[0].id === 'initial') {
                        speak(initialMessages[0].text);
                    }
                } catch (e) {
                    setError(e.message);
                }
            };
            fetchSessionData();
        }
    }, [sessionId]);
    
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSendMessage = async (messageText) => {
        const text = typeof messageText === 'string' ? messageText : input;
        if (!text.trim()) return;

        const userMessage = { id: `user-${Date.now()}`, text, isUser: true };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const res = await fetch('/api/interview/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId,
                    history: messages.slice(-4).map(m => ({
                        role: m.isUser ? 'user' : 'model',
                        parts: [{ text: m.text }]
                    })),
                    query: text,
                }),
            });

            if (!res.ok) {
                 const errorData = await res.json();
                 throw new Error(errorData.message || 'Failed to get AI response.');
            }

            const { question, messageId } = await res.json();
            const aiMessage = { id: messageId, text: question, isUser: false };
            setMessages(prev => [...prev, aiMessage]);
            speak(question);

        } catch (e) {
            const errorMessage = { id: `err-${Date.now()}`, text: e.message, isUser: false, isError: true };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleFinishInterview = async () => {
        setIsLoading(true);
        try {
            await fetch('/api/interview/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId }),
            });
            router.push(`/analysis/${sessionId}`);
        } catch (e) {
            setError("Failed to start analysis. Please try again.");
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSendMessage();
        }
    };

    // --- JSX Rendering ---

    if (error) return <div className="bg-gray-900 min-h-screen flex items-center justify-center text-red-400"><AlertCircle className="mr-4" />Error: {error}</div>;
    if (!sessionData) return <div className="bg-gray-900 min-h-screen flex items-center justify-center text-white"><Loader className="animate-spin mr-4" />Loading Your Personalized Session...</div>;

    return (
        <div className="flex flex-col h-screen bg-gray-900 text-white font-sans">
            <header className="bg-gray-800 p-4 shadow-md flex items-center justify-between">
                <div className="flex items-center">
                    <ClipboardCheck className="w-8 h-8 mr-3 text-blue-400" />
                    <h1 className="text-xl md:text-2xl font-bold">Intervieo Interview</h1>
                </div>
                <button onClick={handleFinishInterview} disabled={isLoading || messages.length <= 1} className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded-lg flex items-center transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed">
                    <Flag className="mr-2" size={18} />
                    Finish & Analyze
                </button>
            </header>

            <main className="flex-1 overflow-y-auto p-4 md:p-6">
                <div className="max-w-4xl mx-auto">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex items-start gap-4 my-6 ${msg.isUser ? 'justify-end' : 'justify-start'}`}>
                            {!msg.isUser && <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0"><Bot size={24} /></div>}
                            <div className={`p-4 rounded-2xl max-w-lg ${msg.isUser ? 'bg-blue-600 rounded-br-none' : msg.isError ? 'bg-red-800' : 'bg-gray-700 rounded-bl-none'}`}>
                                <p className="text-base whitespace-pre-wrap">{msg.text}</p>
                            </div>
                            {msg.isUser && <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0"><User size={24} /></div>}
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex items-start gap-4 my-6 justify-start">
                            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0"><Bot size={24} /></div>
                            <div className="p-4 rounded-2xl max-w-lg bg-gray-700 rounded-bl-none"><Loader className="animate-spin text-white" /></div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </main>

            <footer className="bg-gray-800 p-4 shadow-inner">
                <div className="max-w-4xl mx-auto">
                    <div className="flex items-center bg-gray-700 rounded-xl p-2">
                        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={handleKeyPress} placeholder="Type or use the mic..." className="flex-1 bg-transparent text-white placeholder-gray-400 focus:outline-none resize-none p-2"/>
                        <button onClick={toggleRecording} disabled={isLoading} className={`p-2 rounded-full transition-colors ml-2 ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-600 hover:bg-gray-500'}`}>
                            {isRecording ? <MicOff size={22}/> : <Mic size={22}/>}
                        </button>
                        <button onClick={() => handleSendMessage()} disabled={isLoading || !input.trim()} className="p-2 rounded-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors ml-2"><Send size={22} /></button>
                    </div>
                </div>
            </footer>
        </div>
    );
}



