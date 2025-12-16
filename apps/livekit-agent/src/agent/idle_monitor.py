import asyncio
import logging
import sys

logger = logging.getLogger("idle-monitor")

class IdleMonitor:
    """
    Monitors user activity and shuts down the worker if idle for too long.
    Activity is defined as:
    - User speaking (Voice)
    - User typing (Text)
    """
    def __init__(self, ctx, timeout_seconds=300): # 5 minutes default
        self.ctx = ctx
        self.timeout = timeout_seconds
        self.last_activity = asyncio.get_event_loop().time()
        
        self._task = asyncio.create_task(self._monitor())
        logger.info(f"IdleMonitor started with {timeout_seconds}s timeout")

    def touch(self):
        """Call this whenever user interacts"""
        self.last_activity = asyncio.get_event_loop().time()

    async def _monitor(self):
        while True:
            await asyncio.sleep(60) # Check every minute
            now = asyncio.get_event_loop().time()
            elapsed = now - self.last_activity
            
            if elapsed > self.timeout:
                logger.warning(f"Session idle for {elapsed:.0f}s. Shutting down worker.")
                # We can gracefully close the room or just exit.
                # Exiting the process is often the safest way to ensure clean Pod restart in K8s,
                # but for local dev/Nx, closing the connection is better.
                try:
                    await self.ctx.disconnect()
                except:
                    pass
                sys.exit(0)
