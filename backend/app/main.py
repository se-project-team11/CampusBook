from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.db.base import init_db, engine

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("CampusBook API starting...")
    try:
        # Test DB connection
        async with engine.begin() as conn:
            await conn.execute("SELECT 1")
        print("PostgreSQL connected")
    except Exception as e:
        print(f"PostgreSQL error: {e}")
    
    yield
    
    print("CampusBook API shutting down...")
    await engine.dispose()

app = FastAPI(
    title="CampusBook API",
    version="1.0.0",
    lifespan=lifespan,
)

@app.get("/health")
async def health_check():
    return {"status": "ok", "database": "connected"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)