import express from "express";
import { GuestController } from "../controller/GuestController.js";

const router = express.Router();
const guestController = new GuestController();

// Routes
router.get("/guests", (req, res) =>
  guestController.getAllGuests(req, res)
);

router.get("/guests/:id", (req, res) =>
  guestController.getGuestById(req, res)
);

router.post("/guests", (req, res) =>
  guestController.createGuest(req, res)
);

router.put("/guests/:id", (req, res) =>
  guestController.updateGuest(req, res)
);

router.delete("/guests/:id", (req, res) =>
  guestController.deleteGuest(req, res)
);

export default router;

