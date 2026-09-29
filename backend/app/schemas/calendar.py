from datetime import datetime

from pydantic import BaseModel, Field, field_validator, model_validator


class CalendarEventCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str = Field(default="", max_length=5000)
    start_datetime: datetime
    end_datetime: datetime
    time_zone: str = Field(default="Asia/Kolkata", min_length=1, max_length=100)

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("title cannot be empty")
        return value

    @field_validator("time_zone")
    @classmethod
    def validate_time_zone(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("time_zone cannot be empty")
        return value

    @model_validator(mode="after")
    def validate_datetimes(self):
        if self.start_datetime.tzinfo is None or self.start_datetime.utcoffset() is None:
            raise ValueError("start_datetime must include a timezone offset")
        if self.end_datetime.tzinfo is None or self.end_datetime.utcoffset() is None:
            raise ValueError("end_datetime must include a timezone offset")
        if self.end_datetime <= self.start_datetime:
            raise ValueError("end_datetime must be later than start_datetime")
        return self
