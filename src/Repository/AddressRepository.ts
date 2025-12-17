import AddressModel from "../model/Address.js";

export class AddressRepository {
  async create(data: any) {
    return AddressModel.create(data);
  }

  async findById(id: string) {
    return AddressModel.findById(id);
  }

  async update(id: string, data: any) {
    return AddressModel.findByIdAndUpdate(id, data, { new: true });
  }

  async delete(id: string) {
    return AddressModel.findByIdAndDelete(id);
  }
}
