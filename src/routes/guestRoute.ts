import express from "express";
import mongoose from "mongoose";
import GuestModel from "../model/Guest.js";
import AddressModel from "../model/Address.js";
import PaymentModel from "../model/Payment.js";
import RoomModel from "../model/Room.js";
import PGModel from "../model/PG.js";

const router = express.Router();

const computeRoomsFromActive = (activeCount: number) => {
  // As requested: rooms = floor(active/3) + 1, bounded to [0,24]
  const rooms = Math.floor((activeCount ?? 0) / 3) + 1;
  return Math.min(24, Math.max(0, rooms));
};

const recalcPgRooms = async () => {
  const pg = await PGModel.findOne();
  if (!pg) return null;
  const total_rooms_occupied = computeRoomsFromActive(pg.active_guests);
  await PGModel.updateOne({ _id: pg._id }, { $set: { total_rooms_occupied } });
  return total_rooms_occupied;
};

// GET all guests with populated address and payments
router.get("/guests", async (req, res) => {
  try {
    const guestData = await GuestModel.find().populate("addressId");
    console.log("Found guests:", guestData.length);

    // Fetch payments for all guests
    const guestsWithPayments = await Promise.all(
      guestData.map(async (guest) => {
        const payments = await PaymentModel.find({ guestId: guest._id });
        return {
          ...guest.toObject(),
          payments,
        };
      })
    );

    res.json(guestsWithPayments);
  } catch (error) {
    console.error("Error fetching guests:", error);
    res.status(500).json({ error: "Failed to fetch guests" });
  }
});

// GET guest by id with populated address and payments
router.get("/guests/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Validate if id is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid guest ID format" });
    }

    console.log("Fetching guest with id:", id);

    const guest = await GuestModel.findById(id).populate("addressId");

    if (!guest) {
      return res.status(404).json({ error: "Guest not found with ID: " + id });
    }

    // Fetch payments for this guest
    const payments = await PaymentModel.find({ guestId: guest._id });

    console.log("Found guest:", guest._id);
    res.json({
      ...guest.toObject(),
      payments,
    });
  } catch (error) {
    console.error("Error fetching guest:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch guest", details: `${error}` });
  }
});

// POST create guest with address and auto-create payment
router.post("/guests", async (req, res) => {
  try {
    const { name, age, mobileNumber, roomNo, status, address, payment } =
      req.body;

    // Validate address data
    if (
      !address?.doorNo ||
      !address?.street ||
      !address?.state ||
      !address?.pincode
    ) {
      return res.status(400).json({ error: "Address details are required" });
    }

    // Validate payment data
    if (!payment || payment.amount === undefined) {
      return res.status(400).json({ error: "Payment amount is required" });
    }

    // Validate and check room availability
    if (!roomNo) {
      return res.status(400).json({ error: "Room number is required" });
    }

    // Find room or create it if client provides capacity
    let room = await RoomModel.findOne({ room_no: roomNo });
    let createdRoom: any = null;
    if (!room) {
      // Enforce PG max room cap (24) before creating a new room
      const pgStat = await PGModel.findOne();
      if (pgStat && pgStat.total_rooms_occupied >= 24) {
        return res
          .status(400)
          .json({ error: "PG has reached the maximum rooms limit (24)" });
      }
      const capacityRaw = 3;

      const capacity = Number(capacityRaw);
      if (!capacity || Number.isNaN(capacity) || capacity < 1) {
        return res.status(404).json({
          error: `Room ${roomNo} does not exist. Provide 'roomCapacity' (1-3) to create it on the fly.`,
        });
      }
      if (capacity > 3) {
        return res
          .status(400)
          .json({ error: "Max capacity is 3 beds per room" });
      }
      // Create new room and immediately occupy one bed
      createdRoom = await RoomModel.create({
        room_no: roomNo,
        vacant_beds: Math.max(0, capacity - 1),
        occupied_beds: 1,
      });
      room = createdRoom;
    } else {
      if (room.vacant_beds <= 0) {
        return res.status(400).json({
          error: `Room ${roomNo} has no vacant beds available`,
        });
      }
    }

    // Create address first
    const newAddress = await AddressModel.create({
      doorNo: address.doorNo,
      street: address.street,
      state: address.state,
      pincode: address.pincode,
    });

    // Create guest with the addressId reference
    const guestStatus = status !== undefined ? status : 1;
    const newGuest = await GuestModel.create({
      name,
      age,
      mobileNumber,
      roomNo,
      status: guestStatus,
      addressId: newAddress._id,
    });

    // Auto-create payment record for the guest
    const newPayment = await PaymentModel.create({
      guestId: newGuest._id,
      amount: payment.amount,
      date: payment.date || new Date(),
    });

    // Update Room counts if we didn't just create the room above
    if (!createdRoom) {
      await RoomModel.findOneAndUpdate(
        { room_no: roomNo },
        {
          $inc: { vacant_beds: -1, occupied_beds: 1 },
        },
        { new: true }
      );
    }

    // Update or create PG entity
    let pg = await PGModel.findOne();
    if (!pg) {
      // Create initial PG record if it doesn't exist
      pg = await PGModel.create({
        total_rooms_occupied: computeRoomsFromActive(guestStatus === 1 ? 1 : 0),
        total_guests: 1,
        active_guests: guestStatus === 1 ? 1 : 0,
        inactive_guests: guestStatus === 0 ? 1 : 0,
      });
    } else {
      // Update existing PG record
      const inc: any = {
        total_guests: 1,
        active_guests: guestStatus === 1 ? 1 : 0,
        inactive_guests: guestStatus === 0 ? 1 : 0,
      };
      await PGModel.findOneAndUpdate({}, { $inc: inc }, { new: true });
      await recalcPgRooms();
    }

    // Populate address in response
    const populatedGuest = await GuestModel.findById(newGuest._id).populate(
      "addressId"
    );

    res.status(201).json({
      guest: populatedGuest,
      payment: newPayment,
      room,
      message: createdRoom
        ? "Guest created; new room created and capacities updated"
        : "Guest created; room and capacities updated",
    });
  } catch (error) {
    console.error("Error creating guest:", error);
    res
      .status(500)
      .json({ error: "Failed to create guest", details: `${error}` });
  }
});

// PUT update guest (and optionally address)
router.put("/guests/:id", async (req, res) => {
  try {
    const { name, age, mobileNumber, roomNo, status, address } = req.body;

    const guest = await GuestModel.findById(req.params.id);
    if (!guest) {
      return res.status(404).json({ error: "Guest not found" });
    }

    const oldStatus: number = guest.status;
    const oldRoomNo: number = guest.roomNo;
    const newStatus: number =
      typeof status !== "undefined" ? status : oldStatus;
    const newRoomNo: number =
      typeof roomNo !== "undefined" ? roomNo : oldRoomNo;

    // Handle address update if provided
    if (address) {
      await AddressModel.findByIdAndUpdate(guest.addressId, address);
    }

    // Determine room counter adjustments
    let freeOldBed = false;
    let occupyNewBed = false;

    if (oldStatus === 1 && newStatus === 0) {
      // Active -> Inactive: free old bed
      freeOldBed = true;
    }
    if (oldStatus === 0 && newStatus === 1) {
      // Inactive -> Active: occupy bed in (possibly new) room
      occupyNewBed = true;
    }
    if (oldStatus === 1 && newStatus === 1 && newRoomNo !== oldRoomNo) {
      // Move active guest from one room to another
      freeOldBed = true;
      occupyNewBed = true;
    }

    // If we need to occupy a bed, ensure new room exists and has vacancy
    if (occupyNewBed) {
      const targetRoom = await RoomModel.findOne({ room_no: newRoomNo });
      if (!targetRoom) {
        return res
          .status(404)
          .json({ error: `Target room ${newRoomNo} does not exist` });
      }
      if (targetRoom.vacant_beds <= 0) {
        return res
          .status(400)
          .json({ error: `Room ${newRoomNo} has no vacant beds available` });
      }
      await RoomModel.findOneAndUpdate(
        { room_no: newRoomNo },
        { $inc: { vacant_beds: -1, occupied_beds: 1 } },
        { new: true }
      );
    }

    // If we need to free the old bed, best-effort update
    if (freeOldBed && oldRoomNo) {
      await RoomModel.findOneAndUpdate(
        { room_no: oldRoomNo },
        { $inc: { vacant_beds: 1, occupied_beds: -1 } },
        { new: true }
      );
    }

    // Update PG counters if status changed
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
      await PGModel.findOneAndUpdate(
        {},
        { $inc: inc },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        }
      );
      await recalcPgRooms();
    }

    // Prepare update data
    const updateData: any = {};
    if (name) updateData.name = name;
    if (age) updateData.age = age;
    if (mobileNumber) updateData.mobileNumber = mobileNumber;
    if (typeof roomNo !== "undefined") updateData.roomNo = newRoomNo;
    if (typeof status !== "undefined") updateData.status = newStatus;

    const updated = await GuestModel.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate("addressId");

    res.json(updated);
  } catch (error) {
    console.error("Error updating guest:", error);
    res.status(500).json({ error: "Failed to update guest" });
  }
});

// DELETE guest (also delete associated address) - replica-set-free safe flow
router.delete("/guests/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid guest ID format" });
    }

    const guest = await GuestModel.findById(id);
    if (!guest) {
      return res.status(404).json({ error: "Guest not found" });
    }

    // Delete the guest first
    const deletedGuest = await GuestModel.findByIdAndDelete(id);

    // Then delete the associated address (best-effort)
    let deletedAddress = null as any;
    if (guest.addressId) {
      deletedAddress = await AddressModel.findByIdAndDelete(guest.addressId);
    }

    // Update room counters to free up a bed (best-effort)
    if (guest.roomNo) {
      await RoomModel.findOneAndUpdate(
        { room_no: guest.roomNo },
        { $inc: { vacant_beds: 1, occupied_beds: -1 } },
        { new: true }
      );
    }

    // Update PG counters based on guest status
    const incPg: any = {
      total_guests: -1,
      active_guests: guest.status === 1 ? -1 : 0,
      inactive_guests: guest.status === 0 ? -1 : 0,
    };
    await PGModel.findOneAndUpdate({}, { $inc: incPg }, { new: true });
    await recalcPgRooms();

    return res.json({
      message: "Guest deleted; associated address removed; counters updated",
      deletedGuest,
      deletedAddress,
    });
  } catch (error: any) {
    console.error("Error deleting guest:", error);
    return res.status(500).json({
      error: "Failed to delete guest",
      details: error?.message || String(error),
    });
  }
});

export default router;
