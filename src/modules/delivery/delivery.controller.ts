import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from "@nestjs/common";
import { CreateDeliveryEventDto } from "./dto/create-delivery-event.dto";
import { CreateDeliverySignupDto } from "./dto/create-delivery-signup.dto";
import { UpdateDeliveryEventDto } from "./dto/update-delivery-event.dto";
import { DeliveryService } from "./delivery.service";

@Controller("delivery")
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Get("users")
  listUsers() {
    return this.deliveryService.listUsers();
  }

  @Get("events")
  listEvents() {
    return this.deliveryService.listEvents();
  }

  @Post("events")
  createEvent(@Body() dto: CreateDeliveryEventDto) {
    return this.deliveryService.createEvent(dto);
  }

  @Patch("events/:id")
  updateEvent(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateDeliveryEventDto) {
    return this.deliveryService.updateEvent(id, dto);
  }

  @Delete("events/:id")
  deleteEvent(@Param("id", ParseIntPipe) id: number) {
    return this.deliveryService.deleteEvent(id);
  }

  @Post("events/:id/signups")
  createSignup(@Param("id", ParseIntPipe) id: number, @Body() dto: CreateDeliverySignupDto) {
    return this.deliveryService.createSignup(id, dto);
  }

  @Delete("events/:id/signups/:userId")
  deleteSignup(@Param("id", ParseIntPipe) id: number, @Param("userId", ParseIntPipe) userId: number) {
    return this.deliveryService.deleteSignup(id, userId);
  }
}
