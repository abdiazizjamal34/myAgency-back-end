import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import connectDB from './utils/db.js';
import authRoutes from './routes/auth.routes.js';
import agencyRoutes from './routes/agency.routes.js';
import userRoutes from './routes/user.routes.js';
import recordRoutes from './routes/record.routes.js';
import reportRoutes from './routes/report.routes.js';
import errorHandler from './utils/errorHandler.js';
import path from 'path';
import notificationRoutes from './routes/notification.routes.js';
import agencyTicketRoutes from './routes/agencyTicket.routes.js' 
import ticketTemplatesRoutes from './routes/ticketTemplates.routes.js'
import ticketsRoutes from './routes/tickets.routes.js'
dotenv.config();
const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/', (req, res) => {
  res.json({ status: 'ok', name: 'agency-finance-backend', version: '1.0.0' });
});

app.use('/api/auth', authRoutes);
app.use('/api/agencies', agencyRoutes);
app.use('/api/users', userRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/reports', reportRoutes);
app.use("/api/notifications", notificationRoutes);

// Tickt templets 
app.use('/api/agency-ticket', agencyTicketRoutes);
app.use('/api/ticket-templates', ticketTemplatesRoutes);
app.use('/api/tickets', ticketsRoutes);


app.use('/uploads', express.static(path.resolve('uploads')));

// central error handler
app.use(errorHandler);

const PORT = process.env.PORT || 4000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ Server listening on port ${PORT}`);
  });
}).catch((err) => {
  console.error('❌ Failed to start server', err);
  process.exit(1);
});
