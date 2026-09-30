import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsString, MaxLength, ValidateNested } from "class-validator";

export class VoiceDebugRawEntryDto {
  @IsInt()
  index!: number;

  @IsBoolean()
  isFinal!: boolean;

  @IsString()
  @MaxLength(2000)
  text!: string;
}

export class SaveAgroVoiceDebugLogDto {
  @IsString()
  @MaxLength(500)
  userAgent!: string;

  @IsString()
  @MaxLength(2000)
  transcript!: string;

  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => VoiceDebugRawEntryDto)
  rawResults!: VoiceDebugRawEntryDto[];
}
