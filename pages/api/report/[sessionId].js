import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export default async function handler(req, res) {
    const { sessionId } = req.query;

    try {
        const report = await prisma.analysisReport.findUnique({
            where: { sessionId },
        });

        if (report) {
            // If the report is found, send it as JSON
            return res.status(200).json(report);
        } else {
            // If not found, tell the client it's still being processed
            return res.status(202).json({ message: 'Report is being generated.' });
        }
    } catch (error) {
        console.error(`Error fetching report for session ${sessionId}:`, error);
        res.status(500).json({ message: 'Failed to fetch report.' });
    }
}
