import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsPositive, Matches } from "class-validator";

export class SubmitGpsPicksDto {
  @IsArray()
  @ArrayMaxSize(50)
  @IsInt({ each: true })
  @IsPositive({ each: true })
  clientIds!: number[];

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  day?: string;
}
