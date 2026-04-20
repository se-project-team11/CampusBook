import pytest
import time
import asyncio
from app.services.notification_service import CircuitBreaker

@pytest.mark.asyncio
async def test_circuit_breaker_opens_after_threshold_failures():
    breaker = CircuitBreaker(threshold=3, recovery_seconds=10)
    
    async def failing_call():
        raise Exception("Simulated API failure")
        
    # First 3 calls should raise the exception
    for _ in range(3):
        with pytest.raises(Exception, match="Simulated API failure"):
            await breaker.call(failing_call())
            
    # Circuit is now OPEN. 4th call should be dropped silently (no exception raised)
    await breaker.call(failing_call())
    assert breaker._open is True


@pytest.mark.asyncio
async def test_circuit_breaker_recovers_after_timeout():
    breaker = CircuitBreaker(threshold=2, recovery_seconds=1)
    
    async def failing_call():
        raise Exception("Failure")
        
    async def successful_call():
        return "Success"
        
    # Trip the circuit
    with pytest.raises(Exception): await breaker.call(failing_call())
    with pytest.raises(Exception): await breaker.call(failing_call())
    
    assert breaker._open is True
    
    # Wait for recovery window
    time.sleep(1.1)
    
    # Half-open state -> successful call should close the circuit
    await breaker.call(successful_call())
    assert breaker._open is False
    assert breaker._failures == 0


@pytest.mark.asyncio
async def test_circuit_breaker_resets_failures_on_success():
    breaker = CircuitBreaker(threshold=3, recovery_seconds=10)
    
    async def failing_call():
        raise Exception("Failure")
        
    async def successful_call():
        return "Success"
        
    with pytest.raises(Exception): await breaker.call(failing_call())
    assert breaker._failures == 1
    
    await breaker.call(successful_call())
    assert breaker._failures == 0
    assert breaker._open is False
