from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class TimeSlot:
    """
    Value object representing a booking time window.
    Immutable (frozen=True) — two TimeSlots with same start/end are equal by value.
    Used by BookingService, adapters, strategies, and repository queries.
    """
    start: datetime
    end:   datetime

    def __post_init__(self) -> None:
        if self.end <= self.start:
            raise ValueError(
                f"TimeSlot end ({self.end}) must be after start ({self.start})"
            )

    @property
    def duration_minutes(self) -> int:
        return int((self.end - self.start).total_seconds() / 60)

    def duration_hours(self) -> float:
        return self.duration_minutes / 60.0

    def overlaps_with(self, other: "TimeSlot") -> bool:
        """Returns True if this slot overlaps with another (half-open interval [start, end))."""
        return self.start < other.end and other.start < self.end

    def __repr__(self) -> str:
        return (
            f"TimeSlot({self.start.strftime('%Y-%m-%d %H:%M')} → "
            f"{self.end.strftime('%H:%M')})"
        )
