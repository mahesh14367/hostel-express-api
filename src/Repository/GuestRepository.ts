import GuestModel from "../model/Guest.js";

export class GuestRepository {
  async findAll() {
    return GuestModel.find().populate("addressId");
  }

  async findById(id: string) {
    return GuestModel.findById(id).populate("addressId");
  }

  async create(data: any) {
    return GuestModel.create(data);
  }

  async update(id: string, data: any) {
    return GuestModel.findByIdAndUpdate(id, data, { new: true }).populate(
      "addressId"
    );
  }

  async delete(id: string) {
    return GuestModel.findByIdAndDelete(id);
  }

  async findByMobileNumber(mobileNumber: string) {
    return GuestModel.findOne({ mobileNumber });
  }
}
