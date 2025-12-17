import PGModel from "../model/PG.js";

export class PGRepository {
  async findOne() {
    return PGModel.findOne();
  }

  async create(data: any) {
    return PGModel.create(data);
  }

  async updateCounters(data: any) {
    return PGModel.findOneAndUpdate(
      {},
      { $inc: data },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  }

  async setTotalRoomsOccupied(total_rooms_occupied: number) {
    return PGModel.updateOne({}, { $set: { total_rooms_occupied } });
  }
}
