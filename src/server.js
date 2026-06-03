import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
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

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [];

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // allow same-origin / server-to-server requests (no Origin header)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(Object.assign(new Error('Not allowed by CORS'), { status: 403 }));
  },
  credentials: true,
}));
app.use(express.json());
app.use(morgan('dev'));

const otpRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many OTP requests, please try again after 15 minutes' },
});

app.get('/', (req, res) => {
  res.json({ status: 'ok', name: 'agency-finance-backend', version: '1.0.0' });
});

// ✅ 1) PUBLIC ROUTES (no auth, no billing)
// Rate-limit OTP-generation endpoints: 5 requests per IP per 15 min
app.use('/api/auth/forgot-password', otpRateLimit);
app.use('/api/auth/resend-verification-email', otpRateLimit);
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
