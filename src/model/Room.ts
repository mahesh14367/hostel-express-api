import mongoose from "mongoose";

const roomSchema = new mongoose.Schema(
  {
    room_no: {
      type: Number,
      required: true,
      unique: true,
    },
    
    vacant_beds: {
      type: Number,
      required: true,
      min: 0,
      max: 3,
    },
    occupied_beds: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

// Ensure total beds per room do not exceed capacity (3) and no negatives
roomSchema.pre("validate", function () {
  const self: any = this;
  const total = (self.vacant_beds ?? 0) + (self.occupied_beds ?? 0);
  if (self.vacant_beds < 0 || self.occupied_beds < 0) {
    throw new Error("Beds cannot be negative");
  }
  if (total > 3) {
    throw new Error("Total beds (vacant + occupied) cannot exceed 3");
  }
});

const RoomModel = mongoose.model("Room", roomSchema);

export default RoomModel;
