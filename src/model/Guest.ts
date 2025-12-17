import mongoose from "mongoose";
const guestSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    age: {
      type: Number,
      required: true
    },
    mobileNumber: {
      type: String,
      required: true,
      unique: true,
    },

    // ONE-TO-ONE relationship
    addressId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Address",
      required: true,
      unique: true, // ensures one user → one address
    },

    roomNo: {
      type: Number,
      required: true,
    },

    status: {
      type: Number, // acts like TINYINT
      enum: [0, 1], // 0 = inactive, 1 = active
      default: 1,
    },
  },
  { timestamps: true }
);


const GuestModel = mongoose.model("Guest", guestSchema);

export default GuestModel;
