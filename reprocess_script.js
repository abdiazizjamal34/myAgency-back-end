
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import TicketDocument from './src/models/TicketDocument.js';
import { normalizeTicketSchema } from './src/services/ticketNormalizationOrchestrator.service.js';

dotenv.config();

async function run() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to MongoDB.");

        const id = "69b88ac6e6a9f3af3323e4d4";
        const ticket = await TicketDocument.findById(id);

        if (!ticket) {
            console.log("Ticket not found.");
            process.exit(1);
        }

        console.log("Found ticket. Raw text length:", ticket.source.rawText?.length);

        const result = await normalizeTicketSchema(ticket.source.rawText);
        console.log("Normalization complete.");

        await TicketDocument.findByIdAndUpdate(id, {
            $set: {
                itinerary: result.normalized.itinerary,
                processingStatus: "READY"
            }
        });

        console.log("Ticket updated with new schema data.");
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
