import { PrismaClient } from '@prisma/client';
import formidable from 'formidable';
import fs from 'fs/promises';
import pdf from 'pdf-parse';
import * as cheerio from 'cheerio';

const prisma = new PrismaClient();

export const config = {
  api: {
    bodyParser: false,
  },
};

// --- HELPER FUNCTIONS ---

function parseFormData(req) {
  return new Promise((resolve, reject) => {
    const form = formidable();
    form.parse(req, (err, fields, files) => {
      if (err) {
        return reject(err);
      }
      const jobUrl = fields.jobUrl?.[0];
      const resumeFile = files.resume?.[0];
      if (!jobUrl || !resumeFile) {
        return reject(new Error('Missing job URL or resume file.'));
      }
      resolve({ jobUrl, resumeFile });
    });
  });
}

// THIS IS THE UPDATED, SMARTER SCRAPER FUNCTION
async function scrapeJobDescription(url) {
  try {
    // We add a User-Agent header to mimic a real browser visit
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // More specific selectors for LinkedIn job descriptions
    const jobDescription = $('.show-more-less-html__markup').text();
    
    // Fallback to body if the specific selector fails
    const fallbackText = $('body').text();

    const extractedText = jobDescription || fallbackText;

    return extractedText.replace(/\s\s+/g, ' ').trim();

  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
    throw new Error('Could not retrieve job description from the provided URL.');
  }
}

async function parseResume(resumeFile) {
  const fileBuffer = await fs.readFile(resumeFile.filepath);
  const data = await pdf(fileBuffer);
  return data.text.replace(/\s\s+/g, ' ').trim();
}

function chunkText(text, chunkSize = 1000, overlap = 100) {
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize - overlap) {
    chunks.push(text.substring(i, i + chunkSize));
  }
  return chunks;
}

async function getEmbeddings(textChunks) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set in the environment.");
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/embedding-001:batchEmbedContents?key=${apiKey}`;
  
  const requests = textChunks.map(chunk => ({
    model: "models/embedding-001",
    content: { parts: [{ text: chunk }] }
  }));

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests }),
  });

  if (!response.ok) {
    const errorBody = await response.json();
    throw new Error(JSON.stringify(errorBody));
  }
  const result = await response.json();
  return result.embeddings.map(e => e.values);
}

async function getOrCreateUser() {
    const userEmail = "testuser@example.com";
    let user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (!user) {
        user = await prisma.user.create({ data: { email: userEmail } });
    }
    return user;
}

// --- MAIN API HANDLER ---
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { jobUrl, resumeFile } = await parseFormData(req);

    const [jobDescriptionText, resumeText] = await Promise.all([
      scrapeJobDescription(jobUrl),
      parseResume(resumeFile),
    ]);
    
    if (!jobDescriptionText || !resumeText) {
        throw new Error("Failed to extract text from one of the documents.");
    }

    const jobChunks = chunkText(jobDescriptionText);
    const resumeChunks = chunkText(resumeText);
    const allChunks = [...jobChunks, ...resumeChunks];

    const embeddings = await getEmbeddings(allChunks);

    const vectorStore = allChunks.map((chunk, i) => ({
      text: chunk,
      embedding: embeddings[i],
    }));

    const user = await getOrCreateUser();
    const newSession = await prisma.interviewSession.create({
      data: {
        userId: user.id,
        jobDescriptionText,
        resumeText,
        vectorStore,
      },
    });

    res.status(201).json({ sessionId: newSession.id });

  } catch (error) {
    console.error("Error in /api/session/create:", error);
    res.status(500).json({ message: error.message || 'Failed to create interview session.' });
  }
}

