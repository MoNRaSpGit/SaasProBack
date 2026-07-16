import { Body, Controller, Post } from "@nestjs/common";
import { JuezAuthService } from "./juez-auth.service";
import { ConfirmJuezEmailDto } from "./dto/confirm-juez-email.dto";
import { LoginJuezDto } from "./dto/login-juez.dto";
import { RegisterJuezDto } from "./dto/register-juez.dto";

@Controller("juez-auth")
export class JuezAuthController {
  constructor(private readonly juezAuthService: JuezAuthService) {}

  @Post("register")
  register(@Body() dto: RegisterJuezDto) {
    return this.juezAuthService.register(dto);
  }

  @Post("login")
  login(@Body() dto: LoginJuezDto) {
    return this.juezAuthService.login(dto);
  }

  @Post("confirm-email")
  confirmEmail(@Body() dto: ConfirmJuezEmailDto) {
    return this.juezAuthService.confirmEmail(dto);
  }
}
