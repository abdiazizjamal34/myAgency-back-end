import mongoose from 'mongoose';

const AgencySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  address: { type: String, trim: true },
    logo: { type: String, default: '' },
  phone: { type: String, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// AgencySchema.index({ code: 1 });

// export default mongoose.model('Agency', AgencySchema);
export default mongoose.models.Agency || mongoose.model('Agency', AgencySchema);