import mongoose from "mongoose";

const pgSchema = new mongoose.Schema(
  {
    total_rooms_occupied: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 24,
    },
    total_guests: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    active_guests: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    inactive_guests: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

const PGModel = mongoose.model("PG", pgSchema);

export default PGModel;
