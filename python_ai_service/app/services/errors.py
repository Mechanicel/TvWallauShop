from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional


@dataclass
class AiServiceError(Exception):
    code: str
    message: str
    details: Optional[Any] = None
    job_id: Optional[int] = None
    http_status: int = 500
    debug: Optional[Any] = None

    def to_contract_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "code": self.code,
            "message": self.message,
            "jobId": self.job_id,
        }
        if self.details is not None:
            payload["details"] = self.details
        return payload
