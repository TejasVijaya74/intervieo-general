import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const FILLER_WORDS = /\b(um|uh|er|ah|like|okay|right|so|you know)\b/gi;

async function performAnalysis(messages) {
    const userMessages = messages.filter(m => m.isUser);
    if (userMessages.length === 0) {
        return { pace: 0, clarityScore: 100, sentiment: 'Neutral', qualitativeFeedback: 'No user responses to analyze.' };
    }

    const fullText = userMessages.map(m => m.text).join(' ');
    const wordCount = fullText.split(/\s+/).filter(Boolean).length;
    
    const interviewDurationMinutes = userMessages.length * 0.75 || 1; 
    const pace = wordCount / interviewDurationMinutes;

    const fillerWordCount = (fullText.match(FILLER_WORDS) || []).length;
    const clarityScore = Math.max(0, 100 - (fillerWordCount / wordCount) * 500);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
    const prompt = `As an expert interview coach, analyze the following interview transcript. Provide a summary of the candidate's performance, focusing on their strengths and areas for improvement. Also, infer the candidate's primary tone (e.g., Confident, Hesitant, Professional, Casual, Nervous). Format the response as: [TONE]###[FEEDBACK]. For example: "Confident###The candidate demonstrated strong technical knowledge...". \n\nTRANSCRIPT:\n${JSON.stringify(messages)}`;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    if (!response.ok) throw new Error('Gemini analysis failed.');
    const result = await response.json();
    const [sentiment, qualitativeFeedback] = result.candidates[0].content.parts[0].text.split('###');

    return {
        pace: Math.round(pace),
        clarityScore: Math.round(clarityScore),
        sentiment: sentiment || 'Neutral',
        qualitativeFeedback: qualitativeFeedback || 'Could not generate feedback.',
    };
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }
    const { sessionId } = req.body;

    res.status(202).json({ message: 'Analysis started.' });

    (async () => {
        try {
            const messages = await prisma.message.findMany({ where: { sessionId }, orderBy: { createdAt: 'asc' } });
            if (messages.length === 0) {
                throw new Error("No messages in session to analyze.");
            }
            const analysisData = await performAnalysis(messages);

            await prisma.analysisReport.create({
                data: {
                    sessionId,
                    ...analysisData,
                },
            });
            console.log(`Report created for session ${sessionId}`);
        } catch (error) {
            console.error(`Failed to analyze session ${sessionId}:`, error);
        }
    })();
}

