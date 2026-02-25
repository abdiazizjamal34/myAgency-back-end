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
import billingRoutes from "./routes/billing.routes.js";
import adminBillingRoutes from "./routes/adminBilling.routes.js";
import adminAgencyBillingRoutes from "./routes/adminAgencyBilling.routes.js";
import adminJobsRoutes from "./routes/adminJobs.routes.js";
import { startBillingCron } from "./jobs/billing.cron.js";

import { auth as authMiddleware } from "./middleware/auth.js";
import { billingGuard } from "./middleware/billingGuard.js";

dotenv.config();
const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/', (req, res) => {
  res.json({ status: 'ok', name: 'agency-finance-backend', version: '1.0.0' });
});

// ✅ 1) PUBLIC ROUTES (no auth, no billing)
app.use('/api/auth', authRoutes);

// Static
app.use('/uploads', express.static(path.resolve('uploads')));

// ✅ 2) AUTH (sets req.user)
app.use(authMiddleware);

// ✅ 3) BILLING GUARD (sets req.billing + blocks writes if day >= 17 and invoice unpaid)
app.use(billingGuard());

// ✅ 4) PROTECTED ROUTES (everything below is now subject to billing rules)
app.use('/api/billing', billingRoutes);
app.use('/api/admin/billing', adminBillingRoutes);
app.use("/api/admin/billing", adminAgencyBillingRoutes);
app.use("/api/admin/jobs", adminJobsRoutes);

app.use('/api/agencies', agencyRoutes);
app.use('/api/users', userRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/reports', reportRoutes);
app.use("/api/notifications", notificationRoutes);

// Ticket templates
app.use('/api/agency-ticket', agencyTicketRoutes);
app.use('/api/ticket-templates', ticketTemplatesRoutes);
app.use('/api/tickets', ticketsRoutes);

// central error handler
app.use(errorHandler);

const PORT = process.env.PORT || 4000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ Server listening on port ${PORT}`);
    startBillingCron();
  });
}).catch((err) => {
  console.error('❌ Failed to start server', err);
  process.exit(1);
});
