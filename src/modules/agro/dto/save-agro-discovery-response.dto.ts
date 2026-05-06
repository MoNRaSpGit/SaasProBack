import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsDateString, IsIn, IsString, MaxLength, ValidateNested } from "class-validator";

export class SaveAgroDiscoveryAnswerDto {
  @IsString()
  @MaxLength(120)
  questionId!: string;

  @IsString()
  @MaxLength(120)
  selectedOption!: string;
}

export class SaveAgroDiscoveryResponseDto {
  @IsIn(["agro"])
  moduleKey!: "agro";

  @IsIn(["v1"])
  version!: "v1";

  @IsDateString()
  answeredAt!: string;

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SaveAgroDiscoveryAnswerDto)
  answers!: SaveAgroDiscoveryAnswerDto[];
}
