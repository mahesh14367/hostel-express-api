import PaymentModel from "../model/Payment.js";

export class PaymentRepository {
  async create(data: any) {
    return PaymentModel.create(data);
  }

  async findByGuestId(guestId: string) {
    return PaymentModel.find({ guestId });
  }

  async findAll() {
    return PaymentModel.find();
  }
}
