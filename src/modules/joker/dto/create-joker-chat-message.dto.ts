import { IsIn, IsString, MaxLength, MinLength } from "class-validator";

export class CreateJokerChatMessageDto {
  @IsIn(["administrador", "usuario"])
  senderRole!: "administrador" | "usuario";

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  message!: string;
}
