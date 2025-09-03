import dotenv from 'dotenv';
dotenv.config();
import connectDB from '../src/utils/db.js';
import User from '../src/models/User.js';
import { ROLES } from '../src/utils/constants.js';

async function run() {
  await connectDB();
  const name = process.env.SEED_SUPERADMIN_NAME || 'Super Admin';
  const email = process.env.SEED_SUPERADMIN_EMAIL || 'superadmin@example.com';
  const password = process.env.SEED_SUPERADMIN_PASSWORD || 'ChangeMe123!';
  const existing = await User.findOne({ email });
  if (existing) {
    console.log('Super admin already exists:', email);
    process.exit(0);
  }
  const user = await User.create({ name, email, password, role: ROLES.SUPER_ADMIN });
  console.log('✅ Super admin created:', user.email);
  process.exit(0);
}
run().catch(err => {
  console.error(err);
  process.exit(1);
});
