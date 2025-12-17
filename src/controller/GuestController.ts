import { Request, Response } from "express";
import { GuestService } from "../service/GuestService.js";

const guestService = new GuestService();

export class GuestController {
  async getAllGuests(req: Request, res: Response) {
    try {
      const guests = await guestService.getAllGuests();
      res.status(200).json({
        status: "success",
        data: guests,
      });
    } catch (error) {
      res.status(500).json({
        status: "error",
        message:
          error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  async getGuestById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          status: "error",
          message: "Guest ID is required",
        });
      }

      const guest = await guestService.getGuestById(id);

      if (!guest) {
        return res.status(404).json({
          status: "error",
          message: "Guest not found",
        });
      }

      res.status(200).json({
        status: "success",
        data: guest,
      });
    } catch (error) {
      res.status(500).json({
        status: "error",
        message:
          error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  async createGuest(req: Request, res: Response) {
    try {
      const { name, age, mobileNumber, roomNo, status, address, payment } =
        req.body;

      if (!name || !age || !mobileNumber) {
        return res.status(400).json({
          status: "error",
          message: "name, age, and mobileNumber are required",
        });
      }

      const result = await guestService.createGuest({
        name,
        age,
        mobileNumber,
        roomNo,
        status,
        address,
        payment,
      });

      res.status(201).json({
        status: "success",
        data: result,
      });
    } catch (error) {
      const statusCode =
        error instanceof Error && error.message.includes("limit") ? 400 : 500;
      res.status(statusCode).json({
        status: "error",
        message:
          error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  async updateGuest(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          status: "error",
          message: "Guest ID is required",
        });
      }

      const { name, age, mobileNumber, roomNo, status, address } = req.body;

      const updatedGuest = await guestService.updateGuest(id, {
        name,
        age,
        mobileNumber,
        roomNo,
        status,
        address,
      });

      res.status(200).json({
        status: "success",
        data: updatedGuest,
      });
    } catch (error) {
      const statusCode =
        error instanceof Error && error.message.includes("not found")
          ? 404
          : 500;
      res.status(statusCode).json({
        status: "error",
        message:
          error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  async deleteGuest(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          status: "error",
          message: "Guest ID is required",
        });
      }

      const result = await guestService.deleteGuest(id);

      res.status(200).json({
        status: "success",
        data: result,
        message: "Guest deleted successfully",
      });
    } catch (error) {
      const statusCode =
        error instanceof Error && error.message.includes("not found")
          ? 404
          : 500;
      res.status(statusCode).json({
        status: "error",
        message:
          error instanceof Error ? error.message : "Internal server error",
      });
    }
  }
}
