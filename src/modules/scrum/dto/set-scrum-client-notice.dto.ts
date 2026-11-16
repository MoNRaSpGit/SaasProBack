import { IsBoolean, IsIn, IsString, MaxLength, MinLength } from "class-validator";
import { NOTICE_APPS, type NoticeAppKey } from "../../notices/notices.service";

export class SetScrumClientNoticeDto {
  @IsIn([...NOTICE_APPS])
  appKey!: NoticeAppKey;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  appUsername!: string;

  @IsBoolean()
  active!: boolean;
}
