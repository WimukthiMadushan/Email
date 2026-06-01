import mongoose from 'mongoose';

const visitSchema = new mongoose.Schema(
  {
    visitedAt: {
      type: Date,
      default: Date.now,
    },
    userAgent: String,
    referrer: String,
    ipHash: String,
  },
  { _id: false }
);

const urlSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    originalUrl: {
      type: String,
      required: true,
      trim: true,
    },
    shortCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    visitCount: {
      type: Number,
      default: 0,
    },
    visits: {
      type: [visitSchema],
      default: [],
    },
  },
  { timestamps: true }
);

export const Url = mongoose.model('Url', urlSchema);
