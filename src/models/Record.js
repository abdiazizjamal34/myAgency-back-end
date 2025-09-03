import mongoose from 'mongoose';

const RecordSchema = new mongoose.Schema({
  agency: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  customerName: { type: String, required: true, trim: true },
  typeOfService: { type: String, required: true, trim: true }, // e.g., flight, hotel, visa, tour, cargo
  sellingPrice: { type: Number, required: true, min: 0 },
  buyingPrice: { type: Number, required: true, min: 0 },
  expenses: { type: Number, required: true, min: 0, default: 0 }, // operational cost per service
  commission: { type: Number, required: true, min: 0 }, // selling - buying
  notes: { type: String, trim: true },
}, { timestamps: true });

RecordSchema.index({ agency: 1, createdAt: -1 });
RecordSchema.index({ typeOfService: 1 });

RecordSchema.pre('validate', function(next) {
  this.commission = Math.max(0, (this.sellingPrice || 0) - (this.buyingPrice || 0));
  next();
});

export default mongoose.model('Record', RecordSchema);
