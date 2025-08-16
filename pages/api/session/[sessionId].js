import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export default async function handler(req, res) {
    const { sessionId } = req.query;

    if (!sessionId) {
        return res.status(400).json({ message: 'Session ID is required.' });
    }

    try {
        const session = await prisma.interviewSession.findUnique({
            where: { id: sessionId },
            include: {
                messages: true, // Also include messages for resuming an interview
            }
        });

        if (!session) {
            return res.status(404).json({ message: 'Interview session not found.' });
        }

        // Return all the data needed for the interview page
        res.status(200).json(session);

    } catch (error) {
        console.error(`Error fetching session ${sessionId}:`, error);
        res.status(500).json({ message: 'Failed to fetch session data.' });
    }
}