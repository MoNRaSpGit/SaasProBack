import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { JuezAuthService } from "./juez-auth.service";
import { ConfirmJuezEmailDto } from "./dto/confirm-juez-email.dto";
import { LoginJuezDto } from "./dto/login-juez.dto";
import { RegisterJuezDto } from "./dto/register-juez.dto";
import { UpdateJuezAccountRolesDto } from "./dto/update-juez-account-roles.dto";

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

  @Get("accounts")
  listAccounts() {
    return this.juezAuthService.listAccounts();
  }

  @Patch("accounts/:id/roles")
  updateAccountRoles(@Param("id") id: string, @Body() dto: UpdateJuezAccountRolesDto) {
    return this.juezAuthService.updateAccountRoles(Number(id), dto);
  }
}
