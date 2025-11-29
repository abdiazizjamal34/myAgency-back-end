import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

export default async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is not set');
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { autoIndex: true });
  console.log('🗄️  MongoDB connected');
}


// import mongoose from 'mongoose';
// import dotenv from 'dotenv';
// dotenv.config();

// export default async function connectDB() {
//   const uri = process.env.MONGO_URI;
//   const uriNonSrv = process.env.MONGO_URI_NON_SRV; // set this from Atlas "Standard connection string"
//   if (!uri && !uriNonSrv) throw new Error('MONGO_URI or MONGO_URI_NON_SRV must be set');

//   mongoose.set('strictQuery', true);

//   const opts = {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
//     serverSelectionTimeoutMS: 10000,
//     connectTimeoutMS: 10000,
//     socketTimeoutMS: 45000,
//     family: 4, // prefer IPv4 if DNS/IPv6 is flaky
//     autoIndex: true,
//   };

//   try {
//     // prefer MONGO_URI (SRV) if present
//     if (uri) {
//       console.log('🗄️  Connecting to MongoDB (SRV) using MONGO_URI');
//       await mongoose.connect(uri, opts);
//     } else {
//       console.log('🗄️  MONGO_URI missing — connecting using MONGO_URI_NON_SRV');
//       await mongoose.connect(uriNonSrv, opts);
//     }
//     console.log('🗄️  MongoDB connected');
//   } catch (err) {
//     // If SRV failed and a non-SRV string is provided, try fallback
//     if (uri && uriNonSrv) {
//       console.warn('⚠️  SRV connection failed — attempting non-SRV fallback (MONGO_URI_NON_SRV)');
//       try {
//         await mongoose.connect(uriNonSrv, opts);
//         console.log('🗄️  MongoDB connected (non-SRV fallback)');
//         return;
//       } catch (err2) {
//         console.error('❌ Non-SRV connection also failed:', err2.message);
//         throw err2;
//       }
//     }
//     console.error('❌ MongoDB connection error:', err.message);
//     throw err;
//   }
// }

// import mongoose from 'mongoose';
// import dotenv from 'dotenv';
// dotenv.config();

// export default async function connectDB() {
//   const uri = process.env.MONGO_URI;
//   const uriNonSrv = process.env.MONGO_URI_NON_SRV;
//   if (!uri && !uriNonSrv) throw new Error('MONGO_URI or MONGO_URI_NON_SRV must be set');

//   mongoose.set('strictQuery', true);

//   const opts = {
//     // driver v4+ ignores useNewUrlParser/useUnifiedTopology — do not pass them
//     serverSelectionTimeoutMS: 10000,
//     connectTimeoutMS: 10000,
//     socketTimeoutMS: 45000,
//     family: 4, // prefer IPv4
//     autoIndex: true,
//   };

//   try {
//     if (uri) {
//       console.log('🗄️  Connecting to MongoDB (SRV) using MONGO_URI');
//       await mongoose.connect(uri, opts);
//     } else {
//       console.log('🗄️  MONGO_URI missing — connecting using MONGO_URI_NON_SRV');
//       await mongoose.connect(uriNonSrv, opts);
//     }
//     console.log('🗄️  MongoDB connected');
//   } catch (err) {
//     if (uri && uriNonSrv) {
//       console.warn('⚠️  SRV connection failed — attempting non-SRV fallback (MONGO_URI_NON_SRV)');
//       try {
//         await mongoose.connect(uriNonSrv, opts);
//         console.log('🗄️  MongoDB connected (non-SRV fallback)');
//         return;
//       } catch (err2) {
//         console.error('❌ Non-SRV connection also failed:', err2.message);
//         throw err2;
//       }
//     }
//     console.error('❌ MongoDB connection error:', err.message);
//     throw err;
//   }
// }