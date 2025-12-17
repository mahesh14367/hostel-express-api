import mongoose from "mongoose";

const addressSchema = new mongoose.Schema(
  {
    doorNo: {
      type: String,
      required: true,
    },
    street: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      required: true,
    },
    pincode: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const AddressModel = mongoose.model("Address", addressSchema);

export default AddressModel;
