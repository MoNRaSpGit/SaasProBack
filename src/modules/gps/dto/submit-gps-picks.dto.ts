import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsPositive, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class SubmitGpsPicksDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  persona!: string;

  @IsArray()
  @ArrayMaxSize(50)
  @IsInt({ each: true })
  @IsPositive({ each: true })
  clientIds!: number[];

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  day?: string;
}
