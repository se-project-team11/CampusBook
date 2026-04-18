from dataclasses import dataclass, field


@dataclass
class ValidationResult:
    """
    Result returned by any ValidationStrategy.validate_async() call.
    ok=False means booking must be rejected with reason as the error message.
    needs_approval=True means booking enters RESERVED state pending dept admin action
    (not implemented in prototype, but field is passed through to Booking object).
    """
    ok:             bool
    reason:         str  = ""
    needs_approval: bool = False
