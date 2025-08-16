import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// --- RAG HELPER FUNCTIONS ---

function dotProduct(vecA, vecB) {
  let product = 0;
  for (let i = 0; i < vecA.length; i++) {
    product += vecA[i] * vecB[i];
  }
  return product;
}

function magnitude(vec) {
  return Math.sqrt(dotProduct(vec, vec));
}

function cosineSimilarity(vecA, vecB) {
  if (magnitude(vecA) === 0 || magnitude(vecB) === 0) return 0;
  return dotProduct(vecA, vecB) / (magnitude(vecA) * magnitude(vecB));
}

async function getEmbeddingForQuery(query) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedContent?key=${apiKey}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: "models/embedding-001",
            content: { parts: [{ text: query }] }
        }),
    });
    if (!response.ok) throw new Error(`Failed to get embedding for query: ${await response.text()}`);
    const result = await response.json();
    return result.embedding.values;
}

async function findRelevantContext(query, vectorStore, topK = 3) {
    if (!vectorStore || !Array.isArray(vectorStore) || vectorStore.length === 0) return [];
    
    const queryEmbedding = await getEmbeddingForQuery(query);
    
    const similarities = vectorStore.map(item => ({
        text: item.text,
        similarity: cosineSimilarity(queryEmbedding, item.embedding),
    }));

    similarities.sort((a, b) => b.similarity - a.similarity);
    
    return similarities.slice(0, topK).map(item => item.text);
}

async function generateQuestion(history, context) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    const contextString = context.map((c, i) => `CONTEXT ${i+1}:\n${c}`).join('\n\n');

    // CORRECTED: system_instruction must be an object with a 'parts' array.
    const system_instruction = {
        parts: [{
            text: `You are a world-class interviewer at a top tech company. Your goal is to conduct a deep, insightful interview based on the provided context from the candidate's resume and the job description.
- Ask only one question at a time.
- Use the provided context to ask specific, probing questions. For example, instead of "Tell me about a project," ask "In your project X mentioned on your resume, you used technology Y. The job requires Z. Can you explain how you would adapt your experience to meet this requirement?"
- Keep the conversation flowing naturally based on the user's previous answers.
- Do not greet the user or use pleasantries. Dive straight into the next question.`
        }]
    };
    
    const contents = [
        ...history,
        {
            role: 'user',
            parts: [{ text: `Here is the relevant context from the resume and job description:\n${contextString}\n\nBased on this context and our conversation so far, ask the next interview question.` }]
        }
    ];

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents, system_instruction }),
    });

    if (!response.ok) throw new Error(`Gemini API request failed: ${await response.text()}`);
    const result = await response.json();
    return result.candidates[0].content.parts[0].text;
}


// --- MAIN API HANDLER ---
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { sessionId, history, query } = req.body;

    try {
        const session = await prisma.interviewSession.findUnique({ where: { id: sessionId }});
        if (!session) return res.status(404).json({ message: 'Session not found.' });

        const context = await findRelevantContext(query, session.vectorStore);
        
        const nextQuestion = await generateQuestion(history, context);

        // Save messages to DB
        const userMessageText = history.find(h => h.role === 'user')?.parts[0]?.text || query;
        await prisma.message.create({ data: { sessionId, text: userMessageText, isUser: true } });
        const aiMessage = await prisma.message.create({ data: { sessionId, text: nextQuestion, isUser: false } });

        res.status(200).json({ question: nextQuestion, messageId: aiMessage.id });

    } catch (error) {
        console.error("Error in /api/interview/ask:", error);
        res.status(500).json({ message: error.message || 'Failed to generate question.' });
    }
}

