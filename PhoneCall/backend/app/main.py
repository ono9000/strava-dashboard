from fastapi import FastAPI
from app.auth.router import router as auth_router

app = FastAPI(title="PhoneCall", version="1.0.0")

app.include_router(auth_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
