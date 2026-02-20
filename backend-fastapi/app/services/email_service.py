import logging

logger = logging.getLogger(__name__)


async def send_verification_email(email: str, code: str) -> None:
    """Send verification code. In dev mode, logs to console."""
    logger.info(f"[DEV] Verification code for {email}: {code}")
