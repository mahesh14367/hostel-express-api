import { GuestRepository } from "../Repository/GuestRepository.js";
import { AddressRepository } from "../Repository/AddressRepository.js";
import { RoomRepository } from "../Repository/RoomRepository.js";
import { PaymentRepository } from "../Repository/PaymentRepository.js";
import { PGRepository } from "../Repository/PGRepository.js";

const guestRepo = new GuestRepository();
const addressRepo = new AddressRepository();
const roomRepo = new RoomRepository();
const paymentRepo = new PaymentRepository();
const pgRepo = new PGRepository();

const computeRoomsFromActive = (activeCount: number) => {
  const rooms = Math.floor((activeCount ?? 0) / 3) + 1;
  return Math.min(24, Math.max(0, rooms));
};

const recalcPgRooms = async () => {
  const pg = await pgRepo.findOne();
  if (!pg) return null;
  const total_rooms_occupied = computeRoomsFromActive(pg.active_guests);
  await pgRepo.setTotalRoomsOccupied(total_rooms_occupied);
  return total_rooms_occupied;
};

export class GuestService {
  async getAllGuests() {
    return guestRepo.findAll();
  }

  async getGuestById(guestId: string) {
    return guestRepo.findById(guestId);
  }

  async createGuest(guestData: any) {
    const { name, age, mobileNumber, roomNo, status, address, payment } =
      guestData;

    // Validate address
    if (
      !address?.doorNo ||
      !address?.street ||
      !address?.state ||
      !address?.pincode
    ) {
      throw new Error("Address details are required");
    }

    // Validate payment
    if (!payment || payment.amount === undefined) {
      throw new Error("Payment amount is required");
    }

    // Validate room number
    if (!roomNo) {
      throw new Error("Room number is required");
    }

    // Check room availability and create if needed
    let room = await roomRepo.findByRoomNo(roomNo);
    let createdRoom: any = null;

    if (!room) {
      const pgStat = await pgRepo.findOne();
      if (pgStat && pgStat.total_rooms_occupied >= 24) {
        throw new Error("PG has reached the maximum rooms limit (24)");
      }

      const capacity = 3;
      if (capacity > 3) {
        throw new Error("Max capacity is 3 beds per room");
      }

      createdRoom = await roomRepo.create({
        room_no: roomNo,
        vacant_beds: Math.max(0, capacity - 1),
        occupied_beds: 1,
      });
      room = createdRoom;
    } else {
      if (room.vacant_beds <= 0) {
        throw new Error(`Room ${roomNo} has no vacant beds available`);
      }
    }

    // Create address
    const newAddress = await addressRepo.create({
      doorNo: address.doorNo,
      street: address.street,
      state: address.state,
      pincode: address.pincode,
    });

    // Create guest
    const guestStatus = status !== undefined ? status : 1;
    const newGuest = await guestRepo.create({
      name,
      age,
      mobileNumber,
      roomNo,
      status: guestStatus,
      addressId: (newAddress as any)._id,
    });

    // Create payment
    const newPayment = await paymentRepo.create({
      guestId: (newGuest as any)._id,
      amount: payment.amount,
      date: payment.date || new Date(),
    });

    // Update room if not newly created
    if (!createdRoom) {
      await roomRepo.updateOccupancy(roomNo, -1, 1);
    }

    // Update PG stats
    let pg = await pgRepo.findOne();
    if (!pg) {
      pg = (await pgRepo.create({
        total_rooms_occupied: computeRoomsFromActive(guestStatus === 1 ? 1 : 0),
        total_guests: 1,
        active_guests: guestStatus === 1 ? 1 : 0,
        inactive_guests: guestStatus === 0 ? 1 : 0,
      })) as any;
    } else {
      const inc: any = {
        total_guests: 1,
        active_guests: guestStatus === 1 ? 1 : 0,
        inactive_guests: guestStatus === 0 ? 1 : 0,
      };
      await pgRepo.updateCounters(inc);
      await recalcPgRooms();
    }

    const populatedGuest = await guestRepo.findById((newGuest as any)._id);

    return {
      guest: populatedGuest,
      payment: newPayment,
      room,
      createdRoom: !!createdRoom,
    };
  }

  async updateGuest(guestId: string, updateData: any) {
    const { name, age, mobileNumber, roomNo, status, address } = updateData;

    const guest = await guestRepo.findById(guestId);
    if (!guest) {
      throw new Error("Guest not found");
    }

    const oldStatus: number = guest.status;
    const oldRoomNo: number = guest.roomNo;
    const newStatus: number =
      typeof status !== "undefined" ? status : oldStatus;
    const newRoomNo: number =
      typeof roomNo !== "undefined" ? roomNo : oldRoomNo;

    // Update address if provided
    if (address) {
      await addressRepo.update(guest.addressId.toString(), address);
    }

    // Handle room and bed counters
    let freeOldBed = false;
    let occupyNewBed = false;

    if (oldStatus === 1 && newStatus === 0) {
      freeOldBed = true;
    }
    if (oldStatus === 0 && newStatus === 1) {
      occupyNewBed = true;
    }
    if (oldStatus === 1 && newStatus === 1 && newRoomNo !== oldRoomNo) {
      freeOldBed = true;
      occupyNewBed = true;
    }

    if (occupyNewBed) {
      const targetRoom = await roomRepo.findByRoomNo(newRoomNo);
      if (!targetRoom) {
        throw new Error(`Target room ${newRoomNo} does not exist`);
      }
      if (targetRoom.vacant_beds <= 0) {
        throw new Error(`Room ${newRoomNo} has no vacant beds available`);
      }
      await roomRepo.updateOccupancy(newRoomNo, -1, 1);
    }

    if (freeOldBed && oldRoomNo) {
      await roomRepo.updateOccupancy(oldRoomNo, 1, -1);
    }

    // Update PG if status changed
    if (oldStatus !== newStatus) {
      const inc: any = {
        active_guests: 0,
        inactive_guests: 0,
      };
      if (oldStatus === 1 && newStatus === 0) {
        inc.active_guests = -1;
        inc.inactive_guests = 1;
      } else if (oldStatus === 0 && newStatus === 1) {
        inc.active_guests = 1;
        inc.inactive_guests = -1;
      }
      await pgRepo.updateCounters(inc);
      await recalcPgRooms();
    }

    // Prepare update data
    const data: any = {};
    if (name) data.name = name;
    if (age) data.age = age;
    if (mobileNumber) data.mobileNumber = mobileNumber;
    if (typeof roomNo !== "undefined") data.roomNo = newRoomNo;
    if (typeof status !== "undefined") data.status = newStatus;

    return guestRepo.update(guestId, data);
  }

  async deleteGuest(guestId: string) {
    const guest = await guestRepo.findById(guestId);
    if (!guest) {
      throw new Error("Guest not found");
    }

    const deletedGuest = await guestRepo.delete(guestId);

    // Delete address
    let deletedAddress = null;
    if (guest.addressId) {
      deletedAddress = await addressRepo.delete(guest.addressId.toString());
    }

    // Update room counters
    if (guest.roomNo) {
      await roomRepo.updateOccupancy(guest.roomNo, 1, -1);
    }

    // Update PG counters
    const incPg: any = {
      total_guests: -1,
      active_guests: guest.status === 1 ? -1 : 0,
      inactive_guests: guest.status === 0 ? -1 : 0,
    };
    await pgRepo.updateCounters(incPg);
    await recalcPgRooms();

    return { deletedGuest, deletedAddress };
  }
}
