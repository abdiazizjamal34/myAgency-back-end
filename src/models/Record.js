import mongoose from 'mongoose';

const RecordSchema = new mongoose.Schema({
  customerName: { type: String, required: true, trim: true },
  typeOfService: { type: String, required: true, trim: true },

  sellingPrice: { type: Number, default: 0 },
  buyingPrice: { type: Number, default: 0 },
  expenses: { type: Number, default: 0 },
  commission: { type: Number, default: 0 },

  // new fields from frontend
  notes: { type: String, trim: true, default: '' },
  paymentMethod: { type: String, trim: true, default: '' },
  subService: { type: String, trim: true, default: '' },
  fromTo: { type: String, trim: true, default: '' },
  ticketNumber: { type: String, trim: true, default: '' },
  service: { type: mongoose.Schema.Types.Mixed, default: {} },
  consultants: { type: [mongoose.Schema.Types.Mixed], default: [] },

  agency: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export default mongoose.model('Record', RecordSchema);
