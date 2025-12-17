import RoomModel from "../model/Room.js";

export class RoomRepository {
  async findByRoomNo(room_no: number) {
    return RoomModel.findOne({ room_no });
  }

  async create(data: any) {
    return RoomModel.create(data);
  }

  async updateOccupancy(
    room_no: number,
    vacant_delta: number,
    occupied_delta: number
  ) {
    return RoomModel.findOneAndUpdate(
      { room_no },
      { $inc: { vacant_beds: vacant_delta, occupied_beds: occupied_delta } },
      { new: true }
    );
  }

  async findAll() {
    return RoomModel.find();
  }
}
